import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import EventCard from "../components/EventCard";

// Great-circle distance in km between two lat/lng points.
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function BrowseEvents() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date, city, venue, lat, lng, banner_url, tags")
        .eq("status", "published")
        .order("event_date", { ascending: true });
      setEvents(data ?? []);
    }
    loadEvents();
  }, []);

  function findNearMe() {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setLocationError("Couldn't get your location — check permissions.")
    );
  }

  const cities = [...new Set(events.map((e) => e.city).filter(Boolean))];

  let visible = events.filter((e) => {
    const matchesSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCity = !cityFilter || e.city === cityFilter;
    return matchesSearch && matchesCity;
  });

  if (userLocation) {
    visible = visible
      .map((e) => ({
        ...e,
        distance:
          e.lat && e.lng
            ? distanceKm(userLocation.lat, userLocation.lng, e.lat, e.lng)
            : null,
      }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-12">
      <h1 className="font-display text-3xl mb-6">Browse events</h1>

      <div className="flex flex-wrap gap-3 mb-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or artist tag…"
          className="border-2 border-ink/15 rounded-full px-4 py-2 flex-1 min-w-[200px] focus:border-sky focus:outline-none"
        />
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="border-2 border-ink/15 rounded-full px-4 py-2 focus:border-sky focus:outline-none"
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        <button
          onClick={findNearMe}
          className="border-2 border-ink rounded-full px-4 py-2 font-medium hover:border-sky hover:text-sky transition-colors"
        >
          Nearest to me
        </button>
      </div>

      {locationError && (
        <p className="text-danger text-sm mb-4">{locationError}</p>
      )}
      {userLocation && (
        <p className="text-sm text-ink-soft mb-4">
          Sorted by distance from your location.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-ink-soft">No events match yet — check back soon.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((event) => (
            <div key={event.id}>
              <EventCard event={event} />
              {event.distance != null && (
                <p className="text-xs text-ink-soft mt-1 ml-1">
                  ~{event.distance.toFixed(1)} km away
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
