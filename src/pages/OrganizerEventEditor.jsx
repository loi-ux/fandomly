import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

// TODO: replace with your actual GCash details.
const PLATFORM_PAYMENT_INFO = "GCash: Eloisa O. — 09284915513";

export default function OrganizerEventEditor() {
  const { id } = useParams(); // undefined when creating a new event
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [showFeeInstructions, setShowFeeInstructions] = useState(false);
  const [savedEventId, setSavedEventId] = useState(null);
  const [markingPending, setMarkingPending] = useState(false);

  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: "",
    venue: "",
    city: "",
    lat: "",
    lng: "",
    banner_url: "",
    tags: [],
    status: "draft",
    is_paid: false,
    price_php: "",
    capacity: "",
    payment_method: "gcash",
    payment_instructions: "",
    payment_qr_url: "",
    listing_fee_status: "unpaid",
    custom_fields: [],
  });
  const [saving, setSaving] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [error, setError] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

  useEffect(() => {
    async function loadGroups() {
      const { data } = await supabase
        .from("kpop_groups")
        .select("name")
        .order("name");
      setGroups((data ?? []).map((g) => g.name));
    }
    loadGroups();
  }, []);

  async function handleAddGroup(e) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    setAddingGroup(true);
    const { error: insertError } = await supabase
      .from("kpop_groups")
      .upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
    setAddingGroup(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewGroupName("");
    setGroups((g) => (g.includes(name) ? g : [...g, name].sort()));
    toggleTag(name);
  }

  useEffect(() => {
    async function loadEvent() {
      if (!isEditing) return;
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        setForm({
          ...data,
          event_date: data.event_date?.slice(0, 16) ?? "",
          tags: data.tags ?? [],
          price_php: data.price_php ?? "",
          capacity: data.capacity ?? "",
          payment_method: data.payment_method ?? "gcash",
          payment_instructions: data.payment_instructions ?? "",
          payment_qr_url: data.payment_qr_url ?? "",
          custom_fields: (data.custom_fields ?? []).map((cf) => ({
            ...cf,
            optionsText: (cf.options ?? []).join(", "),
          })),
        });
      }
    }
    loadEvent();
  }, [id, isEditing]);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function toggleTag(tag) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }));
  }

  function addCustomField() {
    setForm((f) => ({
      ...f,
      custom_fields: [
        ...f.custom_fields,
        { id: `field_${Date.now()}`, label: "", type: "text", optionsText: "", required: false },
      ],
    }));
  }

  function updateCustomField(id, changes) {
    setForm((f) => ({
      ...f,
      custom_fields: f.custom_fields.map((cf) =>
        cf.id === id ? { ...cf, ...changes } : cf
      ),
    }));
  }

  function removeCustomField(id) {
    setForm((f) => ({
      ...f,
      custom_fields: f.custom_fields.filter((cf) => cf.id !== id),
    }));
  }

  async function handleQrUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setUploadingQr(true);
    setError(null);
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const path = `${user.id}/qr-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("event-banners")
      .upload(path, file, { upsert: false });
    setUploadingQr(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("event-banners").getPublicUrl(path);
    setForm((f) => ({ ...f, payment_qr_url: data.publicUrl }));
  }

  async function handleBannerUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setUploadingBanner(true);
    setError(null);
    // Storage keys can't contain spaces or most special characters, so we
    // build a clean filename instead of trusting whatever the OS named it.
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("event-banners")
      .upload(path, file, { upsert: false });
    setUploadingBanner(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("event-banners").getPublicUrl(path);
    setForm((f) => ({ ...f, banner_url: data.publicUrl }));
  }

  async function saveEvent(status) {
    if (form.is_paid && (!form.price_php || Number(form.price_php) <= 0)) {
      setError("Set a price for this event.");
      return null;
    }
    if (form.is_paid && form.payment_method === "qr_code" && !form.payment_qr_url) {
      setError("Upload a QR code image so attendees know how to pay you.");
      return null;
    }
    if (form.is_paid && form.payment_method !== "qr_code" && !form.payment_instructions.trim()) {
      setError(
        form.payment_method === "bank_transfer"
          ? "Add your bank name, account name, and account number."
          : "Add your GCash name & number so attendees know how to pay you."
      );
      return null;
    }
    if (form.custom_fields.some((cf) => !cf.label.trim())) {
      setError("Every custom question needs a label (or remove the empty one).");
      return null;
    }

    const payload = {
      ...form,
      status,
      organizer_id: user.id,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      price_php: form.is_paid ? Number(form.price_php) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      payment_method: form.is_paid ? form.payment_method : null,
      payment_instructions: form.is_paid && form.payment_method !== "qr_code" ? form.payment_instructions : null,
      payment_qr_url: form.is_paid && form.payment_method === "qr_code" ? form.payment_qr_url : null,
      custom_fields: form.custom_fields.map(({ optionsText, ...cf }) => ({
        ...cf,
        options:
          cf.type === "select"
            ? (optionsText ?? "").split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
      })),
    };

    if (isEditing) {
      const { error } = await supabase.from("events").update(payload).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      const { data, error } = await supabase.from("events").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    }
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    try {
      await saveEvent("draft");
      navigate("/organizer");
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function handlePublish() {
    setSaving(true);
    setError(null);
    try {
      const savedId = await saveEvent(form.is_paid ? "draft" : "published");
      if (!savedId) {
        setSaving(false);
        return;
      }

      if (!form.is_paid) {
        // Free events publish immediately, no fee involved.
        await supabase.functions.invoke("notify-fandom-followers", {
          body: { event_id: savedId, origin: window.location.origin },
        });
        navigate("/organizer");
        return;
      }

      if (form.listing_fee_status === "paid" || form.listing_fee_status === "waived") {
        // Already covered before (paid or admin-waived) — just flip it live.
        await supabase.from("events").update({ status: "published" }).eq("id", savedId);
        await supabase.functions.invoke("notify-fandom-followers", {
          body: { event_id: savedId, origin: window.location.origin },
        });
        navigate("/organizer");
        return;
      }

      if ((profile?.free_listing_credits ?? 0) > 0) {
        // Redeem a free listing credit instead of asking for the ₱100 fee.
        const { error: redeemError } = await supabase.rpc("redeem_free_listing", {
          p_event_id: savedId,
        });
        if (redeemError) {
          setError(redeemError.message);
          setSaving(false);
          return;
        }
        await supabase.functions.invoke("notify-fandom-followers", {
          body: { event_id: savedId, origin: window.location.origin },
        });
        navigate("/organizer");
        return;
      }

      // Paid event, fee not yet confirmed: show manual GCash instructions
      // instead of a Xendit checkout. Fandomly's admin confirms receipt
      // from the Admin dashboard, which is what actually flips it live.
      setSavedEventId(savedId);
      setShowFeeInstructions(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function handleMarkFeeSent() {
    if (!savedEventId) return;
    setMarkingPending(true);
    await supabase.from("events").update({ listing_fee_status: "pending" }).eq("id", savedEventId);
    setMarkingPending(false);
    navigate("/organizer");
  }

  async function handleCancelEvent() {
    setCancelling(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("events")
      .update({ status: "cancelled", cancellation_message: cancelMessage })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      setCancelling(false);
      return;
    }
    const { error: notifyError } = await supabase.functions.invoke("notify-event-cancelled", {
      body: { event_id: id },
    });
    setCancelling(false);
    if (notifyError) {
      setError("Event cancelled, but notifying attendees failed: " + notifyError.message);
      return;
    }
    navigate("/organizer");
  }

  if (showFeeInstructions) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <p className="font-display text-2xl mb-3">One more step</p>
        <p className="text-ink-soft mb-6">
          Your event is saved as a draft. Send the ₱100 listing fee to
          publish it — Fandomly will confirm and take it live shortly after.
        </p>
        <div className="border-2 border-marigold bg-marigold-dim text-navy rounded-2xl p-4 mb-6">
          {PLATFORM_PAYMENT_INFO}
        </div>
        <button
          onClick={handleMarkFeeSent}
          disabled={markingPending}
          className="bg-ink text-paper rounded-full px-5 py-2.5 font-medium hover:bg-coral transition-colors disabled:opacity-50"
        >
          {markingPending ? "Saving…" : "I've sent the ₱100"}
        </button>
        <p className="text-xs text-ink-soft mt-4">
          Your event stays as a draft until the fee is confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="font-display text-3xl mb-2">
        {isEditing ? "Edit event" : "New event"}
      </h1>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium">Event title</label>
          <input
            value={form.title}
            onChange={update("title")}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Tag artists / groups
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {groups.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-sm px-3 py-1.5 rounded-full border-2 transition-colors ${
                  form.tags.includes(tag)
                    ? "bg-marigold border-marigold text-navy"
                    : "border-ink/15 text-ink-soft hover:border-ink"
                }`}
              >
                {tag}
              </button>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-ink-soft">
                No groups in the directory yet — add the first one below.
              </p>
            )}
          </div>
          <form onSubmit={handleAddGroup} className="flex gap-2 mt-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Don't see the artist/group? Type it here"
              className="flex-1 border-2 border-ink/15 rounded-full px-3 py-1.5 text-sm focus:border-coral focus:outline-none"
            />
            <button
              type="submit"
              disabled={addingGroup}
              className="text-sm bg-ink text-paper rounded-full px-4 py-1.5 font-medium hover:bg-coral transition-colors disabled:opacity-50"
            >
              {addingGroup ? "Adding…" : "+ Add & tag"}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Date & time</label>
            <input
              type="datetime-local"
              value={form.event_date}
              onChange={update("event_date")}
              className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium">City</label>
            <input
              value={form.city}
              onChange={update("city")}
              placeholder="Cebu City"
              className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Venue</label>
          <input
            value={form.venue}
            onChange={update("venue")}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Capacity <span className="text-ink-soft">(optional — leave blank for unlimited)</span>
          </label>
          <input
            type="number"
            min="1"
            value={form.capacity}
            onChange={update("capacity")}
            placeholder="e.g. 30"
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
          <p className="text-xs text-ink-soft mt-1">
            Once full, new signups go on a waitlist instead of taking a spot.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">
              Latitude <span className="text-ink-soft">(for "nearest me")</span>
            </label>
            <input
              value={form.lat}
              onChange={update("lat")}
              placeholder="10.3157"
              className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Longitude</label>
            <input
              value={form.lng}
              onChange={update("lng")}
              placeholder="123.8854"
              className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Banner image</label>
          {form.banner_url && (
            <img
              src={form.banner_url}
              alt="Banner preview"
              className="mt-2 w-full h-40 object-cover rounded-xl"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            disabled={uploadingBanner}
            className="mt-2 w-full text-sm border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none disabled:opacity-50"
          />
          {uploadingBanner && (
            <p className="text-xs text-ink-soft mt-1">Uploading…</p>
          )}
        </div>

        <div className="border-2 border-ink/10 rounded-xl p-4">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={form.is_paid}
              onChange={(e) => setForm({ ...form, is_paid: e.target.checked })}
            />
            This event has an entrance fee
          </label>

          {form.is_paid && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-sm font-medium">Price (₱)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.price_php}
                  onChange={update("price_php")}
                  placeholder="150"
                  className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  How will attendees pay you?
                </label>
                <div className="flex gap-2 mt-1">
                  {[
                    { value: "gcash", label: "GCash" },
                    { value: "bank_transfer", label: "Bank Transfer" },
                    { value: "qr_code", label: "QR code" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setForm({ ...form, payment_method: opt.value })}
                      className={`text-sm px-3 py-1.5 rounded-full border-2 transition-colors ${
                        form.payment_method === opt.value
                          ? "bg-marigold border-marigold text-navy"
                          : "border-ink/15 text-ink-soft hover:border-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.payment_method === "qr_code" ? (
                <div>
                  <label className="text-sm font-medium">QR code image</label>
                  {form.payment_qr_url && (
                    <img
                      src={form.payment_qr_url}
                      alt="Payment QR preview"
                      className="mt-2 w-40 h-40 object-contain rounded-xl border-2 border-ink/10"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrUpload}
                    disabled={uploadingQr}
                    className="mt-2 w-full text-sm border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none disabled:opacity-50"
                  />
                  {uploadingQr && <p className="text-xs text-ink-soft mt-1">Uploading…</p>}
                  <input
                    value={form.payment_instructions}
                    onChange={update("payment_instructions")}
                    placeholder="Optional: account name for reference"
                    className="mt-2 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">
                    {form.payment_method === "bank_transfer"
                      ? "Bank name, account name & number"
                      : "GCash name & number"}
                  </label>
                  <textarea
                    rows={2}
                    value={form.payment_instructions}
                    onChange={update("payment_instructions")}
                    placeholder={
                      form.payment_method === "bank_transfer"
                        ? "BDO — Juan Dela Cruz — 0012 3456 7890"
                        : "GCash: Juan Dela Cruz — 0917 123 4567"
                    }
                    className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
                  />
                </div>
              )}

              <p className="text-xs text-ink-soft">
                {(profile?.free_listing_credits ?? 0) > 0
                  ? `You have ${profile.free_listing_credits} free listing${profile.free_listing_credits === 1 ? "" : "s"} — this one won't cost you the usual ₱100.`
                  : "Publishing a paid event costs a flat ₱100 listing fee to Fandomly."}{" "}
                Attendees pay you directly — Fandomly doesn't touch that
                money. You'll confirm each attendee's payment yourself from
                your event's attendee list.
              </p>
            </div>
          )}
        </div>

        <div className="border-2 border-ink/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium">Custom questions for attendees</p>
            <button
              type="button"
              onClick={addCustomField}
              className="text-sm text-coral font-medium hover:underline"
            >
              + Add question
            </button>
          </div>
          <p className="text-xs text-ink-soft mb-3">
            Ask attendees anything extra when they sign up — t-shirt size,
            cup sleeve name, dietary restrictions, etc.
          </p>

          {form.custom_fields.map((cf) => (
            <div key={cf.id} className="border-2 border-ink/10 rounded-lg p-3 mb-2 space-y-2">
              <div className="flex gap-2">
                <input
                  value={cf.label}
                  onChange={(e) => updateCustomField(cf.id, { label: e.target.value })}
                  placeholder="Question (e.g. T-shirt size)"
                  className="flex-1 border-2 border-ink/15 rounded-lg px-3 py-1.5 text-sm focus:border-coral focus:outline-none"
                />
                <select
                  value={cf.type}
                  onChange={(e) => updateCustomField(cf.id, { type: e.target.value })}
                  className="border-2 border-ink/15 rounded-lg px-2 py-1.5 text-sm focus:border-coral focus:outline-none"
                >
                  <option value="text">Short answer</option>
                  <option value="textarea">Long answer</option>
                  <option value="select">Multiple choice</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeCustomField(cf.id)}
                  className="text-coral text-sm px-2"
                >
                  Remove
                </button>
              </div>

              {cf.type === "select" && (
                <input
                  value={cf.optionsText ?? ""}
                  onChange={(e) => updateCustomField(cf.id, { optionsText: e.target.value })}
                  placeholder="Options, comma separated (e.g. S, M, L, XL)"
                  className="w-full border-2 border-ink/15 rounded-lg px-3 py-1.5 text-sm focus:border-coral focus:outline-none"
                />
              )}

              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={cf.required}
                  onChange={(e) => updateCustomField(cf.id, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium">
            Description (this is your event's page — write it up!)
          </label>
          <textarea
            rows={6}
            value={form.description}
            onChange={update("description")}
            className="mt-1 w-full border-2 border-ink/15 rounded-xl px-3 py-2 focus:border-coral focus:outline-none"
          />
        </div>

        {error && <p className="text-coral text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="border-2 border-ink rounded-full px-5 py-2.5 font-medium hover:border-coral hover:text-coral transition-colors disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className="bg-ink text-paper rounded-full px-5 py-2.5 font-medium hover:bg-coral transition-colors disabled:opacity-50"
          >
            {saving
              ? "Working…"
              : form.is_paid && !["paid", "waived"].includes(form.listing_fee_status)
              ? (profile?.free_listing_credits ?? 0) > 0
                ? "Publish (using 1 free listing)"
                : "Continue to ₱100 payment"
              : "Publish"}
          </button>
        </div>
      </div>

      {isEditing && form.status === "published" && (
        <div className="mt-10 border-2 border-coral rounded-2xl p-4">
          {!showCancelForm ? (
            <button
              onClick={() => setShowCancelForm(true)}
              className="text-coral text-sm font-medium hover:underline"
            >
              Cancel this event
            </button>
          ) : (
            <div>
              <p className="font-medium mb-1">Cancel this event</p>
              <p className="text-sm text-ink-soft mb-3">
                Everyone who signed up will be emailed. Write a short note
                explaining what happened — a refund plan, a reschedule, or
                just an apology.
              </p>
              <textarea
                rows={3}
                value={cancelMessage}
                onChange={(e) => setCancelMessage(e.target.value)}
                placeholder="e.g. Unfortunately we have to cancel due to venue issues. If you already paid, please message us for a refund."
                className="w-full border-2 border-ink/15 rounded-xl px-3 py-2 mb-3 focus:border-coral focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelForm(false)}
                  className="text-sm border-2 border-ink rounded-full px-4 py-2 font-medium hover:border-coral hover:text-coral transition-colors"
                >
                  Never mind
                </button>
                <button
                  onClick={handleCancelEvent}
                  disabled={cancelling}
                  className="text-sm bg-coral text-white rounded-full px-4 py-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Cancel event & notify everyone"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
