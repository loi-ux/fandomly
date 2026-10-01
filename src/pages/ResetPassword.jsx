import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

// Reached from the "reset your password" email link. Supabase's client
// parses the recovery token out of the URL automatically and establishes a
// session for it, firing a PASSWORD_RECOVERY auth event — we just wait for
// that (or an existing session) before letting them set a new password.
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/"), 1500);
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-5 py-16 text-center">
        <h1 className="font-display text-2xl mb-3">Password set ✓</h1>
        <p className="text-ink-soft">Taking you to Fandomly…</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="max-w-sm mx-auto px-5 py-16 text-center">
        <h1 className="font-display text-2xl mb-3">Reset link</h1>
        <p className="text-ink-soft">
          Open this page from the link in your password reset email. If
          you're seeing this after clicking that link, it may have expired —{" "}
          <Link to="/forgot-password" className="text-sky font-medium">
            request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="font-display text-2xl mb-2">Set a new password</h1>
      <p className="text-ink-soft mb-8">
        Choose a password you'll use to log in to Fandomly from now on.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">New password</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-sky focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Confirm password</label>
          <input
            required
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-sky focus:outline-none"
          />
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-paper rounded-full py-3 font-medium hover:bg-sky transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Set password"}
        </button>
      </form>
    </div>
  );
}
