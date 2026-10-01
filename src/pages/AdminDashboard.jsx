import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminDashboard() {
  const [pendingOrganizers, setPendingOrganizers] = useState([]);
  const [pendingListingFees, setPendingListingFees] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newGroup, setNewGroup] = useState("");
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [topFandoms, setTopFandoms] = useState([]);
  const [topOrganizers, setTopOrganizers] = useState([]);
  const [notificationFailures, setNotificationFailures] = useState([]);

  async function loadAll() {
    const [
      { data: pending },
      { data: feeQueue },
      { data: organizerList },
      { data: groupList },
      { data: eventList },
      { count: paidListingCount },
      { count: publishedCount },
      { count: totalSignups },
      { count: goingCount },
      { count: checkedInCount },
      { data: fandomFollowRows },
      { data: organizerFollowRows },
      { data: failures },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, city")
        .eq("organizer_requested", true)
        .eq("role", "attendee"),
      supabase
        .from("events")
        .select("id, title, price_php, organizer:profiles!events_organizer_id_fkey(display_name)")
        .eq("is_paid", true)
        .eq("listing_fee_status", "pending"),
      supabase
        .from("profiles")
        .select("id, display_name, free_listing_credits")
        .eq("role", "organizer")
        .order("display_name"),
      supabase.from("kpop_groups").select("id, name").order("name"),
      supabase
        .from("events")
        .select("id, title, status, city, event_date")
        .order("event_date", { ascending: false })
        .limit(20),
      supabase.from("events").select("*", { count: "exact", head: true }).eq("listing_fee_status", "paid"),
      supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("event_signups").select("*", { count: "exact", head: true }),
      supabase.from("event_signups").select("*", { count: "exact", head: true }).eq("status", "going"),
      supabase.from("event_signups").select("*", { count: "exact", head: true }).eq("checked_in", true),
      supabase.from("fandom_follows").select("kpop_group_id"),
      supabase.from("organizer_follows").select("organizer_id"),
      supabase
        .from("notification_failures")
        .select(
          "id, kind, error_message, created_at, event:events(title), attendee:profiles!notification_failures_attendee_id_fkey(display_name)"
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setNotificationFailures(failures ?? []);
    setPendingOrganizers(pending ?? []);
    setPendingListingFees(feeQueue ?? []);
    setOrganizers(organizerList ?? []);
    setGroups(groupList ?? []);
    setEvents(eventList ?? []);
    setStats({
      revenue: (paidListingCount ?? 0) * 100,
      publishedCount: publishedCount ?? 0,
      totalSignups: totalSignups ?? 0,
      checkInRate: goingCount ? Math.round(((checkedInCount ?? 0) / goingCount) * 100) : null,
    });

    const fandomCounts = {};
    (fandomFollowRows ?? []).forEach((f) => {
      fandomCounts[f.kpop_group_id] = (fandomCounts[f.kpop_group_id] ?? 0) + 1;
    });
    const fandomsWithCounts = (groupList ?? [])
      .map((g) => ({ ...g, count: fandomCounts[g.id] ?? 0 }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setTopFandoms(fandomsWithCounts);

    const organizerCounts = {};
    (organizerFollowRows ?? []).forEach((f) => {
      organizerCounts[f.organizer_id] = (organizerCounts[f.organizer_id] ?? 0) + 1;
    });
    const organizersWithCounts = (organizerList ?? [])
      .map((o) => ({ ...o, count: organizerCounts[o.id] ?? 0 }))
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setTopOrganizers(organizersWithCounts);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function approveOrganizer(userId) {
    await supabase.rpc("approve_organizer", { p_user_id: userId });
    loadAll();
  }

  async function confirmListingFee(eventId) {
    await supabase
      .from("events")
      .update({ listing_fee_status: "paid", status: "published" })
      .eq("id", eventId);
    await supabase.functions.invoke("notify-fandom-followers", {
      body: { event_id: eventId, origin: window.location.origin },
    });
    loadAll();
  }

  async function grantFreeListing(organizerId) {
    await supabase.rpc("grant_free_listing_credit", { p_organizer_id: organizerId, p_amount: 1 });
    loadAll();
  }

  async function addGroup(e) {
    e.preventDefault();
    if (!newGroup.trim()) return;
    await supabase.from("kpop_groups").insert({ name: newGroup.trim() });
    setNewGroup("");
    loadAll();
  }

  async function removeGroup(groupId) {
    await supabase.from("kpop_groups").delete().eq("id", groupId);
    loadAll();
  }

  async function removeEvent(eventId) {
    await supabase.from("events").delete().eq("id", eventId);
    loadAll();
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-12 space-y-14">
      <h1 className="font-display text-3xl">Admin</h1>

      <section>
        <h2 className="font-display text-xl mb-4">Overview</h2>
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="border-2 border-ink/10 rounded-2xl p-4">
              <p className="text-2xl font-display">₱{stats.revenue}</p>
              <p className="text-xs text-ink-soft mt-1">Listing fee revenue</p>
            </div>
            <div className="border-2 border-ink/10 rounded-2xl p-4">
              <p className="text-2xl font-display">{stats.publishedCount}</p>
              <p className="text-xs text-ink-soft mt-1">Published events</p>
            </div>
            <div className="border-2 border-ink/10 rounded-2xl p-4">
              <p className="text-2xl font-display">{stats.totalSignups}</p>
              <p className="text-xs text-ink-soft mt-1">Total signups</p>
            </div>
            <div className="border-2 border-ink/10 rounded-2xl p-4">
              <p className="text-2xl font-display">
                {stats.checkInRate === null ? "—" : `${stats.checkInRate}%`}
              </p>
              <p className="text-xs text-ink-soft mt-1">Check-in rate</p>
            </div>
          </div>
        )}

        {(topFandoms.length > 0 || topOrganizers.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4">
            {topFandoms.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Most followed fandoms</p>
                <div className="space-y-1.5">
                  {topFandoms.map((f) => (
                    <div key={f.id} className="flex justify-between text-sm">
                      <span>{f.name}</span>
                      <span className="text-ink-soft">{f.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {topOrganizers.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Most followed organizers</p>
                <div className="space-y-1.5">
                  {topOrganizers.map((o) => (
                    <div key={o.id} className="flex justify-between text-sm">
                      <span>{o.display_name}</span>
                      <span className="text-ink-soft">{o.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {notificationFailures.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-4">Emails that failed to send</h2>
          <div className="space-y-3">
            {notificationFailures.map((f) => (
              <div
                key={f.id}
                className="border-2 border-danger bg-danger-dim rounded-2xl px-5 py-3 text-navy"
              >
                <p className="font-medium">
                  {f.kind === "payment_proof" ? "Proof-of-payment notification" : f.kind}
                  {f.attendee?.display_name ? ` — ${f.attendee.display_name}` : ""}
                  {f.event?.title ? ` (${f.event.title})` : ""}
                </p>
                <p className="text-xs text-navy/70 mt-1">
                  {new Date(f.created_at).toLocaleString("en-PH")}
                </p>
                {f.error_message && (
                  <p className="text-xs text-navy/70 mt-1 font-mono break-all">{f.error_message}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl mb-4">
          Pending organizer requests
        </h2>
        {pendingOrganizers.length === 0 ? (
          <p className="text-ink-soft">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingOrganizers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-2 border-ink/10 rounded-2xl px-5 py-3"
              >
                <div>
                  <p className="font-medium">{p.display_name}</p>
                  <p className="text-sm text-ink-soft">{p.city}</p>
                </div>
                <button
                  onClick={() => approveOrganizer(p.id)}
                  className="bg-sage-dark text-white rounded-full px-4 py-2 text-sm font-medium hover:opacity-90"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl mb-4">Listing fees to confirm</h2>
        {pendingListingFees.length === 0 ? (
          <p className="text-ink-soft">Nothing waiting on you right now.</p>
        ) : (
          <div className="space-y-3">
            {pendingListingFees.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between border-2 border-marigold bg-marigold-dim text-navy rounded-2xl px-5 py-3"
              >
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm">
                    {event.organizer?.display_name} says they sent ₱100
                  </p>
                </div>
                <button
                  onClick={() => confirmListingFee(event.id)}
                  className="bg-ink text-paper rounded-full px-4 py-2 text-sm font-medium hover:bg-sky transition-colors"
                >
                  Confirm & publish
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl mb-4">Organizers — free listing credits</h2>
        {organizers.length === 0 ? (
          <p className="text-ink-soft">No organizers yet.</p>
        ) : (
          <div className="space-y-3">
            {organizers.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between border-2 border-ink/10 rounded-2xl px-5 py-3"
              >
                <div>
                  <p className="font-medium">{o.display_name}</p>
                  <p className="text-sm text-ink-soft">
                    {o.free_listing_credits} free listing{o.free_listing_credits === 1 ? "" : "s"} available
                  </p>
                </div>
                <button
                  onClick={() => grantFreeListing(o.id)}
                  className="bg-ink text-paper rounded-full px-4 py-2 text-sm font-medium hover:bg-sky transition-colors"
                >
                  + Grant free listing
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl mb-4">Kpop group directory</h2>
        <form onSubmit={addGroup} className="flex gap-2 mb-4">
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="Add a group or artist (e.g. TXT)"
            className="border-2 border-ink/15 rounded-full px-4 py-2 flex-1 focus:border-sky focus:outline-none"
          />
          <button
            type="submit"
            className="bg-ink text-paper rounded-full px-5 py-2 font-medium hover:bg-sky transition-colors"
          >
            Add
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <span
              key={g.id}
              className="text-sm bg-marigold-dim text-navy pl-3 pr-1.5 py-1.5 rounded-full flex items-center gap-1.5"
            >
              {g.name}
              <button
                onClick={() => removeGroup(g.id)}
                className="text-navy/60 hover:text-sky text-xs font-bold px-1"
                title="Remove group"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl mb-4">Recent events</h2>
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between border-2 border-ink/10 rounded-2xl px-5 py-3"
            >
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-ink-soft">
                  {event.status} · {event.city}
                </p>
              </div>
              <button
                onClick={() => removeEvent(event.id)}
                className="text-sky text-sm font-medium hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
