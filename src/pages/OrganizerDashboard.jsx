import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const statusStyles = {
  draft: "bg-paper-dim text-navy",
  published: "bg-sage-dim text-sage-dark",
  cancelled: "bg-coral/20 text-coral",
};

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date, city, status, is_paid, price_php, listing_fee_status")
        .eq("organizer_id", user.id)
        .order("event_date", { ascending: false });
      setEvents(data ?? []);

      const eventIds = (data ?? []).map((e) => e.id);
      const priceByEvent = Object.fromEntries((data ?? []).map((e) => [e.id, e.price_php]));

      const { data: signups } = eventIds.length
        ? await supabase
            .from("event_signups")
            .select("event_id, status, payment_status, waitlisted, checked_in")
            .in("event_id", eventIds)
        : { data: [] };

      const confirmed = (signups ?? []).filter((s) => s.status === "going" && !s.waitlisted);
      const revenue = confirmed.reduce((sum, s) => {
        if (s.payment_status === "paid") return sum + Number(priceByEvent[s.event_id] || 0);
        return sum;
      }, 0);
      const checkedIn = confirmed.filter((s) => s.checked_in).length;

      setStats({
        publishedCount: (data ?? []).filter((e) => e.status === "published").length,
        totalConfirmed: confirmed.length,
        revenue,
        checkInRate: confirmed.length ? Math.round((checkedIn / confirmed.length) * 100) : null,
      });
    }
    if (user) load();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-3xl">My events</h1>
        <Link
          to="/organizer/new"
          className="bg-ink text-paper rounded-full px-5 py-2.5 font-medium hover:bg-coral transition-colors"
        >
          + New event
        </Link>
      </div>
      <Link to={`/organizers/${user.id}`} className="text-sm text-coral hover:underline">
        View your public profile
      </Link>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="border-2 border-ink/10 rounded-2xl p-4">
            <p className="text-2xl font-display">{stats.publishedCount}</p>
            <p className="text-xs text-ink-soft mt-1">Published events</p>
          </div>
          <div className="border-2 border-ink/10 rounded-2xl p-4">
            <p className="text-2xl font-display">{stats.totalConfirmed}</p>
            <p className="text-xs text-ink-soft mt-1">Confirmed attendees</p>
          </div>
          <div className="border-2 border-ink/10 rounded-2xl p-4">
            <p className="text-2xl font-display">₱{stats.revenue}</p>
            <p className="text-xs text-ink-soft mt-1">Revenue collected</p>
          </div>
          <div className="border-2 border-ink/10 rounded-2xl p-4">
            <p className="text-2xl font-display">
              {stats.checkInRate === null ? "—" : `${stats.checkInRate}%`}
            </p>
            <p className="text-xs text-ink-soft mt-1">Check-in rate</p>
          </div>
        </div>
      )}

      <div className="mt-8">
      {events.length === 0 ? (
        <p className="text-ink-soft">You haven't created any events yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between border-2 border-ink/10 rounded-2xl px-5 py-4"
            >
              <Link to={`/organizer/edit/${event.id}`} className="flex-1 hover:text-coral">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-ink-soft">
                  {new Date(event.event_date).toLocaleDateString("en-PH")} ·{" "}
                  {event.city}
                  {event.is_paid && ` · ₱${event.price_php}`}
                </p>
              </Link>

              <div className="flex items-center gap-3">
                {event.is_paid && (
                  <Link
                    to={`/organizer/attendees/${event.id}`}
                    className="text-sm font-medium text-coral hover:underline"
                  >
                    Attendees
                  </Link>
                )}
                {event.is_paid && !["paid", "waived"].includes(event.listing_fee_status) ? (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-marigold-dim text-navy">
                    fee unpaid
                  </span>
                ) : (
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${statusStyles[event.status]}`}
                  >
                    {event.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
