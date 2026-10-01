import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import EventCard from "../components/EventCard";

export default function OrganizerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [editingBio, setEditingBio] = useState("");
  const [saving, setSaving] = useState(false);

  const isOwnProfile = user?.id === id;

  async function load() {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, display_name, city, bio, role")
      .eq("id", id)
      .single();
    setProfile(profileData);
    setEditingBio(profileData?.bio ?? "");

    const { data: eventData } = await supabase
      .from("events")
      .select("id, title, event_date, city, venue, banner_url, tags")
      .eq("organizer_id", id)
      .eq("status", "published")
      .order("event_date", { ascending: false })
      .limit(12);
    setEvents(eventData ?? []);

    const { count } = await supabase
      .from("organizer_follows")
      .select("*", { count: "exact", head: true })
      .eq("organizer_id", id);
    setFollowerCount(count ?? 0);

    const { data: reviewData } = await supabase
      .from("organizer_reviews")
      .select("rating, comment, created_at, attendee:profiles!organizer_reviews_attendee_id_fkey(display_name)")
      .eq("organizer_id", id)
      .order("created_at", { ascending: false });
    setReviews(reviewData ?? []);

    if (user && !isOwnProfile) {
      const { data: follow } = await supabase
        .from("organizer_follows")
        .select("organizer_id")
        .eq("follower_id", user.id)
        .eq("organizer_id", id)
        .maybeSingle();
      setIsFollowing(Boolean(follow));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function toggleFollow() {
    if (!user) return;
    if (isFollowing) {
      await supabase.from("organizer_follows").delete().eq("follower_id", user.id).eq("organizer_id", id);
      setIsFollowing(false);
      setFollowerCount((c) => c - 1);
    } else {
      await supabase.from("organizer_follows").insert({ follower_id: user.id, organizer_id: id });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
  }

  async function saveBio() {
    setSaving(true);
    await supabase.from("profiles").update({ bio: editingBio }).eq("id", id);
    setSaving(false);
    load();
  }

  if (!profile) return <p className="text-center py-16 text-ink-soft">Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-display text-3xl mb-1">{profile.display_name}</h1>
          <p className="text-ink-soft">
            {profile.city}
            {profile.city && " · "}
            {followerCount} follower{followerCount === 1 ? "" : "s"}
            {reviews.length > 0 &&
              ` · ${(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)} ★ (${reviews.length})`}
          </p>
        </div>
        {!isOwnProfile && user && (
          <button
            onClick={toggleFollow}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isFollowing
                ? "bg-ink text-paper"
                : "border-2 border-ink hover:border-sky hover:text-sky"
            }`}
          >
            {isFollowing ? "Following ✓" : "Follow"}
          </button>
        )}
      </div>

      {isOwnProfile ? (
        <div className="mt-6 mb-10">
          <label className="text-sm font-medium">Your public bio</label>
          <textarea
            rows={3}
            value={editingBio}
            onChange={(e) => setEditingBio(e.target.value)}
            placeholder="Tell fans a bit about the events you run…"
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-sky focus:outline-none"
          />
          <button
            onClick={saveBio}
            disabled={saving}
            className="mt-2 text-sm bg-ink text-paper rounded-full px-4 py-2 font-medium hover:bg-sky transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save bio"}
          </button>
        </div>
      ) : (
        profile.bio && <p className="text-ink-soft mt-4 mb-10 whitespace-pre-wrap">{profile.bio}</p>
      )}

      <h2 className="font-display text-xl mb-4">Published events</h2>
      {events.length === 0 ? (
        <p className="text-ink-soft">No published events yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl mb-4">Reviews</h2>
          <div className="space-y-3">
            {reviews.map((r, i) => (
              <div key={i} className="border-2 border-ink/10 rounded-2xl p-4">
                <p className="text-marigold">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </p>
                {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
                <p className="text-xs text-ink-soft mt-1">
                  {r.attendee?.display_name ?? "Anonymous"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
