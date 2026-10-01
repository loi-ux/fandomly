import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import EventCard from "../components/EventCard";

export default function Landing() {
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    async function loadUpcoming() {
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date, city, venue, banner_url, tags")
        .eq("status", "published")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(6);
      setUpcoming(data ?? []);
    }
    loadUpcoming();
  }, []);

  return (
    <div>
      <section className="max-w-5xl mx-auto px-5 pt-16 pb-20 text-center">
        <p className="text-coral font-semibold mb-3">Cebu fandom events</p>
        <h1 className="font-display text-4xl md:text-6xl leading-[1.05] max-w-3xl mx-auto">
          Every fan project, birthday cafe, and meetup in one place.
        </h1>
        <p className="text-ink-soft mt-5 max-w-xl mx-auto">
          Fandomly tracks the events Cebu fans organize for the groups and
          artists they love — cup sleeve events, fanmeets, birthday cafes,
          and more. Find what's near you, or post your own.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link
            to="/events"
            className="bg-ink text-paper rounded-full px-6 py-3 font-medium hover:bg-coral transition-colors"
          >
            Browse events
          </Link>
          <Link
            to="/signup"
            className="border-2 border-ink rounded-full px-6 py-3 font-medium hover:border-coral hover:text-coral transition-colors"
          >
            Sign up free
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-24">
        <div className="stub-divider pt-10 mb-8">
          <h2 className="font-display text-2xl mt-6">Coming up</h2>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-ink-soft">
            No published events yet — be the first to post one.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
