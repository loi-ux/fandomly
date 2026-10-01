import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import EventCard from "../components/EventCard";
import { Link } from "react-router-dom";

export default function AttendeeDashboard() {
  const { user, requestOrganizerRole, profile } = useAuth();
  const [signups, setSignups] = useState([]);
  const [requestSent, setRequestSent] = useState(false);
  const [groups, setGroups] = useState([]);
  const [followedIds, setFollowedIds] = useState(new Set());

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("event_signups")
        .select("status, event:events(id, title, event_date, city, venue, banner_url, tags)")
        .eq("attendee_id", user.id);
      setSignups(data ?? []);

      const { data: groupList } = await supabase.from("kpop_groups").select("id, name").order("name");
      setGroups(groupList ?? []);

      const { data: follows } = await supabase
        .from("fandom_follows")
        .select("kpop_group_id")
        .eq("attendee_id", user.id);
      setFollowedIds(new Set((follows ?? []).map((f) => f.kpop_group_id)));
    }
    if (user) load();
  }, [user]);

  async function toggleFollow(groupId) {
    if (followedIds.has(groupId)) {
      await supabase.from("fandom_follows").delete().eq("attendee_id", user.id).eq("kpop_group_id", groupId);
      setFollowedIds((s) => {
        const next = new Set(s);
        next.delete(groupId);
        return next;
      });
    } else {
      await supabase.from("fandom_follows").insert({ attendee_id: user.id, kpop_group_id: groupId });
      setFollowedIds((s) => new Set(s).add(groupId));
    }
  }

  async function handleRequestOrganizer() {
    await requestOrganizerRole();
    setRequestSent(true);
  }

  const going = signups.filter((s) => s.status === "going");
  const interested = signups.filter((s) => s.status === "interested");

  return (
    <div className="max-w-5xl mx-auto px-5 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl">My signups</h1>
        {profile?.role === "attendee" && (
          <button
            onClick={handleRequestOrganizer}
            disabled={requestSent || profile?.organizer_requested}
            className="text-sm border-2 border-ink rounded-full px-4 py-2 hover:border-sky hover:text-sky transition-colors disabled:opacity-50"
          >
            {profile?.organizer_requested || requestSent
              ? "Organizer request pending"
              : "Become an organizer"}
          </button>
        )}
      </div>

      <h2 className="font-display text-xl mb-4">Fandoms you follow</h2>
      <p className="text-sm text-ink-soft mb-3">
        Get emailed the moment any of these post a new event.
      </p>
      <div className="flex flex-wrap gap-2 mb-10">
        {groups.length === 0 ? (
          <p className="text-ink-soft">No groups in the directory yet.</p>
        ) : (
          groups.map((g) => (
            <button
              key={g.id}
              onClick={() => toggleFollow(g.id)}
              className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
                followedIds.has(g.id)
                  ? "bg-ink text-paper"
                  : "border-2 border-ink/15 text-ink-soft hover:border-ink"
              }`}
            >
              {g.name} {followedIds.has(g.id) ? "✓" : ""}
            </button>
          ))
        )}
      </div>

      <h2 className="font-display text-xl mb-4">Going</h2>
      {going.length === 0 ? (
        <p className="text-ink-soft mb-8">
          Nothing yet —{" "}
          <Link to="/events" className="text-sky font-medium">
            browse events
          </Link>{" "}
          to sign up.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {going.map((s) => (
            <EventCard key={s.event.id} event={s.event} />
          ))}
        </div>
      )}

      <h2 className="font-display text-xl mb-4">Interested</h2>
      {interested.length === 0 ? (
        <p className="text-ink-soft">No interested events yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {interested.map((s) => (
            <EventCard key={s.event.id} event={s.event} />
          ))}
        </div>
      )}
    </div>
  );
}
