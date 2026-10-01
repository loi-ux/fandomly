import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

function toIcsDate(dateStr) {
  return new Date(dateStr).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function downloadIcs(event) {
  const start = toIcsDate(event.event_date);
  const end = toIcsDate(new Date(new Date(event.event_date).getTime() + 2 * 60 * 60 * 1000));
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${event.id}@fandomly.site`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.venue}, ${event.city}`,
    `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function googleCalendarUrl(event) {
  const start = toIcsDate(event.event_date);
  const end = toIcsDate(new Date(new Date(event.event_date).getTime() + 2 * 60 * 60 * 1000));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    location: `${event.venue}, ${event.city}`,
    details: event.description || "",
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [signup, setSignup] = useState(null); // { status, payment_status, qr_token, waitlisted, checked_in } | null
  const [goingCount, setGoingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [tagGroups, setTagGroups] = useState([]);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [responses, setResponses] = useState({});
  const [formError, setFormError] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  async function loadSignup() {
    if (!user) return;
    const { data } = await supabase
      .from("event_signups")
      .select("status, payment_status, qr_token, custom_field_responses, waitlisted, checked_in")
      .eq("event_id", id)
      .eq("attendee_id", user.id)
      .maybeSingle();
    setSignup(data ?? null);
    if (data?.custom_field_responses) setResponses(data.custom_field_responses);
  }

  useEffect(() => {
    async function load() {
      const { data: eventData } = await supabase
        .from("events")
        .select("*, organizer:profiles!events_organizer_id_fkey(id, display_name)")
        .eq("id", id)
        .single();
      setEvent(eventData);

      if (eventData?.capacity) {
        const { count } = await supabase
          .from("event_signups")
          .select("*", { count: "exact", head: true })
          .eq("event_id", id)
          .eq("status", "going")
          .eq("waitlisted", false);
        setGoingCount(count ?? 0);
      }

      if (eventData?.tags?.length) {
        const { data: groups } = await supabase
          .from("kpop_groups")
          .select("id, name")
          .in("name", eventData.tags);
        setTagGroups(groups ?? []);

        if (user && groups?.length) {
          const { data: follows } = await supabase
            .from("fandom_follows")
            .select("kpop_group_id")
            .eq("attendee_id", user.id)
            .in("kpop_group_id", groups.map((g) => g.id));
          setFollowedIds(new Set((follows ?? []).map((f) => f.kpop_group_id)));
        }
      }

      await loadSignup();

      if (user) {
        const { data: review } = await supabase
          .from("organizer_reviews")
          .select("id, rating, comment")
          .eq("event_id", id)
          .eq("attendee_id", user.id)
          .maybeSingle();
        setExistingReview(review ?? null);
      }

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function toggleFollow(groupId) {
    if (!user) return;
    if (followedIds.has(groupId)) {
      await supabase
        .from("fandom_follows")
        .delete()
        .eq("attendee_id", user.id)
        .eq("kpop_group_id", groupId);
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

  function validateResponses() {
    for (const field of event.custom_fields ?? []) {
      if (field.required && !responses[field.id]?.trim()) {
        setFormError(`Please answer: ${field.label}`);
        return false;
      }
    }
    setFormError(null);
    return true;
  }

  function isFull() {
    return Boolean(event.capacity) && goingCount >= event.capacity;
  }

  async function handleFreeSignup(status) {
    if (!user) return;
    if (status === "going" && !validateResponses()) return;
    const willWaitlist = status === "going" && isFull();
    const { error } = await supabase.from("event_signups").upsert(
      {
        event_id: id,
        attendee_id: user.id,
        status,
        custom_field_responses: responses,
        waitlisted: willWaitlist,
      },
      { onConflict: "event_id,attendee_id" }
    );
    if (error) {
      setFormError(error.message);
      return;
    }
    setSignup((s) => ({ ...s, status, waitlisted: willWaitlist }));
  }

  async function handleReserve() {
    if (!user) return;
    if (!validateResponses()) return;
    setReserving(true);
    const willWaitlist = isFull();
    const { error } = await supabase.from("event_signups").upsert(
      {
        event_id: id,
        attendee_id: user.id,
        status: "going",
        custom_field_responses: responses,
        waitlisted: willWaitlist,
      },
      { onConflict: "event_id,attendee_id" }
    );
    setReserving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    await loadSignup();
  }

  async function handleSubmitReview() {
    if (!user || !event) return;
    setSubmittingReview(true);
    const { error } = await supabase.from("organizer_reviews").insert({
      event_id: id,
      organizer_id: event.organizer_id,
      attendee_id: user.id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });
    setSubmittingReview(false);
    if (!error) {
      setExistingReview({ rating: reviewRating, comment: reviewComment });
    }
  }

  if (loading) return <p className="text-center py-16 text-ink-soft">Loading…</p>;
  if (!event) return <p className="text-center py-16 text-ink-soft">Event not found.</p>;

  const isPaid = event.is_paid;
  const hasReserved = Boolean(signup);
  const isWaitlisted = signup?.waitlisted;
  const isConfirmed = isPaid ? signup?.payment_status === "paid" : signup?.status === "going" && !isWaitlisted;
  const isPastEvent = new Date(event.event_date) < new Date();
  const qrImageUrl = signup?.qr_token
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        `${window.location.origin}/checkin?token=${signup.qr_token}`
      )}`
    : null;

  const customFieldsForm = event.custom_fields?.length > 0 && !hasReserved && (
    <div className="border-2 border-ink/10 rounded-2xl p-4 mb-4 space-y-3">
      {event.custom_fields.map((field) => (
        <div key={field.id}>
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-coral"> *</span>}
          </label>
          {field.type === "textarea" ? (
            <textarea
              rows={2}
              value={responses[field.id] ?? ""}
              onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
              className="mt-1 w-full border-2 border-ink/15 rounded-lg px-3 py-1.5 text-sm focus:border-coral focus:outline-none"
            />
          ) : field.type === "select" ? (
            <select
              value={responses[field.id] ?? ""}
              onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
              className="mt-1 w-full border-2 border-ink/15 rounded-lg px-3 py-1.5 text-sm focus:border-coral focus:outline-none"
            >
              <option value="">Select…</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              value={responses[field.id] ?? ""}
              onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
              className="mt-1 w-full border-2 border-ink/15 rounded-lg px-3 py-1.5 text-sm focus:border-coral focus:outline-none"
            />
          )}
        </div>
      ))}
      {formError && <p className="text-coral text-sm">{formError}</p>}
    </div>
  );

  const calendarButtons = isConfirmed && !isPastEvent && (
    <div className="flex gap-3 mt-4">
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className="text-sm border-2 border-ink rounded-full px-4 py-2 font-medium hover:border-coral hover:text-coral transition-colors"
      >
        + Google Calendar
      </a>
      <button
        onClick={() => downloadIcs(event)}
        className="text-sm border-2 border-ink rounded-full px-4 py-2 font-medium hover:border-coral hover:text-coral transition-colors"
      >
        Download .ics
      </button>
    </div>
  );

  const reviewSection = isPastEvent && signup?.checked_in && (
    <div className="border-2 border-ink/10 rounded-2xl p-5 mt-6">
      {existingReview ? (
        <>
          <p className="font-medium mb-1">Your review</p>
          <p className="text-marigold text-lg">{"★".repeat(existingReview.rating)}{"☆".repeat(5 - existingReview.rating)}</p>
          {existingReview.comment && <p className="text-sm mt-1">{existingReview.comment}</p>}
        </>
      ) : (
        <>
          <p className="font-medium mb-2">How was this event?</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setReviewRating(n)}
                className={`text-2xl ${n <= reviewRating ? "text-marigold" : "text-ink/20"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Optional comment about the organizer/event…"
            className="w-full border-2 border-ink/15 rounded-xl px-3 py-2 mb-3 focus:border-coral focus:outline-none"
          />
          <button
            onClick={handleSubmitReview}
            disabled={submittingReview}
            className="bg-ink text-paper rounded-full px-5 py-2 text-sm font-medium hover:bg-coral transition-colors disabled:opacity-50"
          >
            {submittingReview ? "Submitting…" : "Submit review"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      {event.banner_url && (
        <img
          src={event.banner_url}
          alt=""
          className="w-full h-56 object-cover rounded-2xl mb-6"
        />
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {tagGroups.map((group) => (
          <button
            key={group.id}
            onClick={() => toggleFollow(group.id)}
            disabled={!user}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              followedIds.has(group.id)
                ? "bg-ink text-paper"
                : "bg-marigold-dim text-navy hover:bg-marigold"
            }`}
            title={user ? "Follow to get emailed about new events from this group" : ""}
          >
            {group.name} {followedIds.has(group.id) ? "· following ✓" : "· follow"}
          </button>
        ))}
        {isPaid && (
          <span className="text-xs font-medium bg-sage-dim text-sage-dark px-3 py-1 rounded-full">
            ₱{event.price_php} entrance
          </span>
        )}
        {event.capacity && (
          <span className="text-xs font-medium bg-paper-dim text-navy px-3 py-1 rounded-full">
            {Math.max(event.capacity - goingCount, 0)} of {event.capacity} spots left
          </span>
        )}
      </div>

      <h1 className="font-display text-3xl mb-2">{event.title}</h1>
      <p className="text-ink-soft mb-6">
        {new Date(event.event_date).toLocaleString("en-PH", {
          dateStyle: "full",
          timeStyle: "short",
        })}{" "}
        · {event.venue}, {event.city}
      </p>

      {event.description && (
        <p className="whitespace-pre-wrap leading-relaxed mb-8">
          {event.description}
        </p>
      )}

      <div className="stub-divider pt-8 mb-8">
        <p className="text-sm text-ink-soft mt-6">
          Organized by{" "}
          {event.organizer?.id ? (
            <Link to={`/organizers/${event.organizer.id}`} className="text-coral font-medium">
              {event.organizer.display_name}
            </Link>
          ) : (
            "Unknown"
          )}
        </p>
      </div>

      {event.status === "cancelled" ? (
        <div className="border-2 border-coral bg-coral/10 rounded-2xl p-5">
          <p className="font-display text-lg text-coral mb-2">This event was cancelled</p>
          <p className="whitespace-pre-wrap">
            {event.cancellation_message ||
              "The organizer has cancelled this event."}
          </p>
        </div>
      ) : !user ? (
        <p className="text-ink-soft">
          <a href="/login" className="text-coral font-medium">
            Log in
          </a>{" "}
          to sign up for this event.
        </p>
      ) : isPaid ? (
        isConfirmed ? (
          <div className="border-2 border-sage rounded-2xl p-5 text-center">
            <p className="font-display text-lg text-sage mb-3">Confirmed ✓</p>
            {qrImageUrl && (
              <img src={qrImageUrl} alt="Your entry pass" className="mx-auto mb-3" />
            )}
            <p className="text-sm text-ink-soft">
              Show this at the door — we also emailed it to you.
            </p>
            {calendarButtons}
          </div>
        ) : hasReserved && isWaitlisted ? (
          <div className="border-2 border-ink/20 rounded-2xl p-5 text-center">
            <p className="font-medium mb-1">You're on the waitlist</p>
            <p className="text-sm text-ink-soft">
              This event is full. We'll email you if a spot opens up.
            </p>
          </div>
        ) : hasReserved ? (
          <div className="border-2 border-marigold bg-marigold-dim rounded-2xl p-5 text-navy">
            <p className="font-medium mb-1">Reserved — pay to confirm your spot</p>
            <p className="text-sm mb-3">
              You're holding a spot, but it's not confirmed until the
              organizer receives your payment.
            </p>
            {event.payment_method === "qr_code" && event.payment_qr_url ? (
              <div className="bg-white/60 rounded-lg p-3 text-center">
                <img
                  src={event.payment_qr_url}
                  alt="Payment QR code"
                  className="mx-auto w-48 h-48 object-contain mb-2"
                />
                {event.payment_instructions && (
                  <p className="text-sm">{event.payment_instructions}</p>
                )}
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm bg-white/60 rounded-lg p-3">
                {event.payment_instructions}
              </p>
            )}
            <p className="text-xs text-navy/70 mt-3">
              Once the organizer confirms they've received your ₱{event.price_php}, your status here will switch to "Confirmed" and you'll get your entry pass by email.
            </p>
          </div>
        ) : (
          <>
            {customFieldsForm}
            <button
              onClick={handleReserve}
              disabled={reserving}
              className="bg-ink text-paper rounded-full px-5 py-2.5 font-medium hover:bg-coral transition-colors disabled:opacity-50"
            >
              {reserving
                ? "Reserving…"
                : isFull()
                ? "Join waitlist"
                : `Reserve my spot — ₱${event.price_php}`}
            </button>
            {formError && <p className="text-coral text-sm mt-2">{formError}</p>}
          </>
        )
      ) : (
        <>
          {customFieldsForm}
          {isWaitlisted ? (
            <div className="border-2 border-ink/20 rounded-2xl p-5 text-center">
              <p className="font-medium mb-1">You're on the waitlist</p>
              <p className="text-sm text-ink-soft">
                This event is full. We'll email you if a spot opens up.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 mb-2">
              <button
                onClick={() => handleFreeSignup("going")}
                className={`rounded-full px-5 py-2.5 font-medium transition-colors ${
                  signup?.status === "going"
                    ? "bg-sage-dark text-white"
                    : "border-2 border-ink hover:border-sage hover:text-sage"
                }`}
              >
                {signup?.status === "going"
                  ? "You're going ✓"
                  : isFull()
                  ? "Join waitlist"
                  : "I'm going"}
              </button>
              <button
                onClick={() => handleFreeSignup("interested")}
                className={`rounded-full px-5 py-2.5 font-medium transition-colors ${
                  signup?.status === "interested"
                    ? "bg-marigold text-navy"
                    : "border-2 border-ink hover:border-marigold"
                }`}
              >
                {signup?.status === "interested" ? "Interested ✓" : "Interested"}
              </button>
            </div>
          )}
          {formError && <p className="text-coral text-sm">{formError}</p>}
          {calendarButtons}
        </>
      )}

      {reviewSection}
    </div>
  );
}
