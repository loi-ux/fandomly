-- Fandomly: Cebu fandom event tracker — database schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).

-- ============================================================
-- 1. PROFILES — extends Supabase auth.users with app-specific fields
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  city text,
  role text not null default 'attendee' check (role in ('attendee', 'organizer', 'admin')),
  organizer_requested boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Anyone (including logged-out visitors) can read basic profile info —
-- needed to show "Organized by ___" on public event pages.
create policy "Profiles are publicly readable"
  on profiles for select
  using (true);

-- A user can only create their own profile row, at signup.
create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- A user can update their own profile (e.g. requesting organizer status).
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Admins can update any profile (e.g. approving an organizer request).
create policy "Admins can update any profile"
  on profiles for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );


-- ============================================================
-- 2. KPOP_GROUPS — the directory of artists/groups events can be tagged to
-- ============================================================
create table kpop_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table kpop_groups enable row level security;

create policy "Groups are publicly readable"
  on kpop_groups for select
  using (true);

create policy "Admins can manage groups"
  on kpop_groups for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );


-- ============================================================
-- 3. EVENTS
-- ============================================================
create table events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  event_date timestamptz not null,
  venue text,
  city text,
  lat double precision,
  lng double precision,
  banner_url text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

-- Anyone can read published events; organizers can also see their own drafts.
create policy "Published events are public, drafts visible to their organizer"
  on events for select
  using (
    status = 'published'
    or organizer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Only organizers/admins can create events, and only under their own name.
create policy "Organizers can create their own events"
  on events for insert
  with check (
    organizer_id = auth.uid()
    and exists (
      select 1 from profiles p where p.id = auth.uid() and p.role in ('organizer', 'admin')
    )
  );

-- Organizers can edit their own events; admins can edit any.
create policy "Organizers can update their own events"
  on events for update
  using (
    organizer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Organizers can delete their own events; admins can delete any (moderation).
create policy "Organizers can delete their own events"
  on events for delete
  using (
    organizer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );


-- ============================================================
-- 4. EVENT_SIGNUPS
-- ============================================================
create table event_signups (
  event_id uuid not null references events(id) on delete cascade,
  attendee_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  primary key (event_id, attendee_id)
);

alter table event_signups enable row level security;

-- Attendees can see their own signups; organizers can see signups for their events.
create policy "Attendees see own signups, organizers see their event's signups"
  on event_signups for select
  using (
    attendee_id = auth.uid()
    or exists (
      select 1 from events e
      where e.id = event_signups.event_id and e.organizer_id = auth.uid()
    )
  );

create policy "Attendees can sign up for events"
  on event_signups for insert
  with check (attendee_id = auth.uid());

create policy "Attendees can change their own signup status"
  on event_signups for update
  using (attendee_id = auth.uid());

create policy "Attendees can cancel their own signup"
  on event_signups for delete
  using (attendee_id = auth.uid());


-- ============================================================
-- 5. AUTO-CREATE A PROFILE ROW WHEN SOMEONE SIGNS UP
-- ============================================================
-- Without this, the app would need to insert into `profiles` itself right
-- after signup — but Supabase requires email confirmation by default, so
-- there's no active session yet at that moment, and the insert gets
-- blocked by Row Level Security. Running this as a database trigger
-- (with security definer) sidesteps that entirely.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, city, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'city',
    'attendee'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 6. NEAREST-EVENTS INDEX (optional but recommended once you have volume)
-- ============================================================
create index events_lat_lng_idx on events (lat, lng);
create index events_date_idx on events (event_date);


-- ============================================================
-- 7. PAID EVENTS (flat listing fee + manual attendee payment)
-- ============================================================
-- Model: organizers pay Fandomly a flat ₱100 to publish a paid event.
-- Attendee ticket payments happen directly between attendee and organizer
-- (GCash, etc.) — Fandomly never touches that money. Organizers manually
-- confirm payment, which unlocks a QR entry pass emailed to the attendee.
-- See README.md for the edge functions this relies on:
--   xendit-create-payment (charges the organizer's ₱100 listing fee),
--   xendit-webhook (confirms it), send-pass-email (Resend).

alter table events
  add column is_paid boolean not null default false,
  add column price_php numeric(10,2),
  add column payment_instructions text,
  add column listing_fee_status text not null default 'unpaid'
    check (listing_fee_status in ('unpaid', 'paid')),
  add column listing_fee_invoice_id text,
  add constraint price_required_if_paid
    check (not is_paid or (price_php is not null and price_php > 0));

-- A paid event only becomes publicly visible once its listing fee is paid.
drop policy if exists "Published events are public, drafts visible to their organizer" on events;
create policy "Published + fee-paid events are public, others visible to their organizer"
  on events for select
  using (
    (status = 'published' and (not is_paid or listing_fee_status = 'paid'))
    or organizer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

alter table event_signups
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid')),
  add column qr_token uuid not null default gen_random_uuid() unique,
  add column checked_in boolean not null default false,
  add column checked_in_at timestamptz,
  add column pass_email_sent_at timestamptz;

-- Attendees can set status (going/interested) themselves, but payment
-- confirmation only happens through confirm_event_payment() below.
revoke insert, update on event_signups from authenticated;
grant insert (event_id, attendee_id, status) on event_signups to authenticated;
grant update (status) on event_signups to authenticated;

-- Organizer confirms a manual payment through this function rather than a
-- raw table update, so column grants for payment_status never need to be
-- loosened (which would let attendees mark themselves as paid).
create or replace function public.confirm_event_payment(p_event_id uuid, p_attendee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from events e
    where e.id = p_event_id
      and (e.organizer_id = auth.uid()
           or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  ) then
    raise exception 'Not authorized to confirm this payment';
  end if;

  update event_signups
  set payment_status = 'paid'
  where event_id = p_event_id and attendee_id = p_attendee_id;
end;
$$;

grant execute on function public.confirm_event_payment(uuid, uuid) to authenticated;

-- Check-in: organizer's phone opens a URL encoded in the attendee's QR
-- pass (no scanning library needed — any camera app reads a QR'd URL).
create or replace function public.check_in_attendee(p_qr_token uuid)
returns table(display_name text, event_title text, already_checked_in boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_attendee_id uuid;
  v_organizer_id uuid;
  v_already boolean;
  v_payment_status text;
begin
  select es.event_id, es.attendee_id, es.checked_in, es.payment_status, e.organizer_id
    into v_event_id, v_attendee_id, v_already, v_payment_status, v_organizer_id
  from event_signups es
  join events e on e.id = es.event_id
  where es.qr_token = p_qr_token;

  if v_event_id is null then
    raise exception 'Invalid pass';
  end if;

  if v_organizer_id != auth.uid()
     and not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Not authorized to check in attendees for this event';
  end if;

  if v_payment_status != 'paid' then
    raise exception 'This pass has not been marked as paid yet';
  end if;

  if not v_already then
    update event_signups set checked_in = true, checked_in_at = now()
    where event_id = v_event_id and attendee_id = v_attendee_id;
  end if;

  return query
    select p.display_name, e.title, v_already
    from profiles p, events e
    where p.id = v_attendee_id and e.id = v_event_id;
end;
$$;

grant execute on function public.check_in_attendee(uuid) to authenticated;


-- ============================================================
-- 9. FANDOM FOLLOWS + CUSTOM SIGNUP FIELDS
-- ============================================================
create table fandom_follows (
  attendee_id uuid not null references profiles(id) on delete cascade,
  kpop_group_id uuid not null references kpop_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (attendee_id, kpop_group_id)
);

alter table fandom_follows enable row level security;

create policy "Users manage their own follows"
  on fandom_follows for all
  using (attendee_id = auth.uid())
  with check (attendee_id = auth.uid());

alter table events
  add column custom_fields jsonb not null default '[]'::jsonb;

alter table event_signups
  add column custom_field_responses jsonb not null default '{}'::jsonb;

grant insert (custom_field_responses) on event_signups to authenticated;
grant update (custom_field_responses) on event_signups to authenticated;

-- ============================================================
-- 10. EVENT BANNER UPLOADS (Storage)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('event-banners', 'event-banners', true)
on conflict (id) do nothing;

create policy "Organizers can upload their own banners"
  on storage.objects for insert
  with check (
    bucket_id = 'event-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Organizers can replace their own banners"
  on storage.objects for update
  using (
    bucket_id = 'event-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Organizers can delete their own banners"
  on storage.objects for delete
  using (
    bucket_id = 'event-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view banners"
  on storage.objects for select
  using (bucket_id = 'event-banners');

-- ============================================================
-- 8. MAKE YOURSELF THE FIRST ADMIN
-- ============================================================
-- After you've signed up through the app once, run this (with your own email)
-- to promote your account to admin so you can approve organizers:
--
-- update profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'your-email@example.com');
