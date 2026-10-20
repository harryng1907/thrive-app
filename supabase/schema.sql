-- =====================================================================
-- POOL — database schema, privacy rules (RLS) and server-side logic.
-- Safe to re-run: it drops and recreates every POOL table and function.
-- Run with:  npm run db:setup   (rebuilds everything + demo data)
-- Logic lives in functions.sql (safe to re-apply any time: npm run db:functions)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

drop table if exists
  public.friendships, public.messages, public.app_events, public.reports, public.venue_ratings, public.member_ratings,
  public.squad_members, public.squads, public.swipes, public.activities,
  public.availability, public.profile_courses, public.profiles, public.venues
  cascade;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Public campus places. Sessions only ever happen at one of these.
create table public.venues (
  id        text primary key,
  name      text not null,
  detail    text,
  category  text not null check (category in ('quiet','social','active','maker','food'))
);

-- One row per user. Private: only the owner can read it directly.
-- Squad-mates see a subset through get_my_squads(), and only after the squad is confirmed.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  full_name     text,
  initials      text not null,
  avatar_color  text not null default '#0E5B66',
  degree        text not null default 'Uni student',
  degree_short  text not null default 'Uni',
  year          smallint not null default 1,
  vibe          text,          -- free-text "how do you like to hang out / study"
  status_quote  text,          -- shown to squad-mates after reveal
  group_pref    text not null default 'small' check (group_pref in ('one','small','any')),
  interests     text[] not null default '{}',  -- hobbies picked in onboarding (same vocabulary as activity tags)
  real_only     boolean not null default false,  -- never match with simulated students
  avatar_url    text,                            -- profile photo (shown to squad-mates after reveal)
  friend_code   text unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  is_seed       boolean not null default false,  -- simulated students for the demo
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table public.profile_courses (
  user_id  uuid references public.profiles(id) on delete cascade,
  course   text not null,
  primary key (user_id, course)
);

-- Weekly free windows in Sydney local time. dow: 0 = Sunday … 6 = Saturday.
create table public.availability (
  user_id     uuid references public.profiles(id) on delete cascade,
  dow         smallint not null check (dow between 0 and 6),
  start_hour  smallint not null check (start_hour between 0 and 23),
  end_hour    smallint not null check (end_hour between 1 and 24),
  primary key (user_id, dow, start_hour),
  check (end_hour > start_hour)
);

-- The swipe deck. 'interest' cards have no fixed time (the matcher finds one);
-- 'session' cards are real events with a time and a venue.
create table public.activities (
  id             text primary key,
  kind           text not null check (kind in ('interest','session')),
  squad_type     text not null check (squad_type in ('deadline','hobby','career')),
  title          text not null,
  description    text,
  course         text,
  category       text not null check (category in ('quiet','social','active','maker','food')),
  tags           text[] not null default '{}',
  icon           text not null default 'sparkles',
  duration_mins  int not null default 120,
  venue_id       text references public.venues(id),
  starts_at      timestamptz,
  capacity       int not null default 4 check (capacity between 2 and 4),
  host           text,   -- society running the event (null for everything else)
  is_private     boolean not null default false,  -- a plan made for friends; never in anyone's deck
  created_by     uuid references public.profiles(id) on delete cascade,  -- set when a student suggested it
  created_at     timestamptz not null default now()
);

create table public.swipes (
  user_id      uuid references public.profiles(id) on delete cascade,
  activity_id  text references public.activities(id) on delete cascade,
  decision     text not null check (decision in ('in','pass')),
  created_at   timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create table public.squads (
  id           uuid primary key default gen_random_uuid(),
  activity_id  text not null references public.activities(id) on delete cascade,
  venue_id     text references public.venues(id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'proposed'
               check (status in ('proposed','confirmed','completed','cancelled')),
  reasons      text[] not null default '{}',
  ai_reason    text,   -- one sentence written by Claude from everyone's own words
  rebook_of    uuid references public.squads(id) on delete set null,
  was_confirmed boolean not null default false,  -- was confirmed, now re-confirming a new time
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.squad_members (
  squad_id      uuid references public.squads(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  status        text not null default 'invited' check (status in ('invited','accepted','declined')),
  responded_at  timestamptz,
  go_ahead      boolean not null default false,  -- voted to start without people who haven't answered
  checked_in_at timestamptz,                       -- tapped "I'm here" at the session
  primary key (squad_id, user_id)
);

-- "Would you go again with this person?" 1–5
create table public.member_ratings (
  squad_id    uuid references public.squads(id) on delete cascade,
  rater_id    uuid references public.profiles(id) on delete cascade,
  ratee_id    uuid references public.profiles(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  created_at  timestamptz not null default now(),
  primary key (squad_id, rater_id, ratee_id)
);

create table public.venue_ratings (
  squad_id    uuid references public.squads(id) on delete cascade,
  rater_id    uuid references public.profiles(id) on delete cascade,
  venue_id    text references public.venues(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  primary key (squad_id, rater_id)
);

create table public.reports (
  id           bigserial primary key,
  reporter_id  uuid references public.profiles(id) on delete cascade,
  reported_id  uuid references public.profiles(id) on delete cascade,
  squad_id     uuid references public.squads(id) on delete set null,
  reason       text,
  created_at   timestamptz not null default now()
);

-- Lightweight analytics (app opens etc.) for the metrics screen.
create table public.app_events (
  id          bigserial primary key,
  user_id     uuid default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null,
  props       jsonb,
  created_at  timestamptz not null default now()
);

-- Squad chat. Only members of a confirmed (or finished) squad can read or post.
create table public.messages (
  id          bigserial primary key,
  squad_id    uuid not null references public.squads(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index on public.messages (squad_id, created_at);
alter table public.messages enable row level security;

-- Friends added with a friend code (stored once per pair, a < b).
create table public.friendships (
  a          uuid not null references public.profiles(id) on delete cascade,
  b          uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

create index on public.swipes (activity_id, decision);
create index on public.activities (created_by, created_at);
create index on public.squad_members (user_id);
create index on public.member_ratings (rater_id);
create index on public.app_events (user_id, created_at);

-- ---------------------------------------------------------------------
-- Row-level security: the database itself enforces privacy.
-- ---------------------------------------------------------------------

alter table public.venues          enable row level security;
alter table public.profiles        enable row level security;
alter table public.profile_courses enable row level security;
alter table public.availability    enable row level security;
alter table public.activities      enable row level security;
alter table public.swipes          enable row level security;
alter table public.squads          enable row level security;
alter table public.squad_members   enable row level security;
alter table public.member_ratings  enable row level security;
alter table public.venue_ratings   enable row level security;
alter table public.reports         enable row level security;
alter table public.app_events      enable row level security;
alter table public.friendships     enable row level security;

create or replace function public.is_squad_member(p_squad uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from squad_members where squad_id = p_squad and user_id = auth.uid());
$$;

create policy "venues readable"     on public.venues     for select to authenticated using (true);
create policy "activities readable" on public.activities for select to authenticated using (true);

-- Nobody can browse other people's profiles.
create policy "own profile read"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own courses"      on public.profile_courses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own availability" on public.availability    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own swipes"       on public.swipes          for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "member reads squad"       on public.squads        for select to authenticated using (public.is_squad_member(id));
create policy "own membership read"      on public.squad_members for select to authenticated using (user_id = auth.uid());
create policy "own member ratings read"  on public.member_ratings for select to authenticated using (rater_id = auth.uid());
create policy "own venue ratings read"   on public.venue_ratings  for select to authenticated using (rater_id = auth.uid());
create policy "file a report"            on public.reports        for insert to authenticated with check (reporter_id = auth.uid());
create policy "log own events"           on public.app_events     for insert to authenticated with check (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- Profile photo storage
-- ---------------------------------------------------------------------
-- Photo storage: public bucket, but file names are random and only shared with squad-mates after reveal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

drop policy if exists "avatar upload own folder" on storage.objects;
drop policy if exists "avatar update own folder" on storage.objects;
drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
