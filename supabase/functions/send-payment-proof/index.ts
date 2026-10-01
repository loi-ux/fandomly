import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Attendee-triggered: fires right after they upload a payment screenshot,
// emailing it straight to the organizer so they don't have to go looking
// for it on the dashboard to confirm the spot.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, proof_path } = await req.json();
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

    // The uploaded path must belong to this attendee — no emailing someone
    // else's screenshot by guessing a path.
    const pathAttendeeId = proof_path.split("/")[1];
    if (pathAttendeeId !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: event } = await admin
      .from("events")
      .select("id, title, price_php, organizer_id")
      .eq("id", event_id)
      .single();
    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: organizerAuth } = await admin.auth.admin.getUserById(event.organizer_id);
    if (!organizerAuth?.user?.email) {
      return new Response(JSON.stringify({ error: "Organizer has no email on file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: attendeeProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", userData.user.id)
      .single();

    const { data: fileBlob, error: downloadError } = await admin.storage
      .from("payment-proofs")
      .download(proof_path);
    if (downloadError || !fileBlob) {
      return new Response(JSON.stringify({ error: "Could not read the uploaded file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    // Spreading the whole byte array into String.fromCharCode(...) blows the
    // call stack for any real phone photo (a few MB easily exceeds the
    // argument limit) — build the binary string in chunks instead.
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const filename = proof_path.split("/").pop() || "proof-of-payment";

    async function sendEmail() {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Fandomly <onboarding@resend.dev>",
          to: organizerAuth.user.email,
          subject: `Proof of payment: ${attendeeProfile?.display_name ?? "An attendee"} — ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
              <h2>New proof of payment</h2>
              <p><strong>${attendeeProfile?.display_name ?? "An attendee"}</strong> just uploaded proof of
              payment for <strong>${event.title}</strong> (₱${event.price_php}).</p>
              <p>It's attached to this email, and also saved on their signup in your Fandomly attendee list.</p>
              <p>Once you've checked it, mark them as paid from the event's attendee list so they get their
              entry pass.</p>
            </div>
          `,
          attachments: [{ filename, content: base64 }],
        }),
      });
      if (res.ok) return { ok: true as const };
      const details = await res.json().catch(() => ({}));
      return { ok: false as const, details };
    }

    // A flaky connection to Resend shouldn't need the attendee to notice
    // and manually hit "retry" themselves — try a couple more times first,
    // with a short backoff, before giving up.
    let lastDetails: unknown = null;
    let sent = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1000));
      const result = await sendEmail();
      if (result.ok) {
        sent = true;
        break;
      }
      lastDetails = result.details;
    }

    if (!sent) {
      await admin.from("notification_failures").insert({
        kind: "payment_proof",
        event_id: event.id,
        attendee_id: userData.user.id,
        error_message: JSON.stringify(lastDetails).slice(0, 2000),
      });
      return new Response(JSON.stringify({ error: "Failed to send email", details: lastDetails }), {
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
