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
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("attendeesView") === "table" ? "table" : "cards";
    } catch {
      return "cards";
    }
  });
  const [search, setSearch] = useState("");

  function changeView(next) {
    setView(next);
    try {
      localStorage.setItem("attendeesView", next);
    } catch {
      // Private browsing etc. — the toggle still works, it just won't be remembered.
    }
  }

  async function load() {
    const { data: eventData } = await supabase
      .from("events")
      .select("id, title, price_php, custom_fields, event_date")
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

  function renderActions(s, { inTable = false } = {}) {
    return (
      s.payment_status === "paid" ? (
            <div className="flex items-center gap-2">
              {!inTable && (
                <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-sage-dim text-sage-dark">
                  Confirmed{s.pass_email_sent_at ? "" : " (email pending)"}
                </span>
              )}
              {s.proof_of_payment_url && (
                <button
                  onClick={() => handleViewProof(s.proof_of_payment_url)}
                  className="text-xs text-sky font-medium hover:underline"
                >
                  View proof
                </button>
              )}
              {!s.pass_email_sent_at && (
                <button
                  onClick={() => handleResendPassEmail(s.attendee_id)}
                  disabled={busyId === s.attendee_id}
                  className="text-xs text-sky font-medium hover:underline disabled:opacity-50"
                >
                  {busyId === s.attendee_id ? "Sending…" : "Resend"}
                </button>
              )}
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
          )
    );
  }

  // Check-in opens at midnight Philippine time on the event day — the
  // database enforces the same rule (check_in_opens_at).
  const manilaDay = (d) =>
    new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const checkInOpen = event.event_date && manilaDay(new Date()) >= manilaDay(event.event_date);
  const checkInOpensLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      })
    : "";

  function renderCheckIn(s) {
    if (s.payment_status !== "paid") return <span className="text-xs text-ink-soft">—</span>;
    if (!checkInOpen && !s.checked_in) {
      return <span className="text-xs text-ink-soft">Opens {checkInOpensLabel}</span>;
    }
    return (
      <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(s.checked_in)}
          onChange={() => handleToggleAttendance(s.attendee_id, s.checked_in)}
          disabled={busyId === s.attendee_id}
          className="w-4 h-4 accent-sage-dark"
        />
        {s.checked_in ? "Attended" : "Mark attended"}
      </label>
    );
  }

  const activeSignups = signups.filter((s) => !s.waitlisted);
  const query = search.trim().toLowerCase();
  const visibleSignups = query
    ? activeSignups.filter((s) =>
        [
          s.attendee?.display_name,
          s.attendee?.city,
          ...Object.values(s.custom_field_responses ?? {}),
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query))
      )
    : activeSignups;

  function downloadCsv() {
    const fields = event.custom_fields ?? [];
    const header = ["Name", "City", ...fields.map((f) => f.label), "Payment", "Checked in"];
    const rows = activeSignups.map((s) => [
      s.attendee?.display_name ?? "",
      s.attendee?.city ?? "",
      ...fields.map((f) => s.custom_field_responses?.[f.id] ?? ""),
      s.payment_status === "paid" ? "Paid" : s.proof_of_payment_url ? "Proof sent" : "Unpaid",
      s.checked_in ? "Yes" : "No",
    ]);
    const escape = (v) => {
      const str = String(v ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    // BOM so Excel opens Filipino/emoji characters correctly.
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "attendees"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`${view === "table" ? "max-w-6xl" : "max-w-3xl"} mx-auto px-5 py-12`}>
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
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex rounded-full border-2 border-ink/15 p-0.5 text-sm font-medium">
              {["cards", "table"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeView(v)}
                  className={`px-4 py-1.5 rounded-full transition-colors ${
                    view === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {v === "cards" ? "Cards" : "Table"}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or answers…"
              className="flex-1 min-w-[12rem] border-2 border-ink/15 rounded-full px-4 py-1.5 text-sm focus:border-sky focus:outline-none"
            />
            <button
              type="button"
              onClick={downloadCsv}
              className="text-sm font-medium text-sky hover:underline"
            >
              Download CSV
            </button>
          </div>

          {visibleSignups.length === 0 ? (
            <p className="text-ink-soft text-sm">No one matches "{search}".</p>
          ) : view === "table" ? (
            <div className="overflow-x-auto border-2 border-ink/10 rounded-2xl">
              <table className="min-w-full text-sm">
                <thead className="bg-paper-dim text-left text-xs text-ink-soft">
                  <tr>
                    <th className="px-3 py-2.5 font-medium w-8">#</th>
                    <th className="px-3 py-2.5 font-medium sticky left-0 bg-paper-dim">Name</th>
                    <th className="px-3 py-2.5 font-medium">City</th>
                    {(event.custom_fields ?? []).map((field) => (
                      <th key={field.id} className="px-3 py-2.5 font-medium min-w-[10rem]">
                        {field.label}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Check-in</th>
                    <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSignups.map((s, i) => (
                    <tr key={s.attendee_id} className="border-t border-ink/10 align-top">
                      <td className="px-3 py-3 text-ink-soft">{i + 1}</td>
                      <td className="px-3 py-3 font-medium whitespace-nowrap sticky left-0 bg-paper">
                        {s.attendee?.display_name ?? "Unknown"}
                      </td>
                      <td className="px-3 py-3 text-ink-soft whitespace-nowrap">
                        {s.attendee?.city || "—"}
                      </td>
                      {(event.custom_fields ?? []).map((field) => (
                        <td key={field.id} className="px-3 py-3 break-words max-w-[16rem]">
                          {s.custom_field_responses?.[field.id] || (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {s.payment_status === "paid" ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-sage-dim text-sage-dark">
                            Confirmed
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-marigold-dim text-navy">
                            {s.proof_of_payment_url ? "Proof sent" : "Unpaid"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{renderCheckIn(s)}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end whitespace-nowrap">{renderActions(s, { inTable: true })}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSignups.map((s) => (
                <div
                  key={s.attendee_id}
                  className="flex items-center justify-between border-2 border-ink/10 rounded-2xl px-5 py-4"
                >
                  <div>
                    <p className="font-medium">{s.attendee?.display_name ?? "Unknown"}</p>
                    <p className="text-sm text-ink-soft">
                      {s.attendee?.city}
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
                    {s.payment_status === "paid" && <div className="mt-2">{renderCheckIn(s)}</div>}
                  </div>
                  {renderActions(s)}
                </div>
              ))}
            </div>
          )}
        </>
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
