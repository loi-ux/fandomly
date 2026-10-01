import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function OrganizerEventAttendees() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [signups, setSignups] = useState([]);
  const [walkins, setWalkins] = useState([]);
  const [walkinName, setWalkinName] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  async function load() {
    const { data: eventData } = await supabase
      .from("events")
      .select("id, title, price_php, custom_fields")
      .eq("id", eventId)
      .single();
    setEvent(eventData);

    const { data } = await supabase
      .from("event_signups")
      .select("attendee_id, status, payment_status, checked_in, pass_email_sent_at, custom_field_responses, waitlisted, proof_of_payment_url, attendee:profiles!event_signups_attendee_id_fkey(display_name, city)")
      .eq("event_id", eventId)
      .order("payment_status", { ascending: true });
    setSignups(data ?? []);

    const { data: walkinData } = await supabase
      .from("event_walkins")
      .select("id, name, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setWalkins(walkinData ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleConfirmPayment(attendeeId) {
    setBusyId(attendeeId);
    setMessage(null);
    const { error } = await supabase.rpc("confirm_event_payment", {
      p_event_id: eventId,
      p_attendee_id: attendeeId,
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
      setBusyId(null);
      return;
    }

    const { error: emailError } = await supabase.functions.invoke("send-pass-email", {
      body: { event_id: eventId, attendee_id: attendeeId, origin: window.location.origin },
    });

    setBusyId(null);
    if (emailError) {
      setMessage({
        type: "error",
        text: "Payment confirmed, but the pass email failed to send: " + emailError.message,
      });
    } else {
      setMessage({ type: "success", text: "Payment confirmed and pass emailed." });
    }
    load();
  }

  async function handleResendPassEmail(attendeeId) {
    setBusyId(attendeeId);
    setMessage(null);
    const { error } = await supabase.functions.invoke("send-pass-email", {
      body: { event_id: eventId, attendee_id: attendeeId, origin: window.location.origin },
    });
    setBusyId(null);
    if (error) {
      setMessage({ type: "error", text: "Still failed to send: " + error.message });
    } else {
      setMessage({ type: "success", text: "Pass email sent." });
    }
    load();
  }

  async function handleToggleAttendance(attendeeId, currentlyChecked) {
    setBusyId(attendeeId);
    const { error } = await supabase.rpc("mark_attendance", {
      p_event_id: eventId,
      p_attendee_id: attendeeId,
      p_attended: !currentlyChecked,
    });
    setBusyId(null);
    if (error) {
      setMessage({ type: "error", text: error.message });
    }
    load();
  }

  async function handleAddWalkin(e) {
    e.preventDefault();
    if (!walkinName.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("event_walkins")
      .insert({ event_id: eventId, name: walkinName.trim(), added_by: user.id });
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setWalkinName("");
    }
    load();
  }

  async function handleRemoveWalkin(id) {
    await supabase.from("event_walkins").delete().eq("id", id);
    load();
  }

  async function handlePromote(attendeeId) {
    setBusyId(attendeeId);
    const { error } = await supabase.rpc("promote_from_waitlist", {
      p_event_id: eventId,
      p_attendee_id: attendeeId,
    });
    setBusyId(null);
    if (error) setMessage({ type: "error", text: error.message });
    load();
  }

  async function handleViewProof(path) {
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 3600);
    if (error) {
      setMessage({ type: "error", text: "Couldn't open that file: " + error.message });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleSendReminder(attendeeId) {
    setBusyId(attendeeId);
    setMessage(null);
    const { error } = await supabase.functions.invoke("send-payment-reminder", {
      body: { event_id: eventId, attendee_id: attendeeId },
    });
    setBusyId(null);
    if (error) {
      setMessage({ type: "error", text: "Reminder failed to send: " + error.message });
    } else {
      setMessage({ type: "success", text: "Reminder sent." });
    }
  }

  if (!event) return <p className="text-center py-16 text-ink-soft">Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <Link to="/organizer" className="text-sm text-ink-soft hover:text-sky">
        ← My events
      </Link>
      <h1 className="font-display text-3xl mt-2 mb-1">{event.title}</h1>
      <p className="text-ink-soft mb-2">₱{event.price_php} entrance · attendee list</p>

      {(() => {
        const confirmed = signups.filter((s) => s.payment_status === "paid");
        const waitlisted = signups.filter((s) => s.waitlisted);
        const checkedIn = confirmed.filter((s) => s.checked_in).length;
        const revenue = confirmed.length * Number(event.price_php || 0);
        return (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft mb-8">
            <span>{confirmed.length} confirmed</span>
            <span>{waitlisted.length} waitlisted</span>
            <span>{walkins.length} walk-ins</span>
            <span>
              {confirmed.length ? Math.round((checkedIn / confirmed.length) * 100) : 0}% checked in
            </span>
            <span>₱{revenue} revenue</span>
          </div>
        );
      })()}

      {message && (
        <p className={`text-sm mb-4 ${message.type === "error" ? "text-danger" : "text-sage"}`}>
          {message.text}
        </p>
      )}

      {signups.filter((s) => !s.waitlisted).length === 0 ? (
        <p className="text-ink-soft">No signups yet.</p>
      ) : (
        <div className="space-y-3">
          {signups.filter((s) => !s.waitlisted).map((s) => (
            <div
              key={s.attendee_id}
              className="flex items-center justify-between border-2 border-ink/10 rounded-2xl px-5 py-4"
            >
              <div>
                <p className="font-medium">{s.attendee?.display_name ?? "Unknown"}</p>
                <p className="text-sm text-ink-soft">
                  {s.attendee?.city}
                  {s.checked_in && " · checked in ✓"}
                </p>
                {event.custom_fields?.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {event.custom_fields.map((field) => (
                      <p key={field.id} className="text-xs text-ink-soft">
                        <span className="font-medium">{field.label}:</span>{" "}
                        {s.custom_field_responses?.[field.id] || "—"}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {s.payment_status === "paid" ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-sage-dim text-sage-dark">
                    Confirmed{s.pass_email_sent_at ? "" : " (email pending)"}
                  </span>
                  {!s.pass_email_sent_at && (
                    <button
                      onClick={() => handleResendPassEmail(s.attendee_id)}
                      disabled={busyId === s.attendee_id}
                      className="text-xs text-sky font-medium hover:underline disabled:opacity-50"
                    >
                      {busyId === s.attendee_id ? "Sending…" : "Resend"}
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleAttendance(s.attendee_id, s.checked_in)}
                    disabled={busyId === s.attendee_id}
                    className={`text-xs rounded-full px-3 py-1.5 font-medium transition-colors disabled:opacity-50 ${
                      s.checked_in
                        ? "bg-ink text-paper"
                        : "border-2 border-ink hover:border-sky hover:text-sky"
                    }`}
                  >
                    {s.checked_in ? "Checked in ✓" : "Mark attended"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {s.proof_of_payment_url && (
                    <button
                      onClick={() => handleViewProof(s.proof_of_payment_url)}
                      className="text-sm text-sky font-medium hover:underline"
                    >
                      View proof
                    </button>
                  )}
                  <button
                    onClick={() => handleSendReminder(s.attendee_id)}
                    disabled={busyId === s.attendee_id}
                    className="text-sm border-2 border-ink rounded-full px-3 py-2 font-medium hover:border-sky hover:text-sky transition-colors disabled:opacity-50"
                  >
                    Remind
                  </button>
                  <button
                    onClick={() => handleConfirmPayment(s.attendee_id)}
                    disabled={busyId === s.attendee_id}
                    className="text-sm bg-ink text-paper rounded-full px-4 py-2 font-medium hover:bg-sky transition-colors disabled:opacity-50"
                  >
                    {busyId === s.attendee_id ? "Confirming…" : "Mark as paid"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {signups.some((s) => s.waitlisted) && (
        <div className="mt-8">
          <h2 className="font-display text-lg mb-3">Waitlist</h2>
          <div className="space-y-3">
            {signups.filter((s) => s.waitlisted).map((s) => (
              <div
                key={s.attendee_id}
                className="flex items-center justify-between border-2 border-ink/10 rounded-2xl px-5 py-3"
              >
                <p className="font-medium">{s.attendee?.display_name ?? "Unknown"}</p>
                <button
                  onClick={() => handlePromote(s.attendee_id)}
                  disabled={busyId === s.attendee_id}
                  className="text-sm bg-ink text-paper rounded-full px-4 py-2 font-medium hover:bg-sky transition-colors disabled:opacity-50"
                >
                  {busyId === s.attendee_id ? "Promoting…" : "Promote to confirmed"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12">
        <h2 className="font-display text-xl mb-1">Walk-ins</h2>
        <p className="text-sm text-ink-soft mb-4">
          People who showed up without signing up beforehand.
        </p>
        <form onSubmit={handleAddWalkin} className="flex gap-2 mb-4">
          <input
            value={walkinName}
            onChange={(e) => setWalkinName(e.target.value)}
            placeholder="Name"
            className="flex-1 border-2 border-ink/15 rounded-full px-4 py-2 focus:border-sky focus:outline-none"
          />
          <button
            type="submit"
            className="bg-ink text-paper rounded-full px-5 py-2 font-medium hover:bg-sky transition-colors"
          >
            + Add walk-in
          </button>
        </form>
        {walkins.length === 0 ? (
          <p className="text-ink-soft text-sm">No walk-ins logged yet.</p>
        ) : (
          <div className="space-y-2">
            {walkins.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between border-2 border-ink/10 rounded-xl px-4 py-2.5"
              >
                <p className="font-medium">{w.name}</p>
                <button
                  onClick={() => handleRemoveWalkin(w.id)}
                  className="text-sky text-sm font-medium hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
