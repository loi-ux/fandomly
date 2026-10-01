import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await sendPasswordReset(email.trim());
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto px-5 py-16 text-center">
        <h1 className="font-display text-2xl mb-3">Check your email</h1>
        <p className="text-ink-soft">
          If an account exists for <strong>{email}</strong>, we've sent a
          link to reset your password.
        </p>
        <Link to="/login" className="text-sky font-medium mt-6 inline-block">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="font-display text-2xl mb-2">Forgot password</h1>
      <p className="text-ink-soft mb-8">
        Enter your email and we'll send you a link to set a new password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-sky focus:outline-none"
          />
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-paper rounded-full py-3 font-medium hover:bg-sky transition-colors disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="text-sm text-ink-soft mt-6 text-center">
        <Link to="/login" className="text-sky font-medium">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
