import { lazy, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const EventDetail = lazy(() => import("./EventDetail"));
const OrganizerProfile = lazy(() => import("./OrganizerProfile"));

function NotFound() {
  return (
    <div className="text-center py-20 px-5">
      <p className="font-display text-2xl mb-2">Page not found</p>
      <p className="text-ink-soft mb-6">This link doesn't match any organizer or event.</p>
      <Link to="/events" className="text-accent font-medium">
        Browse events
      </Link>
    </div>
  );
}

// fandomly.site/<handle>            → that organizer's profile
// fandomly.site/<handle>/<slug>     → that organizer's event
export default function CustomLink() {
  const { handle, slug } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      setState({ loading: true });
      const h = handle?.toLowerCase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", h)
        .maybeSingle();
      if (!profile) {
        if (!cancelled) setState({ loading: false });
        return;
      }
      if (!slug) {
        if (!cancelled) setState({ loading: false, organizerId: profile.id });
        return;
      }
      const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("organizer_id", profile.id)
        .eq("slug", slug.toLowerCase())
        .maybeSingle();
      if (!cancelled) setState({ loading: false, eventId: event?.id });
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [handle, slug]);

  if (state.loading) return <p className="text-center py-16 text-ink-soft">Loading…</p>;
  if (state.eventId) return <EventDetail eventId={state.eventId} />;
  if (state.organizerId) return <OrganizerProfile organizerId={state.organizerId} />;
  return <NotFound />;
}
