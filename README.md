# Fandomly — Cebu Fandom Event Tracker

A platform for Cebu fans to post and discover fandom-organized events —
fanmeets, birthday cafes, cup sleeve events, and more. Built with React +
Vite, Supabase (auth + database), and deployed on Netlify.

## Roles

- **Attendee** (default on signup) — browse events, sign up, see nearest/city events
- **Organizer** (approved by an admin) — create and customize event pages, tag artists/groups
- **Admin** — approve organizers, manage the artist/group directory, moderate events

## 1. Set up Supabase

1. In your Supabase project, open **SQL Editor → New query**.
2. Paste in the contents of `supabase/schema.sql` and run it. This creates all
   four tables (`profiles`, `kpop_groups`, `events`, `event_signups`) with the
   right permissions already configured.
3. Go to **Project Settings → API** and copy your **Project URL** and **anon
   public key**.

## 2. Configure the app locally

```bash
npm install
cp .env.example .env
```

Open `.env` and paste in your Project URL and anon key:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Then run it:

```bash
npm run dev
```

## 3. Make yourself an admin

Sign up once through the running app (this creates your `profiles` row as an
attendee). Then in the Supabase SQL Editor, run:

```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'your-email@example.com');
```

Log out and back in — you'll now see the **Admin** link in the nav, where you
can add TXT, MOA's artist, and any other groups to the tag directory, and
approve organizer requests.

## 4. Set up paid events

**The model:** organizers pay Fandomly a flat **₱100** to publish a paid event.
Attendee ticket payments happen directly between attendee and organizer
(GCash, etc.) — Fandomly never touches that money. An attendee "Reserves" a
spot for free in the app, pays the organizer directly using the payment
details the organizer wrote, and the organizer manually marks them as paid
once the money's in hand. That triggers an emailed QR pass the organizer
scans (or just eyeballs) at the door.

### 4a. Xendit (charges the organizer's ₱100 listing fee)

This is now a plain single-merchant setup — no xenPlatform, no sub-accounts,
no KYC per organizer, since only you receive money through Xendit.

1. Create a Xendit account at xendit.co (standard self-serve signup).
2. Get your **Secret API Key** from Settings → API Keys.
3. Add a webhook in Xendit's dashboard for the **Invoice paid** event,
   pointing to `https://<your-project-ref>.supabase.co/functions/v1/xendit-webhook`.
   Copy the **Callback Verification Token** it gives you.

### 4b. Resend (emails the attendee's QR pass)

1. Create a free account at resend.com.
2. Get your API key from the dashboard.
3. (Optional) verify your own domain in Resend so emails come from your
   own address instead of the shared `onboarding@resend.dev` test address.

### 4c. Add the secrets

In Supabase → **Edge Functions → Manage secrets**, add:

- `XENDIT_SECRET_KEY` — from 4a
- `XENDIT_WEBHOOK_TOKEN` — from 4a
- `RESEND_API_KEY` — from 4b
- `RESEND_FROM_EMAIL` — optional, e.g. `Fandomly <events@yourdomain.com>`
- `SITE_URL` — your deployed site's URL (e.g. `https://fandomly.netlify.app`), used to build links in fandom-follow notification emails sent from the webhook
- `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → API (lets the
  functions write results even though the caller's own login can't)

Three edge functions handle the rest (already deployed to this project):

- `xendit-create-payment` — creates the ₱100 listing-fee invoice when an
  organizer publishes a paid event
- `xendit-webhook` — Xendit calls this when that fee is paid, which flips
  the event to published
- `send-pass-email` — sends the attendee their QR pass once the organizer
  marks their payment as confirmed
- `notify-fandom-followers` — emails everyone following a tagged fandom
  when an event publishes

## 5. Deploy to Netlify

1. Push this project to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add the same two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) under **Site settings → Environment variables**.
5. Deploy. You'll get a live URL immediately.

## How the pieces fit together

- `src/context/AuthContext.jsx` — tracks the logged-in user and their role
- `src/components/ProtectedRoute.jsx` — gates pages by required role(s)
- `src/pages/OrganizerEventEditor.jsx` — where organizers write their event's
  page and tag it to artists/groups from the `kpop_groups` directory
- `src/pages/BrowseEvents.jsx` — public search, city filter, and "nearest to
  me" (uses the browser's geolocation + straight-line distance)
- `supabase/schema.sql` — the full database schema and Row Level Security
  policies (who can read/write what)
- `supabase/functions/` (deployed directly to your project) — the three
  edge functions that talk to Xendit so your secret key never reaches
  the browser

## Installing as an app (no store needed)

This project is set up as an installable PWA — once deployed, visitors can
tap "Add to Home Screen" (iOS Safari) or the install icon in the address
bar (Android Chrome) to get an app-like icon and full-screen experience,
with zero app store fees or review process. Publishing to Google Play
(~$25 one-time) or the Apple App Store (~$99/year) is a separate, optional
step for later, and would need wrapping this project with a tool like
Capacitor first.

## Next steps worth considering

- Add image upload (Supabase Storage) instead of pasting banner URLs
- Email confirmation for signups (Supabase Auth setting)
- Push notifications / reminders for "going" events
