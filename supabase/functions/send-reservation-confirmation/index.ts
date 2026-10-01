import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fired right after an attendee reserves a spot on a paid event — tells
// them their spot is held (not yet confirmed), how to pay, and where to
// come back to upload proof of payment.
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
    if (userError || !userData.user || userData.user.id !== attendee_id) {
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
        "id, title, event_date, venue, city, price_php, payment_methods, gcash_instructions, bank_instructions, qr_reference, payment_qr_url"
      )
      .eq("id", event_id)
      .single();
    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
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
    const eventUrl = `${origin}/events/${event.id}`;

    // Same multi-method block pattern as the payment reminder email.
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
        subject: `You're holding a spot for ${event.title} — pay to confirm`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
            <h2>Hi ${attendeeProfile?.display_name ?? "there"}, your spot is held!</h2>
            <p><strong>${event.title}</strong></p>
            <p>${eventDate}<br/>${event.venue}, ${event.city}</p>
            <p>This spot isn't confirmed yet — pay ₱${event.price_php} using one of the methods below,
            then come back and upload your proof of payment so the organizer can confirm you:</p>
            ${paymentBlock}
            <p style="text-align:center;margin:20px 0;">
              <a href="${eventUrl}" style="background:#13223f;color:#eaf4fb;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">
                Upload proof of payment
              </a>
            </p>
            <p style="color:#888;font-size:12px;">Once the organizer confirms your payment, you'll get a second
            email with your entry pass.</p>
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
