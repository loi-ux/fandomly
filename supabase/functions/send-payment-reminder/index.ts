import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Organizer-triggered nudge for an attendee who reserved a spot on a
// paid event but hasn't been marked as paid yet.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, attendee_id } = await req.json();
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
      .select(
        "id, title, event_date, price_php, payment_methods, gcash_instructions, bank_instructions, qr_reference, payment_qr_url, organizer_id"
      )
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
      .select("payment_status")
      .eq("event_id", event_id)
      .eq("attendee_id", attendee_id)
      .single();
    if (!signup || signup.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "This attendee is already confirmed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: attendeeAuth } = await admin.auth.admin.getUserById(attendee_id);
    const { data: attendeeProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", attendee_id)
      .single();
    if (!attendeeAuth?.user?.email) {
      return new Response(JSON.stringify({ error: "Attendee has no email on file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventDate = new Date(event.event_date).toLocaleString("en-PH", {
      dateStyle: "full",
      timeStyle: "short",
    });

    // An event can offer several ways to pay at once, so stack a block
    // per method the organizer actually configured.
    const methods: string[] = event.payment_methods ?? [];
    const blocks: string[] = [];
    if (methods.includes("qr_code") && event.payment_qr_url) {
      blocks.push(`
        <div style="margin-bottom:12px;">
          <p style="margin:0 0 6px;">Scan this QR code to pay${event.qr_reference ? ` (${event.qr_reference})` : ""}:</p>
          <img src="${event.payment_qr_url}" alt="Payment QR code" width="220" height="220" style="display:block;border-radius:8px;" />
        </div>
      `);
    }
    if (methods.includes("gcash") && event.gcash_instructions) {
      blocks.push(`
        <p style="background:#f4f4f4;padding:12px;border-radius:8px;margin:0 0 12px;">
          <strong>GCash:</strong><br />${event.gcash_instructions.replace(/\n/g, "<br />")}
        </p>
      `);
    }
    if (methods.includes("bank_transfer") && event.bank_instructions) {
      blocks.push(`
        <p style="background:#f4f4f4;padding:12px;border-radius:8px;margin:0 0 12px;">
          <strong>Bank transfer:</strong><br />${event.bank_instructions.replace(/\n/g, "<br />")}
        </p>
      `);
    }
    const paymentBlock =
      blocks.length > 0
        ? blocks.join("")
        : `<p style="background:#f4f4f4;padding:12px;border-radius:8px;">Contact the organizer for payment details.</p>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Fandomly <onboarding@resend.dev>",
        to: attendeeAuth.user.email,
        subject: `Reminder: complete your payment for ${event.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
            <h2>Hi ${attendeeProfile?.display_name ?? "there"}, don't lose your spot!</h2>
            <p><strong>${event.title}</strong> is coming up on ${eventDate}.</p>
            <p>You reserved a spot but haven't completed your ₱${event.price_php} payment yet. Send it soon to confirm your spot and get your entry pass:</p>
            ${paymentBlock}
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
