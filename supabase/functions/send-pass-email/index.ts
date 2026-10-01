import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Called right after an organizer confirms a payment, to email the
// attendee their pass (a QR code encoding a check-in URL).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, attendee_id, origin } = await req.json();
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

    // Confirm the caller actually organizes this event (or is an admin).
    const { data: event } = await admin
      .from("events")
      .select("id, title, event_date, venue, city, organizer_id")
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

    const { data: signup } = await admin
      .from("event_signups")
      .select("qr_token, payment_status")
      .eq("event_id", event_id)
      .eq("attendee_id", attendee_id)
      .single();
    const { data: attendeeAuth } = await admin.auth.admin.getUserById(attendee_id);
    const { data: attendeeProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", attendee_id)
      .single();

    if (!signup || signup.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "Signup isn't marked as paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkInUrl = `${origin}/checkin?token=${signup.qr_token}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`;
    const eventDate = new Date(event.event_date).toLocaleString("en-PH", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Fandomly <onboarding@resend.dev>",
        to: attendeeAuth.user.email,
        subject: `Your pass for ${event.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
            <h2>You're confirmed, ${attendeeProfile?.display_name ?? "there"}! 🎉</h2>
            <p><strong>${event.title}</strong></p>
            <p>${eventDate}<br/>${event.venue}, ${event.city}</p>
            <p>Show this QR code at the door, or the organizer can scan it:</p>
            <img src="${qrImageUrl}" alt="Your entry pass" width="250" height="250" />
            <p style="color:#888;font-size:12px;">If the image doesn't load, save this link: ${checkInUrl}</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const details = await resendRes.json();
      return new Response(JSON.stringify({ error: "Failed to send email", details }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("event_signups")
      .update({ pass_email_sent_at: new Date().toISOString() })
      .eq("event_id", event_id)
      .eq("attendee_id", attendee_id);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
