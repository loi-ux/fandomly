// Custom event links: fandomly.site/<organizer handle>/<event slug>
// The database enforces the same format and reserved words
// (profiles_handle_format, events_slug_format, reserved_handles), so these
// checks are only for friendly messages before saving.

// Must match the first part of every app route, so a handle can never
// shadow a real page. Keep in sync with public.reserved_handles.
export const RESERVED_HANDLES = new Set([
  "signup", "login", "logout", "forgot-password", "reset-password", "events", "event",
  "organizers", "organizer", "attendee", "attendees", "checkin", "check-in", "privacy",
  "terms", "admin", "assets", "icons", "api", "fandomly", "support", "help", "about",
  "contact", "settings", "account", "profile", "www", "mail", "blog", "static", "app",
  "official", "staff", "team", "dashboard", "new", "edit", "pay", "payment", "payments",
  "xendit", "gcash", "null", "undefined",
]);

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

// Lowercase, spaces/underscores → hyphens, drop anything else.
export function toLinkText(value, maxLength = 60) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/, "");
}

export function handleError(handle) {
  if (!handle) return "Pick a link name.";
  if (handle.length < 3) return "Use at least 3 characters.";
  if (!HANDLE_RE.test(handle)) return "Use letters, numbers and hyphens (not at the start or end).";
  if (RESERVED_HANDLES.has(handle) || handle.startsWith("fandomly")) return "That name is reserved — try another.";
  return null;
}

export function slugError(slug) {
  if (!slug) return null; // optional
  if (!SLUG_RE.test(slug)) return "Use letters, numbers and hyphens (not at the start or end).";
  return null;
}

// Best path for an event: the custom link when it has one, else /events/<id>.
export function eventPath(event, handle) {
  const h = handle ?? event?.organizer?.handle;
  return h && event?.slug ? `/${h}/${event.slug}` : `/events/${event.id}`;
}

export const SITE_HOST = "fandomly.site";
