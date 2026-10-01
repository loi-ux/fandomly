import { Link } from "react-router-dom";

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function EventCard({ event }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="block bg-surface border-2 border-ink/10 rounded-2xl p-5 hover:border-sky transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg leading-tight">{event.title}</p>
          <p className="text-sm text-ink-soft mt-1">
            {formatDate(event.event_date)} · {event.city}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>
        {event.banner_url && (
          <img
            src={event.banner_url}
            alt=""
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        )}
      </div>

      {event.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {event.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs font-medium bg-marigold-dim text-navy px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
