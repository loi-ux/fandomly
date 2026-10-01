import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lets someone sign up for an event on the spot, without having created a
// Fandomly account first. We create a real auth.users account for them
// (email-confirmed, no verification step, matching the "fastest" flow the
// organizer chose) with a one-time random password, and hand that password
// back ONLY so the browser can immediately sign in with it in the same
// request cycle — it is never stored, logged, or emailed anywhere. If an
// account already exists for that email, we refuse to touch it and tell
// the caller to log in instead, so no one can hijack an existing account
// just by typing someone else's email address here.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, display_name } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "A valid email is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedEmail = email.trim().toLowerCase();
    const onetimePassword = crypto.randomUUID() + crypto.randomUUID();

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: onetimePassword,
      email_confirm: true,
      user_metadata: {
        display_name: (display_name || "").trim() || normalizedEmail.split("@")[0],
        guest_signup: true,
      },
    });

    if (error) {
      // "already registered" (or similar) means there's an existing
      // account — don't silently take it over.
      const alreadyExists =
        error.status === 422 ||
        /already|exists|registered/i.test(error.message || "");
      if (alreadyExists) {
        return new Response(JSON.stringify({ error: "account_exists" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ user_id: data.user.id, password: onetimePassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
