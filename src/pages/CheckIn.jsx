import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function run() {
      if (authLoading) return;
      if (!token) {
        setError("No pass code found in this link.");
        setChecking(false);
        return;
      }
      if (!user) {
        setError("Log in as the event's organizer to check attendees in.");
        setChecking(false);
        return;
      }
      const { data, error } = await supabase.rpc("check_in_attendee", {
        p_qr_token: token,
      });
      if (error) {
        setError(error.message);
      } else {
        setResult(data?.[0] ?? null);
      }
      setChecking(false);
    }
    run();
  }, [token, user, authLoading]);

  return (
    <div className="max-w-sm mx-auto px-5 py-20 text-center">
      {checking ? (
        <p className="text-ink-soft">Checking pass…</p>
      ) : error ? (
        <>
          <p className="font-display text-xl text-coral mb-2">Can't check in</p>
          <p className="text-ink-soft">{error}</p>
        </>
      ) : result?.already_checked_in ? (
        <>
          <p className="font-display text-2xl mb-2">Already checked in</p>
          <p className="text-ink-soft">
            {result.display_name} was already scanned for {result.event_title}.
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-sage mb-2">Checked in ✓</p>
          <p className="text-ink-soft">
            {result?.display_name} is in for {result?.event_title}.
          </p>
        </>
      )}
    </div>
  );
}
