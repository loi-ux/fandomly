// Registration open/close logic, shared by the event page, editor and
// dashboard. The database enforces the same rules (see
// enforce_registration_window in supabase/schema.sql), so this is only for
// showing the right buttons and messages — not a security boundary.

export function registrationState(event, now = new Date()) {
  if (!event) return { open: false, reason: "closed" };
  if (event.registration_closed) return { open: false, reason: "closed" };

  const opensAt = event.registration_opens_at ? new Date(event.registration_opens_at) : null;
  const closesAt = event.registration_closes_at ? new Date(event.registration_closes_at) : null;

  if (opensAt && now < opensAt) return { open: false, reason: "not_yet", opensAt, closesAt };
  if (closesAt && now >= closesAt) return { open: false, reason: "ended", opensAt, closesAt };
  return { open: true, opensAt, closesAt };
}

// Next moment the open/closed state flips on its own, so pages can re-render
// exactly then instead of polling.
export function nextRegistrationChange(event, now = new Date()) {
  if (!event || event.registration_closed) return null;
  const times = [event.registration_opens_at, event.registration_closes_at]
    .filter(Boolean)
    .map((t) => new Date(t))
    .filter((t) => t > now)
    .sort((a, b) => a - b);
  return times[0] ?? null;
}

export function formatRegistrationTime(date) {
  return new Date(date).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// <input type="datetime-local"> works in the browser's local time with no
// zone; these convert to/from real timestamps so scheduled times are
// correct regardless of the database's timezone.
export function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value) {
  return value ? new Date(value).toISOString() : null;
}
