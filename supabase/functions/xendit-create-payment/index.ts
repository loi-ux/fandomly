import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LISTING_FEE_PHP = 100;

// Charges the ORGANIZER a flat listing fee to publish a paid event.
// Fandomly keeps 100% of this — no splits, no sub-accounts. Attendee ticket
// payments happen directly between attendee and organizer, outside Xendit.
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
    const user = userData.user;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, title, organizer_id, is_paid")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.organizer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not your event" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!event.is_paid) {
      return new Response(JSON.stringify({ error: "This event isn't marked as paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const xenditSecret = Deno.env.get("XENDIT_SECRET_KEY")!;
    const externalId = `listing_fee_${event.id}_${Date.now()}`;

    const invoiceRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(xenditSecret + ":"),
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: LISTING_FEE_PHP,
        payer_email: user.email,
        description: `Fandomly listing fee — ${event.title}`,
        currency: "PHP",
        success_redirect_url: `${origin}/organizer/edit/${event.id}?listing_fee=success`,
        failure_redirect_url: `${origin}/organizer/edit/${event.id}?listing_fee=failed`,
      }),
    });
    const invoiceData = await invoiceRes.json();

    if (!invoiceRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to create invoice", details: invoiceData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await admin
      .from("events")
      .update({ listing_fee_invoice_id: invoiceData.id })
      .eq("id", event.id);

    return new Response(JSON.stringify({ invoice_url: invoiceData.invoice_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
