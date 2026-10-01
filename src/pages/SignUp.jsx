import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    city: "",
    wantsToOrganize: false,
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signUp(form);
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      navigate("/");
    }
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="font-display text-2xl mb-1">Create your account</h1>
      <p className="text-ink-soft text-sm mb-8">
        {form.wantsToOrganize
          ? "Sign up as an organizer — an admin will review and approve your account before you can publish events."
          : "Sign up to save events and get reminders."}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setForm({ ...form, wantsToOrganize: false })}
          className={`flex-1 text-sm px-3 py-2.5 rounded-full border-2 transition-colors ${
            !form.wantsToOrganize
              ? "bg-ink text-paper border-ink"
              : "border-ink/15 text-ink-soft hover:border-ink"
          }`}
        >
          I'm a fan
        </button>
        <button
          type="button"
          onClick={() => setForm({ ...form, wantsToOrganize: true })}
          className={`flex-1 text-sm px-3 py-2.5 rounded-full border-2 transition-colors ${
            form.wantsToOrganize
              ? "bg-ink text-paper border-ink"
              : "border-ink/15 text-ink-soft hover:border-ink"
          }`}
        >
          I organize events
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            required
            value={form.displayName}
            onChange={update("displayName")}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium">City</label>
          <input
            value={form.city}
            onChange={update("city")}
            placeholder="Cebu City"
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={update("email")}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            required
            type="password"
            minLength={6}
            value={form.password}
            onChange={update("password")}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
        </div>

        {error && <p className="text-coral text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-paper rounded-full py-3 font-medium hover:bg-coral transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="text-xs text-ink-soft mt-4 text-center">
        By signing up, you agree to Fandomly's{" "}
        <Link to="/terms" className="text-coral">Terms of Service</Link> and{" "}
        <Link to="/privacy" className="text-coral">Privacy Policy</Link>.
      </p>

      <p className="text-sm text-ink-soft mt-6 text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-coral font-medium">
          Log in
        </Link>
      </p>
    </div>
  );
}
