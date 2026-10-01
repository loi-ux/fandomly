import { createClient } from "jsr:@supabase/supabase-js@2";

async function notifyFollowers(admin: ReturnType<typeof createClient>, eventId: string) {
  const origin = Deno.env.get("SITE_URL") ?? "";
  const { data: event } = await admin
    .from("events")
    .select("id, title, event_date, venue, city, tags, status")
    .eq("id", eventId)
    .single();

  if (!event || event.status !== "published" || !event.tags?.length) return;

  const { data: groups } = await admin.from("kpop_groups").select("id").in("name", event.tags);
  const groupIds = (groups ?? []).map((g) => g.id);
  if (groupIds.length === 0) return;

  const { data: follows } = await admin
    .from("fandom_follows")
    .select("attendee_id")
    .in("kpop_group_id", groupIds);
  const attendeeIds = [...new Set((follows ?? []).map((f) => f.attendee_id))];
  if (attendeeIds.length === 0) return;

  const eventDate = new Date(event.event_date).toLocaleString("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const eventUrl = origin ? `${origin}/events/${event.id}` : "";

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
              ${eventUrl ? `<p><a href="${eventUrl}">View the event</a></p>` : ""}
            </div>
          `,
        }),
      });
    })
  );
}

// Xendit calls this directly (no Supabase auth) whenever an invoice's
// status changes. Verified via the callback token Xendit sends.
Deno.serve(async (req) => {
  try {
    const callbackToken = req.headers.get("x-callback-token");
    if (callbackToken !== Deno.env.get("XENDIT_WEBHOOK_TOKEN")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (payload.status === "PAID") {
      const { data: updated } = await admin
        .from("events")
        .update({ listing_fee_status: "paid", status: "published" })
        .eq("listing_fee_invoice_id", payload.id)
        .select("id")
        .single();

      if (updated) {
        await notifyFollowers(admin, updated.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
