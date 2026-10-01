import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Emails everyone who follows a fandom tagged on this event, once it's
// actually published. Called by the client right after a free event
// publishes, and internally by the Xendit webhook after a paid event's
// listing fee clears.
async function notifyFollowers(admin: ReturnType<typeof createClient>, eventId: string, origin: string) {
  const { data: event } = await admin
    .from("events")
    .select("id, title, event_date, venue, city, tags, status")
    .eq("id", eventId)
    .single();

  if (!event || event.status !== "published" || !event.tags?.length) {
    return { notified: 0 };
  }

  const { data: groups } = await admin
    .from("kpop_groups")
    .select("id")
    .in("name", event.tags);
  const groupIds = (groups ?? []).map((g) => g.id);
  if (groupIds.length === 0) return { notified: 0 };

  const { data: follows } = await admin
    .from("fandom_follows")
    .select("attendee_id")
    .in("kpop_group_id", groupIds);
  const attendeeIds = [...new Set((follows ?? []).map((f) => f.attendee_id))];
  if (attendeeIds.length === 0) return { notified: 0 };

  const eventDate = new Date(event.event_date).toLocaleString("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const eventUrl = `${origin}/events/${event.id}`;

  await Promise.all(
    attendeeIds.map(async (id) => {
      const { data: userAuth } = await admin.auth.admin.getUserById(id);
      if (!userAuth?.user?.email) return;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Fandomly <onboarding@resend.dev>",
          to: userAuth.user.email,
          subject: `New event: ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
              <h2>A fandom you follow just posted an event</h2>
              <p><strong>${event.title}</strong></p>
              <p>${eventDate}<br/>${event.venue}, ${event.city}</p>
              <p><a href="${eventUrl}">View the event</a></p>
            </div>
          `,
        }),
      });
    })
  );

  return { notified: attendeeIds.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, origin } = await req.json();
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: event } = await admin
      .from("events")
      .select("organizer_id")
      .eq("id", event_id)
      .single();
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (!event || (event.organizer_id !== userData.user.id && callerProfile?.role !== "admin")) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await notifyFollowers(admin, event_id, origin);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
