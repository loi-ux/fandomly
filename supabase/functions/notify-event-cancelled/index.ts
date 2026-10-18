import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Emails everyone who signed up (going or interested) once an organizer
// cancels their event, including the organizer's own custom message.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id } = await req.json();
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
      .select("id, title, event_date, venue, city, organizer_id, cancellation_message, status")
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
    if (event.status !== "cancelled") {
      return new Response(JSON.stringify({ error: "Event is not marked as cancelled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signups } = await admin
      .from("event_signups")
      .select("attendee_id")
      .eq("event_id", event_id);
    const attendeeIds = [...new Set((signups ?? []).map((s) => s.attendee_id))];

    const eventDate = new Date(event.event_date).toLocaleString("en-PH", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Manila",
    });
    const message = event.cancellation_message?.trim() ||
      "The organizer has cancelled this event. We're sorry for the inconvenience.";

    let sent = 0;
    await Promise.all(
      attendeeIds.map(async (id) => {
        const { data: userAuth } = await admin.auth.admin.getUserById(id);
        if (!userAuth?.user?.email) return;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          },
          body: JSON.stringify({
            from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Fandomly <onboarding@resend.dev>",
            to: userAuth.user.email,
            subject: `Cancelled: ${event.title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
                <h2>This event has been cancelled</h2>
                <p><strong>${event.title}</strong></p>
                <p>Was scheduled for ${eventDate} at ${event.venue}, ${event.city}.</p>
                <p style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap;">${message}</p>
              </div>
            `,
          }),
        });
        if (res.ok) sent++;
      })
    );

    return new Response(JSON.stringify({ notified: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
