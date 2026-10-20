-- Thrive: full database setup. Paste into Supabase → SQL Editor → Run (once, on an empty project).

-- ===== supabase/schema.sql =====
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
  degree        text not null default 'UNSW student',
  degree_short  text not null default 'UNSW',
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

-- ===== supabase/functions.sql =====
-- =====================================================================
-- POOL — server-side logic (Postgres functions called by the app via RPC).
-- Safe to re-run at any time; does not touch data.
--   npm run db:functions
-- =====================================================================

-- ---------------------------------------------------------------------
-- Sign-up: UNSW emails only, and every new account gets a profile row.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_local text := coalesce(split_part(new.email, '@', 1), 'guest');
  v_name  text;
begin
  -- Guests (anonymous demo sessions) are allowed; real accounts must be UNSW.
  if not coalesce(new.is_anonymous, false) and (new.email is null
     or not (new.email ilike '%@unsw.edu.au' or new.email ilike '%.unsw.edu.au' or new.email ilike '%@pool.demo')) then
    raise exception 'Pool is only open to UNSW students (use your UNSW email).';
  end if;
  -- Microsoft (UNSW) sign-in brings the student's real name; email sign-up doesn't.
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '');
  insert into profiles (id, display_name, full_name, initials, avatar_color, real_only)
  values (new.id,
          coalesce(split_part(v_name, ' ', 1), initcap(v_local)),
          v_name,
          upper(coalesce(left(split_part(v_name, ' ', 1), 1) || nullif(left(split_part(v_name, ' ', 2), 1), ''), left(coalesce(v_name, v_local), 2))),
          ('{#0E5B66,#2563EB,#9333EA,#DC2626,#EA580C,#16A34A,#DB2777,#0891B2}'::text[])[1 + abs(hashtext(new.id::text)) % 8],
          -- Real UNSW accounts only ever match real people; demo + guest accounts get the simulated students.
          not coalesce(new.is_anonymous, false) and new.email not ilike '%@pool.demo')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Time helpers (all scheduling is in Sydney local time)
-- ---------------------------------------------------------------------

-- Next occurrence of weekday/hour, at least 2 hours from now.
create or replace function public.pool_next_slot(p_dow int, p_hour int)
returns timestamptz language sql stable as $$
  select min((d::date + make_time(p_hour, 0, 0)) at time zone 'Australia/Sydney')
  from generate_series((now() at time zone 'Australia/Sydney')::date,
                       (now() at time zone 'Australia/Sydney')::date + 7, interval '1 day') d
  where extract(dow from d) = p_dow
    and ((d::date + make_time(p_hour, 0, 0)) at time zone 'Australia/Sydney') > now() + interval '2 hours';
$$;

-- Is this user free for the whole window, and not already booked into another squad?
create or replace function public.pool_is_free(p_user uuid, p_start timestamptz, p_mins int)
returns boolean language sql stable security definer set search_path = public as $$
  with t as (select p_start at time zone 'Australia/Sydney' as l)
  select exists (
    select 1 from availability av, t
    where av.user_id = p_user
      and av.dow = extract(dow from t.l)
      and av.start_hour <= extract(hour from t.l) + extract(minute from t.l) / 60.0
      and av.end_hour   >= extract(hour from t.l) + extract(minute from t.l) / 60.0 + p_mins / 60.0
  ) and not exists (
    -- Already booked then? (Simulated demo students can be in many squads at once,
    -- so several judges can run the same demo in parallel.)
    select 1 from squad_members m join squads s on s.id = m.squad_id
    where m.user_id = p_user and m.status <> 'declined' and s.status in ('proposed','confirmed')
      and not (select is_seed from profiles where id = p_user)
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(p_start, p_start + make_interval(mins => p_mins))
  );
$$;
revoke all on function public.pool_is_free(uuid, timestamptz, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- The deck
-- ---------------------------------------------------------------------

create or replace function public.get_deck(p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;

  -- Real sessions recur weekly: roll any past ones forward so the deck never goes stale.
  update activities
     set starts_at = starts_at + ceil(extract(epoch from (now() - starts_at)) / 604800.0) * interval '7 days'
   where kind = 'session' and starts_at < now();

  return coalesce((
    select jsonb_agg(card order by rank desc, a.starts_at nulls last, a.id)
    from (
      select a.*, v.name as venue_name, v.detail as venue_detail, ic.n as interested,
             -- rank: my courses first, then things like what I've said yes to, then real sessions, then popularity
             (case when a.course in (select course from profile_courses where user_id = v_me) then 4 else 0 end)
           + (select count(*) from swipes s join activities x on x.id = s.activity_id, unnest(x.tags) t
               where s.user_id = v_me and s.decision = 'in' and t = any(a.tags))
           + 1.5 * cardinality(array(select unnest(a.tags) intersect select unnest(me.interests)))
           + (case when a.kind = 'session' then 1.5 else 0 end)
           + ln(1 + ic.n) * 0.5
           -- happening in the next couple of days → a little higher
           + (case when a.starts_at < now() + interval '2 days' then 0.5 else 0 end) as rank
      from activities a
      cross join (select coalesce(interests, '{}') as interests, real_only from profiles where id = v_me) me
      left join venues v on v.id = a.venue_id
      cross join lateral (
        select count(*) as n from swipes s
        where s.activity_id = a.id and s.decision = 'in' and s.user_id <> v_me
          and not (me.real_only and (select is_seed from profiles where id = s.user_id))
      ) ic
      where not exists (select 1 from swipes s where s.activity_id = a.id and s.user_id = v_me)
        and not a.is_private
        -- Student ideas only show to people in the same world (real students vs demo/guests).
        and (a.created_by is null or a.created_by = v_me
             or (select real_only from profiles where id = a.created_by) = me.real_only)
      order by rank desc, a.starts_at nulls last, a.id
      limit p_limit
    ) a
    cross join lateral (
      select jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'squad_type', a.squad_type, 'title', a.title,
        'description', a.description, 'course', a.course, 'category', a.category,
        'tags', a.tags, 'icon', a.icon, 'duration_mins', a.duration_mins,
        'starts_at', a.starts_at, 'capacity', a.capacity,
        'host', a.host, 'suggested', a.created_by is not null,
        'venue', case when a.venue_id is null then null
                      else jsonb_build_object('id', a.venue_id, 'name', a.venue_name, 'detail', a.venue_detail) end,
        'interested_count', a.interested,
        'spots_left', case when a.kind = 'session' then greatest(1, a.capacity - (
            select count(distinct m.user_id) from squads s join squad_members m on m.squad_id = s.id
            where s.activity_id = a.id and s.status in ('proposed','confirmed') and m.status = 'accepted'))
          else null end
      ) as card
    ) c
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- The matcher
--   Scores candidates on: said "I'm in" to the same card, shared tags from past
--   swipes, shared courses, the card's course, ratings you gave them before,
--   and a small mixed-year bonus. Hard filters: group-size preference, no
--   reports, no low ratings either way, and actually free at the chosen time.
--   Then picks a time everyone is free and a public venue nobody rated badly.
-- ---------------------------------------------------------------------

drop function if exists public.form_squad(text, uuid[], uuid);
create or replace function public.form_squad(
  p_activity text,
  p_preferred uuid[] default '{}',
  p_rebook_of uuid default null,
  p_at timestamptz default null  -- exact time already agreed (from plan options)
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me          uuid := auth.uid();
  a             activities%rowtype;
  me            profiles%rowtype;
  v_has_pref    boolean := coalesce(array_length(p_preferred, 1), 0) > 0;
  v_target      int;
  v_fixed_time  boolean;
  v_slot        timestamptz;
  v_best_slot   timestamptz;
  v_best_count  int := 0;
  v_count       int;
  v_pool_size   int;
  v_chosen      uuid[];
  v_everyone    uuid[];
  v_venue       text;
  v_venue_name  text;
  v_avoided     text;
  v_squad       uuid;
  v_reasons     text[] := '{}';
  v_required    uuid;  -- the student who suggested this activity always gets a spot
  v_from        timestamptz := now() + interval '2 hours';
  r             record;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  select * into a from activities where id = p_activity;
  if not found then raise exception 'unknown activity %', p_activity; end if;
  select * into me from profiles where id = v_me;

  -- Already in an active squad for this card? Return it instead of making another.
  if p_rebook_of is null then
    select s.id into v_squad
    from squads s join squad_members m on m.squad_id = s.id
    where s.activity_id = p_activity and m.user_id = v_me and m.status <> 'declined'
      and s.status in ('proposed','confirmed')
    limit 1;
    if v_squad is not null then return v_squad; end if;
  end if;

  v_target := case when v_has_pref then array_length(p_preferred, 1)
                   when me.group_pref = 'one' then 1
                   else 3 end;
  if a.kind = 'session' then v_target := least(v_target, a.capacity - 1); end if;
  v_fixed_time := a.kind = 'session' and a.starts_at > now() + interval '30 minutes' and p_rebook_of is null;

  -- 1. Score everyone who could plausibly join.
  drop table if exists _cand;
  create temp table _cand on commit drop as
  with my_courses as (select course from profile_courses where user_id = v_me),
  eligible as (
    select p.* from profiles p
    where p.id <> v_me
      -- Two separate worlds: real-only people match each other; everyone else (demo, guests,
      -- simulated students) matches each other. Judges never get paired with real students.
      and p.real_only = me.real_only
      and (p.id = any(p_preferred) or case me.group_pref
            when 'one'   then p.group_pref in ('one','any')
            when 'small' then p.group_pref in ('small','any')
            else true end)
      and not exists (select 1 from swipes s where s.user_id = p.id and s.activity_id = a.id and s.decision = 'pass')
      and not exists (select 1 from reports rp where (rp.reporter_id = v_me and rp.reported_id = p.id)
                                                 or (rp.reporter_id = p.id and rp.reported_id = v_me))
      and coalesce((select avg(score) from member_ratings mr where mr.rater_id = v_me and mr.ratee_id = p.id), 3) > 2
      and coalesce((select avg(score) from member_ratings mr where mr.rater_id = p.id and mr.ratee_id = v_me), 3) > 2
  )
  select p.id, p.is_seed, p.year,
      (case when p.id = any(p_preferred) then 20 else 0 end)
    + (case when exists (select 1 from swipes s where s.user_id = p.id and s.activity_id = a.id and s.decision = 'in') then 5 else 0 end)
    + least(3, (select count(distinct t) from swipes s join activities x on x.id = s.activity_id, unnest(x.tags) t
                 where s.user_id = p.id and s.decision = 'in' and t = any(a.tags)))
    + 2 * (select count(*) from profile_courses pc where pc.user_id = p.id and pc.course in (select course from my_courses))
    + (case when a.course is not null and exists (select 1 from profile_courses pc where pc.user_id = p.id and pc.course = a.course) then 3 else 0 end)
    + (case when (select avg(score) from member_ratings mr where mr.rater_id = v_me and mr.ratee_id = p.id) >= 4 then 6 else 0 end)
    + least(3, cardinality(array(select unnest(p.interests) intersect select unnest(me.interests))))
    + least(2, cardinality(array(select unnest(p.interests) intersect select unnest(a.tags))))
    + 3 * coalesce(extensions.similarity(lower(p.vibe), lower(me.vibe)), 0)  -- similar "in your words" lines
    + (case when p.year <> me.year then 0.5 else 0 end) as score
  from eligible p;

  if v_has_pref then
    delete from _cand where not (id = any(p_preferred));
  else
    delete from _cand where score < 5;
  end if;

  -- Real people only: never simulated students.
  if me.real_only then
    delete from _cand where is_seed;
  end if;

  -- A student-suggested activity always includes the person who suggested it.
  if a.created_by is not null and a.created_by <> v_me then
    select id into v_required from _cand where id = a.created_by;
    update _cand set score = score + 20 where id = v_required;
  end if;

  if not v_has_pref then
    delete from _cand where id not in (select id from _cand order by score desc limit 8);
  end if;

  -- 2. Pick a time. A rebook looks from the day after the last session onwards.
  if p_rebook_of is not null then
    select greatest(v_from, ((starts_at at time zone 'Australia/Sydney')::date + 1)::timestamp at time zone 'Australia/Sydney')
      into v_from from squads where id = p_rebook_of;
  end if;

  if p_at is not null and p_at > now() then
    v_best_slot := p_at;
  elsif v_fixed_time then
    v_best_slot := a.starts_at;
  else
    select count(*) into v_pool_size from _cand;
    for v_slot in
      select (d::date + make_time(h, 0, 0)) at time zone 'Australia/Sydney'
      from generate_series((v_from at time zone 'Australia/Sydney')::date,
                           (v_from at time zone 'Australia/Sydney')::date + 7, interval '1 day') d,
           generate_series(8, 20) h
      where ((d::date + make_time(h, 0, 0)) at time zone 'Australia/Sydney') >= v_from
      order by 1
    loop
      continue when not pool_is_free(v_me, v_slot, a.duration_mins);
      continue when v_required is not null and not pool_is_free(v_required, v_slot, a.duration_mins);
      select count(*) into v_count from _cand c where pool_is_free(c.id, v_slot, a.duration_mins);
      continue when v_has_pref and v_count < v_pool_size;  -- rebook: everyone you asked for must be free
      if v_count > v_best_count then
        v_best_count := v_count;
        v_best_slot := v_slot;
      end if;
      exit when v_count >= v_target;
    end loop;
    if v_best_slot is null then return null; end if;
  end if;

  delete from _cand c where not pool_is_free(c.id, v_best_slot, a.duration_mins);

  select array_agg(id order by score desc) into v_chosen
  from (select id, score from _cand order by score desc limit v_target) z;
  if v_chosen is null then return null; end if;
  v_everyone := v_chosen || v_me;

  -- 3. Pick a venue: the card's own venue or one of the same type, skipping anywhere
  --    a squad member rated 2★ or lower, preferring places they rated well.
  select v.id, v.name into v_venue, v_venue_name
  from venues v
  left join (
    select venue_id, avg(score) as avg_score, min(score) as min_score
    from venue_ratings where rater_id = any(v_everyone) group by venue_id
  ) vr on vr.venue_id = v.id
  where (v.id = a.venue_id or v.category = a.category)
    and coalesce(vr.min_score, 5) > 2
  order by (v.id = a.venue_id and p_rebook_of is null) desc,
           vr.avg_score desc nulls last,
           md5(v.id || v_me::text)
  limit 1;

  if v_venue is null then
    select v.id, v.name into v_venue, v_venue_name from venues v
    where v.id = a.venue_id or v.category = a.category order by (v.id = a.venue_id) desc limit 1;
  end if;

  select v.name into v_avoided
  from venue_ratings vr join venues v on v.id = vr.venue_id
  where vr.rater_id = v_me and vr.score <= 2 and (v.category = a.category or v.id = a.venue_id)
    and v.id <> v_venue
  order by vr.created_at desc limit 1;

  -- 4. Explain the match in plain words.
  if a.course is not null then
    select count(*) into v_count from profile_courses where course = a.course and user_id = any(v_everyone);
    if v_count = 2 and array_length(v_everyone, 1) = 2 then
      v_reasons := v_reasons || format('You both take %s', a.course);
    elsif v_count = array_length(v_everyone, 1) then
      v_reasons := v_reasons || format('All %s of you take %s', v_count, a.course);
    elsif v_count >= 2 then
      v_reasons := v_reasons || format('%s of you take %s', v_count, a.course);
    end if;
  else
    select course, count(*) as n into r from profile_courses
    where user_id = any(v_everyone) group by course having count(*) >= 2 order by count(*) desc limit 1;
    if found then
      v_reasons := v_reasons || case when r.n = 2 and array_length(v_everyone, 1) = 2
                                     then format('You both take %s', r.course)
                                     else format('%s of you take %s', r.n, r.course) end;
    end if;
  end if;

  v_reasons := v_reasons || format('Everyone is free %s',
    to_char(v_best_slot at time zone 'Australia/Sydney', 'FMDay FMHH12:MI AM'));

  select count(*) into v_count from swipes
  where activity_id = a.id and decision = 'in' and user_id = any(v_chosen);
  if v_count = array_length(v_chosen, 1) then
    v_reasons := v_reasons || case when v_count = 1 then 'They said "I''m in" to this too' else 'Everyone said "I''m in" to this too' end;
  elsif v_count > 0 then
    v_reasons := v_reasons || format('%s of them said "I''m in" to this too', v_count);
  else
    select t, count(*) as n into r
    from swipes s join activities x on x.id = s.activity_id, unnest(x.tags) t
    where s.user_id = any(v_chosen) and s.decision = 'in' and t = any(a.tags)
    group by t order by count(*) desc limit 1;
    if found then v_reasons := v_reasons || format('They keep saying yes to "%s" too', r.t); end if;
  end if;

  select string_agg(t, ' & ') as ts into r from (
    select t from unnest(me.interests) t
    where (select count(*) from profiles where id = any(v_chosen) and t = any(interests)) = array_length(v_chosen, 1)
    order by (t = any(a.tags)) desc, t limit 2
  ) z;
  if r.ts is not null then
    v_reasons := v_reasons || format('You''re all into %s', r.ts);
  end if;

  for r in
    select p.display_name, round(avg(mr.score))::int as s
    from member_ratings mr join profiles p on p.id = mr.ratee_id
    where mr.rater_id = v_me and mr.ratee_id = any(v_chosen)
    group by p.display_name having avg(mr.score) >= 4
  loop
    v_reasons := v_reasons || format('You rated %s %s★ last time', r.display_name, r.s);
  end loop;

  if exists (select 1 from profiles where id = any(v_chosen) and year >= me.year + 2) then
    v_reasons := v_reasons || 'Includes a later-year student who''s been through this'::text;
  end if;

  if v_avoided is not null then
    v_reasons := v_reasons || format('Moved to %s — you rated %s low', v_venue_name, v_avoided);
  end if;

  -- 5. Create the squad. Simulated (seed) students accept instantly; real users get invited.
  insert into squads (activity_id, venue_id, starts_at, ends_at, status, reasons, rebook_of, created_by)
  values (a.id, v_venue, v_best_slot, v_best_slot + make_interval(mins => a.duration_mins),
          'proposed', v_reasons, p_rebook_of, v_me)
  returning id into v_squad;

  insert into squad_members (squad_id, user_id, status) values (v_squad, v_me, 'invited');
  insert into squad_members (squad_id, user_id, status, responded_at)
  select v_squad, p.id, case when p.is_seed then 'accepted' else 'invited' end,
         case when p.is_seed then now() end
  from profiles p where p.id = any(v_chosen);

  return v_squad;
end $$;

-- Swipe, and on "I'm in" immediately try to form a squad. Returns the squad id or null.
create or replace function public.swipe(p_activity text, p_decision text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into swipes (user_id, activity_id, decision) values (auth.uid(), p_activity, p_decision)
  on conflict (user_id, activity_id) do update set decision = excluded.decision, created_at = now();
  if p_decision = 'in' then
    return form_squad(p_activity);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Squads: list, respond, finish, rate, rebook
-- ---------------------------------------------------------------------

create or replace function public.get_my_squads()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;

  update squads set status = 'completed'
  where status = 'confirmed' and ends_at < now()
    and id in (select squad_id from squad_members where user_id = v_me);

  -- Nobody waits forever: at the answer-by time, anyone who hasn't answered is dropped.
  perform pool_settle_squad(s.id, true)
  from squads s
  where s.status = 'proposed' and pool_respond_by(s.id) < now()
    and s.id in (select squad_id from squad_members where user_id = v_me);

  return coalesce((
    select jsonb_agg(sq order by rk, starts_at desc)
    from (
      select case s.status when 'proposed' then 0 when 'confirmed' then 1 else 2 end as rk,
             s.starts_at,
             jsonb_build_object(
               'id', s.id, 'status', s.status, 'my_status', mm.status, 'my_go_ahead', mm.go_ahead, 'respond_by', pool_respond_by(s.id), 'ai_reason', s.ai_reason,
               'my_checked_in', mm.checked_in_at is not null,
               'starts_at', s.starts_at, 'ends_at', s.ends_at,
               'reasons', s.reasons, 'rebook_of', s.rebook_of,
               'revealed', s.status in ('confirmed','completed') or s.was_confirmed,
               'was_confirmed', s.was_confirmed,
               'fixed_time', a.kind = 'session' and not a.is_private and a.host is not null,
               'rated', exists (select 1 from member_ratings r where r.squad_id = s.id and r.rater_id = v_me)
                     or exists (select 1 from venue_ratings r where r.squad_id = s.id and r.rater_id = v_me),
               'activity', jsonb_build_object(
                 'id', a.id, 'title', a.title, 'description', a.description, 'course', a.course,
                 'category', a.category, 'squad_type', a.squad_type, 'icon', a.icon, 'tags', a.tags,
                 'host', a.host,
                 'duration_mins', a.duration_mins),
               'venue', jsonb_build_object('id', v.id, 'name', v.name, 'detail', v.detail),
               'members', (
                 select jsonb_agg(
                   -- Privacy: names, faces and quotes only after everyone has accepted.
                   case when s.status in ('confirmed','completed') or s.was_confirmed or m.user_id = v_me
                          -- …or you've already met them in a past session
                          or exists (select 1 from squads ps
                                     join squad_members a1 on a1.squad_id = ps.id and a1.user_id = v_me and a1.status = 'accepted'
                                     join squad_members a2 on a2.squad_id = ps.id and a2.user_id = m.user_id and a2.status = 'accepted'
                                     where ps.status = 'completed')
                          -- …or they're your friend (you added each other's code)
                          or exists (select 1 from friendships fr
                                     where fr.a = least(v_me, m.user_id) and fr.b = greatest(v_me, m.user_id)) then
                     jsonb_build_object(
                       'id', p.id, 'name', p.display_name, 'initials', p.initials,
                       'avatar_color', p.avatar_color, 'degree', p.degree, 'degree_short', p.degree_short,
                       'year', p.year, 'status_quote', p.status_quote,
                       'is_me', m.user_id = v_me, 'status', m.status, 'hidden', false, 'go_ahead', m.go_ahead,
                       'avatar_url', p.avatar_url,
                       'checked_in', m.checked_in_at is not null)
                   else
                     jsonb_build_object(
                       'id', null, 'name', p.degree_short || ' student', 'initials', '?',
                       'avatar_color', '#B8C2CC', 'degree', p.degree, 'degree_short', p.degree_short,
                       'year', p.year, 'status_quote', null,
                       'is_me', false, 'status', m.status, 'hidden', true, 'go_ahead', m.go_ahead, 'checked_in', false)
                   end
                   order by (m.user_id = v_me), m.responded_at nulls last)
                 from squad_members m join profiles p on p.id = m.user_id
                 where m.squad_id = s.id and m.status <> 'declined')
             ) as sq
      from squads s
      join squad_members mm on mm.squad_id = s.id and mm.user_id = v_me
      join activities a on a.id = s.activity_id
      left join venues v on v.id = s.venue_id
      where mm.status <> 'declined' and s.status <> 'cancelled'
    ) q
  ), '[]'::jsonb);
end $$;

-- Accept or decline a proposed squad. Confirms it once everyone left has accepted.
create or replace function public.respond_squad(p_squad uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_status text;
  v_left int;
  v_pending int;
begin
  update squad_members set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where squad_id = p_squad and user_id = v_me;
  if not found then raise exception 'not in this squad'; end if;

  select count(*) filter (where status <> 'declined'), count(*) filter (where status = 'invited')
    into v_left, v_pending
  from squad_members where squad_id = p_squad;

  if v_left < 2 then
    update squads set status = 'cancelled' where id = p_squad and status = 'proposed';
  elsif v_pending = 0 then
    update squads set status = 'confirmed' where id = p_squad and status = 'proposed';
    if found and not (select was_confirmed from squads where id = p_squad) then perform pool_seed_says(p_squad, 'intro'); end if;
  end if;

  select status into v_status from squads where id = p_squad;
  return v_status;
end $$;

-- Mark a confirmed session as done (normally happens automatically when it ends;
-- this lets the demo skip ahead).
create or replace function public.end_session(p_squad uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_squad_member(p_squad) then raise exception 'not in this squad'; end if;
  update squads set status = 'completed' where id = p_squad and status = 'confirmed';
end $$;

-- p_scores: [{ "user_id": "...", "score": 1-5 }, ...]
create or replace function public.rate_squad(p_squad uuid, p_scores jsonb, p_venue_score int default null, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if not exists (
    select 1 from squads s join squad_members m on m.squad_id = s.id
    where s.id = p_squad and m.user_id = v_me and s.status = 'completed'
  ) then
    raise exception 'You can rate a squad after the session';
  end if;

  insert into member_ratings (squad_id, rater_id, ratee_id, score)
  select p_squad, v_me, (e->>'user_id')::uuid, (e->>'score')::int
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) e
  where (e->>'user_id')::uuid in (select user_id from squad_members where squad_id = p_squad and user_id <> v_me)
  on conflict (squad_id, rater_id, ratee_id) do update set score = excluded.score, created_at = now();

  -- Simulated students rate you back, so the demo can show mutual connections.
  insert into member_ratings (squad_id, rater_id, ratee_id, score)
  select p_squad, (e->>'user_id')::uuid, v_me,
         case when (e->>'score')::int >= 4 then 4 + abs(hashtext(v_me::text || (e->>'user_id'))) % 2 else 3 end
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) e
  join profiles p on p.id = (e->>'user_id')::uuid and p.is_seed
  on conflict (squad_id, rater_id, ratee_id) do nothing;

  if p_venue_score is not null then
    insert into venue_ratings (squad_id, rater_id, venue_id, score, comment)
    select p_squad, v_me, venue_id, p_venue_score, p_comment from squads where id = p_squad
    on conflict (squad_id, rater_id) do update set score = excluded.score, comment = excluded.comment, created_at = now();
  end if;
end $$;

-- "Go again?" suggestions: past squads where you rated someone 4★+ and haven't rebooked yet.
create or replace function public.get_nudges()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  return coalesce((
    select jsonb_agg(n order by ended desc)
    from (
      select s.ends_at as ended,
             jsonb_build_object(
               'squad_id', s.id, 'activity_title', a.title, 'activity_icon', a.icon,
               'venue_name', v.name,
               'venue_score', (select score from venue_ratings vr where vr.squad_id = s.id and vr.rater_id = v_me),
               'names', jsonb_agg(p.display_name order by r.score desc),
               'user_ids', jsonb_agg(p.id order by r.score desc),
               'top_score', max(r.score)) as n
      from squads s
      join member_ratings r on r.squad_id = s.id and r.rater_id = v_me and r.score >= 4
      join profiles p on p.id = r.ratee_id
      join activities a on a.id = s.activity_id
      left join venues v on v.id = s.venue_id
      where s.status = 'completed'
        and not exists (
          select 1 from squads s2 join squad_members m2 on m2.squad_id = s2.id and m2.user_id = v_me
          where s2.rebook_of = s.id and s2.status <> 'cancelled' and m2.status <> 'declined')
      group by s.id, a.title, a.icon, v.name, s.ends_at
      order by s.ends_at desc
      limit 3
    ) q
  ), '[]'::jsonb);
end $$;

-- Rebook with the people you rated 4★+ from a past squad.
create or replace function public.rebook(p_squad uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_pref uuid[];
  v_activity text;
begin
  if not is_squad_member(p_squad) then raise exception 'not in this squad'; end if;
  select array_agg(ratee_id) into v_pref from (
    select ratee_id from member_ratings
    where squad_id = p_squad and rater_id = auth.uid()
    group by ratee_id having avg(score) >= 4
  ) z;
  if v_pref is null then raise exception 'Rate someone 4★ or more to rebook with them'; end if;
  select activity_id into v_activity from squads where id = p_squad;
  return form_squad(v_activity, v_pref, p_squad);
end $$;

-- ---------------------------------------------------------------------
-- Profile + metrics
-- ---------------------------------------------------------------------

create or replace function public.get_me()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  return (
    select jsonb_build_object(
      'id', p.id, 'name', p.display_name, 'full_name', p.full_name, 'initials', p.initials,
      'avatar_color', p.avatar_color, 'degree', p.degree, 'degree_short', p.degree_short,
      'year', p.year, 'vibe', p.vibe, 'status_quote', p.status_quote, 'group_pref', p.group_pref, 'real_only', p.real_only,
      'interests', to_jsonb(p.interests),
      'onboarded', p.onboarded_at is not null,
      'friend_code', p.friend_code, 'avatar_url', p.avatar_url,
      'email', (select coalesce(email, '') from auth.users where id = v_me),
      'is_guest', (select coalesce(is_anonymous, false) from auth.users where id = v_me),
      'courses', coalesce((select jsonb_agg(course order by course) from profile_courses where user_id = v_me), '[]'),
      'availability', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'start', start_hour, 'end', end_hour) order by dow, start_hour)
                                from availability where user_id = v_me), '[]'),
      'stats', jsonb_build_object(
        'swipes', (select count(*) from swipes where user_id = v_me and decision = 'in'),
        'squads_done', (select count(*) from squads s join squad_members m on m.squad_id = s.id
                        where m.user_id = v_me and m.status = 'accepted' and s.status = 'completed'),
        'hours', coalesce((select round(sum(extract(epoch from (s.ends_at - s.starts_at))) / 3600)
                           from squads s join squad_members m on m.squad_id = s.id
                           where m.user_id = v_me and m.status = 'accepted' and s.status = 'completed'), 0),
        'people_met', (select count(distinct m2.user_id) from squads s
                       join squad_members m on m.squad_id = s.id and m.user_id = v_me and m.status = 'accepted'
                       join squad_members m2 on m2.squad_id = s.id and m2.user_id <> v_me and m2.status = 'accepted'
                       where s.status = 'completed'))
    )
    from profiles p where p.id = v_me
  );
end $$;

-- Funnel + retention straight from the tables. p_include_seed adds the simulated students.
create or replace function public.get_metrics(p_include_seed boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_users uuid[];
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select array_agg(id) into v_users from profiles where p_include_seed or not is_seed;
  v_users := coalesce(v_users, '{}');

  return jsonb_build_object(
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Signed up',  'users', array_length(v_users, 1)),
      jsonb_build_object('step', 'Onboarded',  'users', (select count(*) from profiles where id = any(v_users) and onboarded_at is not null)),
      jsonb_build_object('step', 'Swiped',     'users', (select count(distinct user_id) from swipes where user_id = any(v_users))),
      jsonb_build_object('step', 'Matched',    'users', (select count(distinct user_id) from squad_members where user_id = any(v_users))),
      jsonb_build_object('step', 'Confirmed',  'users', (select count(distinct m.user_id) from squad_members m join squads s on s.id = m.squad_id
                                                          where m.user_id = any(v_users) and m.status = 'accepted' and s.status in ('confirmed','completed'))),
      jsonb_build_object('step', 'Showed up',  'users', (select count(distinct m.user_id) from squad_members m
                                                          where m.user_id = any(v_users) and m.checked_in_at is not null)),
      jsonb_build_object('step', 'Rated',      'users', (select count(distinct rater_id) from member_ratings where rater_id = any(v_users))),
      jsonb_build_object('step', 'Rebooked',   'users', (select count(distinct m.user_id) from squad_members m join squads s on s.id = m.squad_id
                                                          where m.user_id = any(v_users) and s.rebook_of is not null and m.status <> 'declined'))
    ),
    'totals', jsonb_build_object(
      'activities', (select count(*) from activities),
      'squads', (select count(*) from squads),
      'avg_member_rating', (select round(avg(score), 2) from member_ratings),
      'avg_venue_rating', (select round(avg(score), 2) from venue_ratings),
      'weekly_active', (select count(distinct user_id) from (
          select user_id, created_at from swipes union all select user_id, created_at from app_events) e
        where user_id = any(v_users) and created_at > now() - interval '7 days')
    ),
    'cohorts', coalesce((
      select jsonb_agg(c order by week)
      from (
        select date_trunc('week', p.created_at) as week,
               jsonb_build_object(
                 'week', to_char(date_trunc('week', p.created_at), 'DD Mon'),
                 'signed_up', count(*),
                 'active_week_1', count(*) filter (where exists (
                   select 1 from (select user_id, created_at from swipes union all select user_id, created_at from app_events) e
                   where e.user_id = p.id and e.created_at >= p.created_at + interval '7 days'
                     and e.created_at < p.created_at + interval '14 days'))) as c
        from profiles p where p.id = any(v_users)
        group by 1
      ) q
    ), '[]')
  );
end $$;

-- Demo accounts only: wipe my swipes, squads and ratings so the demo can be run again.
create or replace function public.reset_my_demo()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if not exists (select 1 from auth.users where id = v_me and (email ilike '%@pool.demo' or is_anonymous)) then
    raise exception 'Only demo and guest accounts can be reset';
  end if;
  delete from squads where id in (select squad_id from squad_members where user_id = v_me);
  delete from swipes where user_id = v_me;
  delete from member_ratings where rater_id = v_me;
  delete from venue_ratings where rater_id = v_me;
  delete from app_events where user_id = v_me;
  delete from reports where reporter_id = v_me;
  delete from activities where created_by = v_me;
  delete from member_ratings where ratee_id = v_me;
  delete from friendships where a = v_me or b = v_me;
  -- Demo accounts always go back to demo mode (simulated students on).
  update profiles set real_only = false
  where id = v_me and (select email from auth.users where id = v_me) ilike '%@pool.demo';
end $$;

-- Onboarding / edit profile. Every key is optional; only keys present are changed.
-- { full_name, degree, degree_short, year, group_pref, vibe, status_quote,
--   interests: [..], courses: [..], availability: [{dow, start, end}] }
create or replace function public.save_profile(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_name  text := nullif(trim(p->>'full_name'), '');
  v_first text := split_part(nullif(trim(p->>'full_name'), ''), ' ', 1);
  v_last  text := split_part(nullif(trim(p->>'full_name'), ''), ' ', 2);
begin
  if v_me is null then raise exception 'not signed in'; end if;

  update profiles set
    full_name    = coalesce(v_name, full_name),
    display_name = coalesce(nullif(v_first, ''), display_name),
    initials     = coalesce(upper(nullif(left(v_first, 1) || coalesce(nullif(left(v_last, 1), ''), substr(v_first, 2, 1)), '')), initials),
    degree       = coalesce(nullif(p->>'degree', ''), degree),
    degree_short = coalesce(nullif(p->>'degree_short', ''), degree_short),
    year         = coalesce((p->>'year')::smallint, year),
    group_pref   = coalesce(nullif(p->>'group_pref', ''), group_pref),
    real_only    = coalesce((p->>'real_only')::boolean, real_only),
    avatar_url   = case when p ? 'avatar_url' then nullif(p->>'avatar_url', '') else avatar_url end,
    vibe         = case when p ? 'vibe' then nullif(trim(p->>'vibe'), '') else vibe end,
    status_quote = case when p ? 'status_quote' then nullif(trim(p->>'status_quote'), '') else status_quote end,
    interests    = case when p ? 'interests' then array(select jsonb_array_elements_text(p->'interests')) else interests end,
    onboarded_at = coalesce(onboarded_at, now())
  where id = v_me;

  if p ? 'courses' then
    delete from profile_courses where user_id = v_me;
    insert into profile_courses (user_id, course)
    select distinct v_me, upper(trim(c)) from jsonb_array_elements_text(p->'courses') c where trim(c) <> '';
  end if;

  if p ? 'availability' then
    delete from availability where user_id = v_me;
    insert into availability (user_id, dow, start_hour, end_hour)
    select v_me, (e->>'dow')::int, (e->>'start')::int, (e->>'end')::int
    from jsonb_array_elements(p->'availability') e
    on conflict do nothing;
  end if;

  return get_me();
end $$;

-- ---------------------------------------------------------------------
-- Squad chat (no table policies: all access goes through these functions)
-- ---------------------------------------------------------------------

create or replace function public.can_chat(p_squad uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from squads s join squad_members m on m.squad_id = s.id
    where s.id = p_squad and (s.status in ('confirmed','completed') or s.was_confirmed)
      and m.user_id = auth.uid() and m.status <> 'declined'
  );
$$;

-- Simulated students say something friendly, so the demo chat isn't empty.
create or replace function public.pool_seed_says(p_squad uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_quote text;
  v_cat text;
begin
  select p.id, p.status_quote into v_user, v_quote
  from squad_members m join profiles p on p.id = m.user_id
  where m.squad_id = p_squad and m.status = 'accepted' and p.is_seed
  order by m.responded_at, p.id limit 1;
  if v_user is null then return; end if;

  select a.category into v_cat from squads s join activities a on a.id = s.activity_id where s.id = p_squad;

  insert into messages (squad_id, user_id, body) values (p_squad, v_user,
    case p_kind
      when 'intro' then 'Hey all 👋 ' || coalesce(v_quote, 'See you there!')
      else case v_cat
        when 'quiet'  then 'Sounds good! I''ll grab us a table 📚'
        when 'food'   then 'Yesss, so in 🧋'
        when 'active' then 'Let''s go 💪 I can bring a spare'
        when 'maker'  then 'Bringing my toolkit 🔧'
        else 'Can''t wait 🙌'
      end
    end);
end $$;
revoke all on function public.pool_seed_says(uuid, text) from public, anon, authenticated;

create or replace function public.get_messages(p_squad uuid, p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not can_chat(p_squad) then raise exception 'Chat opens once your squad is confirmed'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'body', m.body, 'created_at', m.created_at, 'is_me', m.user_id = auth.uid(),
      'name', p.display_name, 'initials', p.initials, 'avatar_color', p.avatar_color, 'avatar_url', p.avatar_url) order by m.id)
    from messages m join profiles p on p.id = m.user_id
    where m.squad_id = p_squad and m.id > p_after
  ), '[]'::jsonb);
end $$;

create or replace function public.send_message(p_squad uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_chat(p_squad) then raise exception 'Chat opens once your squad is confirmed'; end if;
  insert into messages (squad_id, user_id, body) values (p_squad, auth.uid(), trim(p_body));
  -- First message from a real person → a simulated squad-mate replies once.
  if (select count(*) from messages m join profiles p on p.id = m.user_id
      where m.squad_id = p_squad and p.is_seed) <= 1 then
    perform pool_seed_says(p_squad, 'reply');
  end if;
end $$;

-- Report someone from a squad you were both in. The matcher never pairs you again.
create or replace function public.report_member(p_squad uuid, p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_squad_member(p_squad)
     or not exists (select 1 from squad_members where squad_id = p_squad and user_id = p_user) then
    raise exception 'You can only report people from your own squads';
  end if;
  insert into reports (reporter_id, reported_id, squad_id, reason) values (auth.uid(), p_user, p_squad, p_reason);
end $$;

-- ---------------------------------------------------------------------
-- "Your people": mutual connections. No friend requests — you're connected
-- when you've done a session together and BOTH rated each other 4★+.
-- ---------------------------------------------------------------------

create or replace function public.get_connections()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  return coalesce((
    select jsonb_agg(c order by sort_at desc nulls last)
    from (
      select coalesce(x.last_at, f.created_at) as sort_at,
             jsonb_build_object(
               'id', p.id, 'name', p.display_name, 'initials', p.initials, 'avatar_color', p.avatar_color,
               'avatar_url', p.avatar_url,
               'degree_short', p.degree_short, 'year', p.year, 'status_quote', p.status_quote,
               'sessions_together', coalesce(x.n, 0), 'last_activity', x.last_title, 'last_squad_id', x.last_squad,
               'is_friend', f.a is not null,
               'shared_interests', to_jsonb(array(select unnest(p.interests) intersect select unnest(me.interests)))
             ) as c
      from profiles p
      cross join (select coalesce(interests, '{}') as interests from profiles where id = v_me) me
      left join (
        select other.user_id as uid, count(*) as n, max(s.ends_at) as last_at,
               (array_agg(a.title order by s.ends_at desc))[1] as last_title,
               (array_agg(s.id order by s.ends_at desc))[1] as last_squad
        from squads s
        join activities a on a.id = s.activity_id
        join squad_members mine on mine.squad_id = s.id and mine.user_id = v_me and mine.status = 'accepted'
        join squad_members other on other.squad_id = s.id and other.user_id <> v_me and other.status = 'accepted'
        where s.status = 'completed'
        group by other.user_id
      ) x on x.uid = p.id
      left join friendships f on f.a = least(v_me, p.id) and f.b = greatest(v_me, p.id)
      where p.id <> v_me
        and (f.a is not null
             or (x.uid is not null
                 and (select avg(score) from member_ratings where rater_id = v_me and ratee_id = p.id) >= 4
                 and (select avg(score) from member_ratings where rater_id = p.id and ratee_id = v_me) >= 4))
        and not exists (select 1 from reports r where (r.reporter_id = v_me and r.reported_id = p.id)
                                                   or (r.reporter_id = p.id and r.reported_id = v_me))
    ) q
  ), '[]'::jsonb);
end $$;

-- Start a new 1-on-1 with a connection: same kind of activity as last time, a new time you're both free.
create or replace function public.invite_connection(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_last uuid;
  v_activity text;
begin
  select (c->>'last_squad_id')::uuid into v_last
  from jsonb_array_elements(get_connections()) c where (c->>'id')::uuid = p_user;
  if v_last is null then raise exception 'You can only invite your connections'; end if;
  select activity_id into v_activity from squads where id = v_last;
  return form_squad(v_activity, array[p_user], v_last);
end $$;

-- ---------------------------------------------------------------------
-- Suggest an activity. It becomes a card in other people's decks, and the
-- suggester is just another squad member — nobody has to "host".
-- p: { title, squad_type, category, icon, course?, description?, duration_mins?, tags?: [] }
-- ---------------------------------------------------------------------

create or replace function public.create_activity(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_title  text := trim(coalesce(p->>'title', ''));
  v_course text := nullif(upper(replace(trim(coalesce(p->>'course', '')), ' ', '')), '');
  v_id     text := 'u-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  v_tags   text[];
  v_squad  uuid;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if length(v_title) < 4 or length(v_title) > 60 then raise exception 'Give it a short title (4–60 characters)'; end if;
  if v_course is not null and v_course !~ '^[A-Z]{4}[0-9]{4}$' then raise exception 'Course codes look like COMP1511'; end if;
  if (select count(*) from activities where created_by = v_me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You can suggest up to 5 activities a day';
  end if;

  v_tags := array(select distinct t from (
      select jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) t
      union all select v_course where v_course is not null
    ) z where t is not null limit 5);

  insert into activities (id, kind, squad_type, title, description, course, category, tags, icon, duration_mins, created_by, is_private)
  values (v_id, 'interest',
          coalesce(nullif(p->>'squad_type', ''), 'hobby'),
          v_title,
          nullif(left(trim(coalesce(p->>'description', '')), 140), ''),
          v_course,
          coalesce(nullif(p->>'category', ''), 'social'),
          v_tags,
          left(coalesce(nullif(p->>'icon', ''), 'sparkles'), 40),
          coalesce((p->>'duration_mins')::int, 90),
          v_me,
          coalesce((p->>'private')::boolean, false));

  -- A private plan for friends: the app books it with plan_with, no strangers.
  if coalesce((p->>'private')::boolean, false) then
    return jsonb_build_object('activity_id', v_id, 'squad_id', null);
  end if;

  -- You're obviously in for your own idea — try to form a squad straight away.
  insert into swipes (user_id, activity_id, decision) values (v_me, v_id, 'in');
  v_squad := form_squad(v_id);
  return jsonb_build_object('activity_id', v_id, 'squad_id', v_squad);
end $$;

-- Permanently delete my account. Cascades to profile, swipes, squads I'm in, ratings,
-- chat messages, reports and suggested activities. Demo accounts can't be deleted.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if (select email from auth.users where id = v_me) ilike '%@pool.demo' then
    raise exception 'Demo accounts can''t be deleted — use Reset instead';
  end if;
  -- Squads that would be left with one person (or only simulated students) are cancelled.
  update squads s set status = 'cancelled'
  where s.status in ('proposed','confirmed')
    and s.id in (select squad_id from squad_members where user_id = v_me)
    and ((select count(*) from squad_members m where m.squad_id = s.id and m.user_id <> v_me and m.status <> 'declined') < 2
         -- or only simulated students would be left
         or not exists (select 1 from squad_members m join profiles p on p.id = m.user_id
                        where m.squad_id = s.id and m.user_id <> v_me and not p.is_seed));
  delete from auth.users where id = v_me;
end $$;

-- ---------------------------------------------------------------------
-- "Start with who's here"
-- ---------------------------------------------------------------------

-- Drop everyone who hasn't answered, then confirm (2+ people) or cancel.
-- p_force: skip the vote check (used for the 2-hours-before timeout).
create or replace function public.pool_settle_squad(p_squad uuid, p_force boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_accepted int;
  v_voted int;
begin
  select count(*) filter (where status = 'accepted'),
         count(*) filter (where status = 'accepted' and (go_ahead or (select is_seed from profiles where id = user_id)))
    into v_accepted, v_voted
  from squad_members where squad_id = p_squad;

  -- Everyone who said yes has to agree (simulated students always do).
  if not p_force and v_voted < v_accepted then
    return 'waiting';
  end if;

  update squad_members set status = 'declined', responded_at = now()
  where squad_id = p_squad and status = 'invited';

  if v_accepted >= 2 then
    update squads set status = 'confirmed' where id = p_squad and status = 'proposed';
    if found and not (select was_confirmed from squads where id = p_squad) then perform pool_seed_says(p_squad, 'intro'); end if;
    return 'confirmed';
  end if;
  update squads set status = 'cancelled' where id = p_squad and status = 'proposed';
  return 'cancelled';
end $$;
revoke all on function public.pool_settle_squad(uuid, boolean) from public, anon, authenticated;

-- I've said yes — vote to start with whoever has said yes so far.
create or replace function public.vote_go_ahead(p_squad uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  update squad_members m set go_ahead = true
  from squads s
  where m.squad_id = p_squad and m.user_id = auth.uid() and m.status = 'accepted'
    and s.id = m.squad_id and s.status = 'proposed';
  if not found then raise exception 'Say yes to the squad first'; end if;

  if (select count(*) from squad_members where squad_id = p_squad and status = 'accepted') < 2 then
    raise exception 'You need at least one other person who said yes';
  end if;
  return pool_settle_squad(p_squad, false);
end $$;

-- ---------------------------------------------------------------------
-- Answer-by deadline for a proposed squad:
--   normally 2 hours before the start; if the squad was formed late, everyone
--   still gets at least an hour — but it's always at least 30 min before the start.
-- ---------------------------------------------------------------------
create or replace function public.pool_respond_by(p_squad uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select least(s.starts_at - interval '30 minutes',
               greatest(s.created_at + interval '1 hour', s.starts_at - interval '2 hours'))
  from squads s where s.id = p_squad;
$$;

-- ---------------------------------------------------------------------
-- Plan something again with people you met: several options, not just one.
-- ---------------------------------------------------------------------

-- You can only plan with people you've done a session with AND rated 4★+.
create or replace function public.pool_check_people(p_users uuid[])
returns void language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  u uuid;
begin
  if coalesce(array_length(p_users, 1), 0) = 0 then raise exception 'Pick someone to plan with'; end if;
  foreach u in array p_users loop
    if exists (select 1 from reports r where (r.reporter_id = v_me and r.reported_id = u)
                                          or (r.reporter_id = u and r.reported_id = v_me))
       or not (
         -- a friend you added with their code…
         exists (select 1 from friendships where a = least(v_me, u) and b = greatest(v_me, u))
         -- …or someone you've met and rated 4★+
         or (exists (
               select 1 from squads s
               join squad_members a on a.squad_id = s.id and a.user_id = v_me and a.status = 'accepted'
               join squad_members b on b.squad_id = s.id and b.user_id = u and b.status = 'accepted'
               where s.status = 'completed')
             and coalesce((select avg(score) from member_ratings where rater_id = v_me and ratee_id = u), 0) >= 4)) then
      raise exception 'You can only plan with friends or people you''ve met and rated 4★+';
    end if;
  end loop;
end $$;
revoke all on function public.pool_check_people(uuid[]) from public, anon;

-- Earliest start (8am–8pm, next 7 days from p_from) when everyone is free for p_mins.
drop function if exists public.pool_common_slot(uuid[], int, timestamptz);
create or replace function public.pool_common_slot(p_users uuid[], p_mins int, p_from timestamptz, p_avoid_days date[] default '{}')
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  v_slot timestamptz;
begin
  for v_slot in
    select (d::date + make_time(h, 0, 0)) at time zone 'Australia/Sydney'
    from generate_series((p_from at time zone 'Australia/Sydney')::date,
                         (p_from at time zone 'Australia/Sydney')::date + 7, interval '1 day') d,
         generate_series(8, 20) h
    where ((d::date + make_time(h, 0, 0)) at time zone 'Australia/Sydney') >= p_from
      and not (d::date = any(p_avoid_days))
    order by 1
  loop
    if not exists (select 1 from unnest(p_users) u where not pool_is_free(u, v_slot, p_mins)) then
      return v_slot;
    end if;
  end loop;
  return null;
end $$;
revoke all on function public.pool_common_slot(uuid[], int, timestamptz, date[]) from public, anon, authenticated;

-- Up to 4 options, each with a time everyone is free: "same again" first, then things
-- you've all said yes to or that match hobbies you share — one per category for variety.
create or replace function public.suggest_with(p_users uuid[], p_rebook_of uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_all    uuid[];
  v_from   timestamptz := now() + interval '2 hours';
  v_last   text;
  v_shared text[];
  v_used   text[] := '{}';
  v_days   date[] := '{}';
  v_out    jsonb := '[]'::jsonb;
  v_slot   timestamptz;
  r        record;
begin
  perform pool_check_people(p_users);
  v_all := p_users || v_me;

  if p_rebook_of is not null and is_squad_member(p_rebook_of) then
    select activity_id, greatest(v_from, ((starts_at at time zone 'Australia/Sydney')::date + 1)::timestamp at time zone 'Australia/Sydney')
      into v_last, v_from from squads where id = p_rebook_of;
  end if;

  -- Hobbies everyone in the group shares.
  select array(
    select t from unnest((select interests from profiles where id = v_me)) t
    where (select count(*) from profiles where id = any(p_users) and t = any(interests)) = array_length(p_users, 1)
  ) into v_shared;

  for r in
    select a.*,
           (case when a.id = v_last then 1000 else 0 end)
         + 3 * (select count(*) from swipes s where s.activity_id = a.id and s.decision = 'in' and s.user_id = any(v_all))
         + 2 * cardinality(array(select unnest(a.tags) intersect select unnest(v_shared)))
         + (case when a.host is not null then 1 else 0 end) as score,
           (select count(*) from swipes s where s.activity_id = a.id and s.decision = 'in' and s.user_id = any(v_all)) as yes_count,
           (select t from unnest(a.tags) t where t = any(v_shared) limit 1) as shared_tag,
           (select p.display_name from swipes s join profiles p on p.id = s.user_id
             where s.activity_id = a.id and s.decision = 'in' and s.user_id = any(p_users) limit 1) as yes_name
    from activities a
    where not exists (select 1 from swipes s where s.activity_id = a.id and s.decision = 'pass' and s.user_id = any(v_all))
      and (a.created_by is null or a.created_by = any(v_all))
      and (a.kind = 'interest' or a.starts_at > v_from or a.id = v_last)
    order by score desc, a.id
    limit 25
  loop
    continue when r.id <> coalesce(v_last, '') and r.category = any(v_used);
    if r.kind = 'session' and r.id <> coalesce(v_last, '') then
      v_slot := case when not exists (select 1 from unnest(v_all) u where not pool_is_free(u, r.starts_at, r.duration_mins))
                     then r.starts_at end;
    else
      -- Prefer a day no other option uses, so the choices aren't all at the same time.
      v_slot := coalesce(pool_common_slot(v_all, r.duration_mins, v_from, v_days),
                         pool_common_slot(v_all, r.duration_mins, v_from));
    end if;
    continue when v_slot is null;

    v_used := v_used || r.category;
    v_days := v_days || (v_slot at time zone 'Australia/Sydney')::date;
    v_out := v_out || jsonb_build_object(
      'activity_id', r.id, 'title', r.title, 'icon', r.icon, 'category', r.category,
      'squad_type', r.squad_type, 'host', r.host, 'duration_mins', r.duration_mins,
      'starts_at', v_slot,
      'reason', case
        when r.id = v_last then 'Same as last time'
        when r.yes_count >= array_length(v_all, 1) then 'You all said "I''m in" to this'
        when r.yes_name is not null then format('%s said "I''m in" to this', r.yes_name)
        when r.shared_tag is not null then format('You''re all into %s', r.shared_tag)
        else 'Something new to try together' end);
    exit when jsonb_array_length(v_out) >= 4;
  end loop;
  return v_out;
end $$;

-- Book the option you picked.
create or replace function public.plan_with(p_activity text, p_users uuid[], p_at timestamptz default null, p_rebook_of uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_squad uuid;
begin
  perform pool_check_people(p_users);
  v_squad := form_squad(p_activity, p_users, case when is_squad_member(p_rebook_of) then p_rebook_of end, p_at);
  -- You made the plan, so you're in.
  update squad_members set status = 'accepted', responded_at = now()
  where squad_id = v_squad and user_id = auth.uid();
  return v_squad;
end $$;

-- ---------------------------------------------------------------------
-- AI match reason (used by the match-reason Edge Function)
-- ---------------------------------------------------------------------

-- What Claude gets to see: anonymous labels, degree, year, hobbies, courses and own words. No names/emails.
create or replace function public.get_ai_context(p_squad uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_squad_member(p_squad) then raise exception 'not in this squad'; end if;
  return (
    select jsonb_build_object(
      'ai_reason', s.ai_reason,
      'activity', jsonb_build_object('title', a.title, 'type', a.squad_type, 'tags', a.tags, 'course', a.course),
      'when', to_char(s.starts_at at time zone 'Australia/Sydney', 'FMDay FMHH12:MI AM'),
      'facts', s.reasons,
      'students', (
        select jsonb_agg(jsonb_build_object(
          'label', 'Student ' || chr(64 + rn::int),
          'degree', p.degree, 'year', p.year,
          'in_their_words', p.vibe, 'hobbies', p.interests,
          'courses', (select jsonb_agg(course) from profile_courses pc where pc.user_id = p.id)))
        from (select m.user_id, row_number() over (order by m.user_id) rn
              from squad_members m where m.squad_id = s.id and m.status <> 'declined') x
        join profiles p on p.id = x.user_id))
    from squads s join activities a on a.id = s.activity_id
    where s.id = p_squad
  );
end $$;

create or replace function public.set_ai_reason(p_squad uuid, p_text text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text;
begin
  if not is_squad_member(p_squad) then raise exception 'not in this squad'; end if;
  update squads set ai_reason = left(trim(p_text), 240)
  where id = p_squad and ai_reason is null and length(trim(p_text)) > 0;
  select ai_reason into v from squads where id = p_squad;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Check-in: "I'm here" at the session = real attendance
-- ---------------------------------------------------------------------
create or replace function public.check_in(p_squad uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me   uuid := auth.uid();
  v_demo boolean;
  s      squads%rowtype;
begin
  select * into s from squads where id = p_squad;
  if not exists (select 1 from squad_members where squad_id = p_squad and user_id = v_me and status = 'accepted')
     or s.status not in ('confirmed', 'completed') then
    raise exception 'Check-in is for confirmed squads';
  end if;
  select (email ilike '%@pool.demo' or coalesce(is_anonymous, false)) into v_demo from auth.users where id = v_me;
  -- Real accounts: from 30 minutes before the start until it ends. Demo/guest accounts: any time.
  if not v_demo and not (now() between s.starts_at - interval '30 minutes' and s.ends_at) then
    raise exception 'Check-in opens 30 minutes before the start';
  end if;

  update squad_members set checked_in_at = coalesce(checked_in_at, now())
  where squad_id = p_squad and user_id = v_me;
  -- Simulated squad-mates turn up too (demo).
  update squad_members m set checked_in_at = coalesce(m.checked_in_at, now())
  from profiles p where p.id = m.user_id and p.is_seed and m.squad_id = p_squad and m.status = 'accepted';
  insert into messages (squad_id, user_id, body) values (p_squad, v_me, '📍 I''m here!');
end $$;

-- ---------------------------------------------------------------------
-- Friends: added only with each other's friend code (no search, no browsing).
-- ---------------------------------------------------------------------
create or replace function public.add_friend(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  me      profiles%rowtype;
  other   profiles%rowtype;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  select * into me from profiles where id = v_me;
  select * into other from profiles where friend_code = upper(trim(p_code));
  if not found then raise exception 'No one has that code — check the letters'; end if;
  if other.id = v_me then raise exception 'That''s your own code'; end if;
  if other.is_seed or other.real_only <> me.real_only then
    raise exception '%', case when me.real_only
      then 'That code belongs to a demo account'
      else 'That''s a real student — switch on "Real people only" to add real friends' end;
  end if;
  if exists (select 1 from reports r where (r.reporter_id = v_me and r.reported_id = other.id)
                                        or (r.reporter_id = other.id and r.reported_id = v_me)) then
    raise exception 'You can''t add this person';
  end if;
  insert into friendships (a, b) values (least(v_me, other.id), greatest(v_me, other.id)) on conflict do nothing;
  return jsonb_build_object('id', other.id, 'name', other.display_name);
end $$;

create or replace function public.remove_friend(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from friendships where a = least(auth.uid(), p_user) and b = greatest(auth.uid(), p_user);
$$;

-- ---------------------------------------------------------------------
-- Join: does this email already have an account? (So we never send a sign-up
-- email to someone who should just log in.)
-- ---------------------------------------------------------------------
create or replace function public.account_exists(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;
grant execute on function public.account_exists(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Suggest another time
-- ---------------------------------------------------------------------

-- Free for that window, ignoring this squad itself (it's the one being moved).
create or replace function public.pool_is_free_except(p_user uuid, p_start timestamptz, p_mins int, p_squad uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with t as (select p_start at time zone 'Australia/Sydney' as l)
  select exists (
    select 1 from availability av, t
    where av.user_id = p_user
      and av.dow = extract(dow from t.l)
      and av.start_hour <= extract(hour from t.l) + extract(minute from t.l) / 60.0
      and av.end_hour   >= extract(hour from t.l) + extract(minute from t.l) / 60.0 + p_mins / 60.0
  ) and not exists (
    select 1 from squad_members m join squads s on s.id = m.squad_id
    where m.user_id = p_user and m.status <> 'declined' and s.status in ('proposed','confirmed')
      and s.id <> p_squad
      and not (select is_seed from profiles where id = p_user)
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(p_start, p_start + make_interval(mins => p_mins))
  );
$$;
revoke all on function public.pool_is_free_except(uuid, timestamptz, int, uuid) from public, anon, authenticated;

-- Up to 8 other times in the next week, best first: everyone free, then most people free.
create or replace function public.squad_time_options(p_squad uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  s       squads%rowtype;
  v_mins  int;
  v_people uuid[];
begin
  if not is_squad_member(p_squad) then raise exception 'not in this squad'; end if;
  select * into s from squads where id = p_squad;
  v_mins := greatest(30, (extract(epoch from (s.ends_at - s.starts_at)) / 60)::int);
  select array_agg(user_id) into v_people from squad_members where squad_id = p_squad and status <> 'declined';

  return coalesce((
    select jsonb_agg(jsonb_build_object('starts_at', slot, 'free', free, 'total', total,
                                        'busy', busy) order by free desc, slot)
    from (
    select * from (
      select slot,
             (select count(*) from unnest(v_people) u where pool_is_free_except(u, slot, v_mins, p_squad)) as free,
             array_length(v_people, 1) as total,
             (select coalesce(jsonb_agg(p.display_name), '[]'::jsonb) from unnest(v_people) u join profiles p on p.id = u
               where not pool_is_free_except(u, slot, v_mins, p_squad)
                 and (s.status in ('confirmed','completed') or s.was_confirmed or u = v_me)) as busy
      from (
        select (d::date + make_time(h, 0, 0)) at time zone 'Australia/Sydney' as slot
        from generate_series((now() at time zone 'Australia/Sydney')::date,
                             (now() at time zone 'Australia/Sydney')::date + 7, interval '1 day') d,
             generate_series(8, 20) h
      ) slots
      where slot > now() + interval '2 hours'
        and slot <> s.starts_at
        and pool_is_free_except(v_me, slot, v_mins, p_squad)   -- you must be free yourself
    ) x
    where free >= 2
    order by free desc, slot
    limit 8
    ) best
  ), '[]'::jsonb);
end $$;

-- Move the squad to a new time. Everyone else re-confirms (simulated students agree straight away).
create or replace function public.propose_time(p_squad uuid, p_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me   uuid := auth.uid();
  s      squads%rowtype;
  a      activities%rowtype;
  v_name text;
  v_mins int;
begin
  if not exists (select 1 from squad_members where squad_id = p_squad and user_id = v_me and status <> 'declined') then
    raise exception 'not in this squad';
  end if;
  select * into s from squads where id = p_squad;
  select * into a from activities where id = s.activity_id;
  if s.status not in ('proposed', 'confirmed') then raise exception 'This squad can''t be moved any more'; end if;
  if a.kind = 'session' and not a.is_private and a.host is not null then
    raise exception 'Society events have a fixed time';
  end if;
  if p_at <= now() + interval '1 hour' then raise exception 'Pick a time at least an hour from now'; end if;
  v_mins := (extract(epoch from (s.ends_at - s.starts_at)) / 60)::int;
  select display_name into v_name from profiles where id = v_me;

  update squads set
    starts_at = p_at,
    ends_at = p_at + make_interval(mins => v_mins),
    was_confirmed = was_confirmed or status = 'confirmed',
    status = 'proposed',
    created_at = now(),  -- fresh answer-by window for the new time
    reasons = array_prepend(format('New time suggested by %s', v_name),
                            array(select r from unnest(reasons) r where r not like 'New time suggested by %'))
  where id = p_squad;

  update squad_members m set
    status = case when m.user_id = v_me or (select is_seed from profiles where id = m.user_id) then 'accepted' else 'invited' end,
    responded_at = case when m.user_id = v_me or (select is_seed from profiles where id = m.user_id) then now() end,
    go_ahead = false
  where m.squad_id = p_squad and m.status <> 'declined';

  if can_chat(p_squad) then
    insert into messages (squad_id, user_id, body)
    values (p_squad, v_me, format('🕒 Can we move it to %s? Tap "Looks good" if that works.',
                                  to_char(p_at at time zone 'Australia/Sydney', 'FMDy FMDD Mon, FMHH12:MI AM')));
  end if;

  -- Everyone else already agreed (e.g. only simulated squad-mates)? Confirm straight away.
  if not exists (select 1 from squad_members where squad_id = p_squad and status = 'invited') then
    update squads set status = 'confirmed' where id = p_squad;
  end if;
  return (select status from squads where id = p_squad);
end $$;

-- ===== supabase/seed.sql =====
-- =====================================================================
-- POOL — demo data. Run after schema.sql. Safe to re-run.
--   • 11 public campus venues
--   • 26 activity cards (8 real weekly sessions + 18 interest cards)
--   • 3 demo logins (maya/alex/sam @pool.demo) — real accounts, start empty
--   • 30 simulated students (is_seed) with courses, free times and past swipes
-- =====================================================================

-- Remove previous demo data (cascades to profiles, swipes, squads, ratings).
delete from auth.users where email ilike '%@pool.demo';
delete from public.activities;
delete from public.venues;

-- ---------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------
insert into public.venues (id, name, detail, category) values
  ('lawlib-l2',   'Law Library, Level 2',        'Silent study booths',        'quiet'),
  ('mainlib-l3',  'Main Library, Level 3',       'Bookable group pods',        'quiet'),
  ('mainlib-l4',  'Main Library, Level 4',       'Quiet zone · Pod 4B',        'quiet'),
  ('k17-lab',     'K17 Building, Ground Floor',  'CSE lab benches',            'quiet'),
  ('roundhouse',  'The Roundhouse',              'Beer garden tables',         'social'),
  ('library-lawn','Library Lawn',                'Under the big fig tree',     'social'),
  ('ufac',        'UNSW Fitness & Aquatic Centre','Sports hall, courts 1–3',   'active'),
  ('makerspace',  'Makerspace, Ainsworth Building','Workbenches & laser cutter','maker'),
  ('quad-food',   'Quadrangle Food Court',       'Upstairs window tables',     'food'),
  ('gongcha',     'Gong Cha, Upper Campus',      'Corner booth',               'food'),
  ('esmes',       'Esme''s, Arc Precinct',       'Couches by the window',      'food');

-- ---------------------------------------------------------------------
-- Activities (sessions recur weekly; get_deck rolls past ones forward)
-- ---------------------------------------------------------------------
insert into public.activities
  (id, kind, squad_type, title, description, course, category, tags, icon, duration_mins, venue_id, starts_at, capacity)
values
  -- Real sessions: fixed time + place
  ('comp1511-a2', 'session', 'deadline', 'COMP1511 Assignment 2 grind',
   'Linked lists and pointers. Silent sprint with a 10-minute debug check every hour.',
   'COMP1511', 'quiet', '{COMP1511,quiet focus,first years,assignment}', 'code-slash', 180,
   'lawlib-l2', public.pool_next_slot(4, 14), 4),
  ('math1081-quiz', 'session', 'deadline', 'MATH1081 lab quiz sprint',
   'Set theory, proofs and modular arithmetic past questions before the Friday quiz.',
   'MATH1081', 'quiet', '{MATH1081,problem solving,first years}', 'calculator', 120,
   'mainlib-l3', public.pool_next_slot(5, 11), 4),
  ('desn1000-build', 'session', 'deadline', 'DESN1000 prototype build',
   'Laser cutting, 3D-print tolerance checks and putting the thing together.',
   'DESN1000', 'maker', '{DESN1000,hands-on,building}', 'construct', 180,
   'makerspace', public.pool_next_slot(1, 15), 4),
  ('comp1531-standup', 'session', 'deadline', 'COMP1531 project pair-debug',
   'Bring your failing tests. Pair up and get the pipeline green.',
   'COMP1531', 'quiet', '{COMP1531,pair programming,group project}', 'git-branch', 120,
   'k17-lab', public.pool_next_slot(3, 13), 4),
  ('econ1101-papers', 'session', 'deadline', 'ECON1101 midterm past papers',
   'Two past papers, timed, then compare answers.',
   'ECON1101', 'quiet', '{ECON1101,exam prep,first years}', 'trending-up', 150,
   'mainlib-l4', public.pool_next_slot(1, 10), 4),
  ('badminton', 'session', 'hobby', 'Casual badminton, no skill needed',
   'Racquets provided. Nobody is keeping score.',
   null, 'active', '{badminton,sport,beginner friendly}', 'tennisball', 90,
   'ufac', public.pool_next_slot(2, 17), 4),
  ('trivia-night', 'session', 'hobby', 'Roundhouse trivia team',
   'Wednesday trivia. You need a team of four and we have three.',
   null, 'social', '{trivia,social,chill}', 'help-circle', 120,
   'roundhouse', public.pool_next_slot(3, 18), 4),
  ('resume-roast', 'session', 'career', 'Résumé swap before internship apps',
   'Swap résumés, give honest feedback, leave with one fix each.',
   null, 'food', '{internships,career,feedback}', 'document-text', 60,
   'quad-food', public.pool_next_slot(4, 12), 4),

  -- Interest cards: no fixed time, the matcher finds one
  ('late-night-lib', 'interest', 'deadline', 'Late-night library grinding',
   'Headphones on, heads down, snacks shared.',
   null, 'quiet', '{library,quiet focus,night owl}', 'moon', 180, null, null, 4),
  ('lofi-cowork', 'interest', 'deadline', 'Lofi + silent co-working',
   'Same table, separate work, nobody has to talk.',
   null, 'quiet', '{quiet focus,lofi,library}', 'headset', 120, null, null, 4),
  ('comp1511-lab', 'interest', 'deadline', 'COMP1511 lab exercise catch-up',
   'Behind on labs? Same. Let''s clear them together.',
   'COMP1511', 'quiet', '{COMP1511,first years,pair programming}', 'laptop', 120, null, null, 4),
  ('math1131-explain', 'interest', 'deadline', 'MATH1131 explain-it-back',
   'Take turns explaining one topic each. Best way to actually learn it.',
   'MATH1131', 'quiet', '{MATH1131,problem solving,first years}', 'school', 120, null, null, 4),
  ('leetcode', 'interest', 'career', 'LeetCode practice for internships',
   'One medium problem, 30 minutes, then talk through solutions.',
   null, 'quiet', '{internships,coding interview,career}', 'terminal', 90, null, null, 4),
  ('coffee-internships', 'interest', 'career', 'Coffee chat: software internships',
   'Who''s applied where, what the interviews were like.',
   null, 'food', '{internships,career,chill}', 'cafe', 60, null, null, 4),
  ('startup-ideas', 'interest', 'career', 'Startup ideas brainstorm',
   'Bring one half-baked idea. Leave with three.',
   null, 'food', '{startups,career,building}', 'bulb', 90, null, null, 4),
  ('hackathon', 'interest', 'career', 'Find a hackathon team',
   'Looking for people to build something over a weekend.',
   null, 'maker', '{hackathon,building,coding interview}', 'rocket', 120, null, null, 4),
  ('boba', 'interest', 'hobby', 'Boba after class',
   'Low effort, high sugar.',
   null, 'food', '{boba,chill,social}', 'ice-cream', 60, null, null, 4),
  ('matcha-reading', 'interest', 'hobby', 'Quiet reading + matcha',
   'Bring a book that isn''t for uni.',
   null, 'food', '{reading,quiet focus,matcha}', 'book', 90, null, null, 4),
  ('gym-beginners', 'interest', 'hobby', 'Gym buddy for beginners',
   'Nobody knows what they''re doing. That''s fine.',
   null, 'active', '{gym,sport,beginner friendly}', 'barbell', 60, null, null, 4),
  ('run-club', 'interest', 'hobby', 'Slow-pace run club',
   'Conversational pace. Walking breaks allowed.',
   null, 'active', '{running,outdoors,beginner friendly}', 'walk', 60, null, null, 4),
  ('board-games', 'interest', 'hobby', 'Board games at the Roundhouse',
   'Catan, Codenames, whatever''s on the shelf.',
   null, 'social', '{board games,social,chill}', 'dice', 120, null, null, 4),
  ('sketching', 'interest', 'hobby', 'Sketching on the Library Lawn',
   'Pencils provided. Skill not required.',
   null, 'social', '{art,outdoors,chill}', 'brush', 90, null, null, 4),
  ('photo-walk', 'interest', 'hobby', 'Photo walk around campus',
   'Phones are fine. Find the best angle of the Quad.',
   null, 'social', '{photography,outdoors,chill}', 'camera', 60, null, null, 4),
  ('language-exchange', 'interest', 'hobby', 'Language exchange: Mandarin / English',
   'Half the time in each language.',
   null, 'food', '{language,social,chill}', 'chatbubbles', 60, null, null, 4),
  ('anime-night', 'interest', 'hobby', 'Anime watch party',
   'Two episodes, snacks, opinions.',
   null, 'social', '{anime,social,chill}', 'tv', 120, null, null, 4),
  ('bouldering', 'interest', 'hobby', 'Bouldering for beginners',
   'Short climbs, lots of sitting around chatting.',
   null, 'active', '{climbing,sport,beginner friendly}', 'fitness', 90, null, null, 4);

-- Society events. "Don't go alone — go as a squad." Society names are made-up
-- examples (no real society has partnered with us yet).
insert into public.activities
  (id, kind, squad_type, title, description, course, category, tags, icon, duration_mins, venue_id, starts_at, capacity, host)
values
  ('soc-byte-games', 'session', 'hobby', 'Games night',
   'Mario Kart, Jackbox and too much pizza. Walk in with your squad, not alone.',
   null, 'social', '{board games,social,chill}', 'game-controller', 150,
   'roundhouse', public.pool_next_slot(4, 15), 4, 'Byte Club'),
  ('soc-boba-crawl', 'session', 'hobby', 'Boba crawl: 3 shops, 1 afternoon',
   'Rate every drink. Strong opinions encouraged.',
   null, 'food', '{boba,social,chill}', 'ice-cream', 90,
   'gongcha', public.pool_next_slot(2, 15), 4, 'Boba Appreciation Society'),
  ('soc-coastal-walk', 'session', 'hobby', 'Coastal walk: Coogee to Bondi',
   'Easy pace, lots of photo stops. Meet on the Library Lawn, bus together.',
   null, 'social', '{outdoors,running,photography}', 'walk', 180,
   'library-lawn', public.pool_next_slot(6, 10), 4, 'Hike & Seek'),
  ('soc-board-guild', 'session', 'hobby', 'Beginners'' table: learn a new board game',
   'Someone teaches, nobody needs to know the rules.',
   null, 'food', '{board games,chill,social}', 'dice', 120,
   'esmes', public.pool_next_slot(3, 17), 4, 'Board Game Guild'),
  ('soc-film-night', 'session', 'hobby', 'Outdoor screening: Spirited Away',
   'Bring a blanket. Popcorn provided.',
   null, 'social', '{anime,chill,outdoors}', 'film', 120,
   'library-lawn', public.pool_next_slot(4, 16), 4, 'Reel Film Society'),
  ('soc-pitch-night', 'session', 'career', 'Pitch night: 2-minute ideas',
   'Watch student founders pitch, then grab a drink and talk ideas.',
   null, 'social', '{startups,career,building}', 'bulb', 120,
   'roundhouse', public.pool_next_slot(3, 18), 4, 'Startup Circle'),
  ('soc-wit-qa', 'session', 'career', 'Internship Q&A with final-years',
   'How they got their internships, what they''d do differently.',
   null, 'food', '{internships,career,coding interview}', 'briefcase', 90,
   'quad-food', public.pool_next_slot(4, 13), 4, 'Women in Tech Circle');

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------
-- avail entries are 'dow:start-end' in Sydney time (0 = Sun … 6 = Sat).
create temp table _people (
  email text, password text, is_seed boolean,
  display_name text, full_name text, degree text, degree_short text, year int,
  avatar_color text, group_pref text, courses text[], avail text[], says_yes text[],
  vibe text, status_quote text, joined_days_ago int
) on commit drop;

insert into _people values
-- Demo logins (real accounts, no swipes yet)
('maya@pool.demo', 'pool-demo-2026', false, 'Maya', 'Maya Lin', 'Software Engineering', 'SENG', 1, '#F57C2A', 'small',
 '{COMP1511,MATH1081,DESN1000}', '{1:10-13,2:14-18,4:13-18,6:10-16}', '{}',
 'Law Lib Level 2 silent booths, iced matcha, lofi', 'Locked in for the A2 stage 3 tests 🎯', 0),
('alex@pool.demo', 'pool-demo-2026', false, 'Alex', 'Alex Nguyen', 'Computer Science', 'CS', 1, '#0EA5E9', 'one',
 '{COMP1511,MATH1131}', '{2:15-20,3:10-14,5:12-17,0:10-15}', '{}',
 'Would rather play a sport than talk about one', 'Bring a spare racquet pls 🏸', 0),
('sam@pool.demo', 'pool-demo-2026', false, 'Sam', 'Sam Patel', 'Commerce / Computer Science', 'COMM', 2, '#16A34A', 'any',
 '{COMP1531,ECON1101}', '{1:9-13,3:12-21,4:11-15,5:16-21}', '{}',
 'Trivia, startups, anything with a whiteboard', 'Ask me about my 14 abandoned side projects', 0),

-- Simulated students
('mei@pool.demo', 'x', true, 'Mei', 'Mei Chen', 'Computer Science', 'CS', 1, '#0E5B66', 'small',
 '{COMP1511,MATH1081}', '{2:13-18,4:12-18,5:10-14,6:10-15}', '{comp1511-a2,lofi-cowork,late-night-lib,math1081-quiz,boba,matcha-reading}',
 'Back corner of the library, headphones on, don''t talk to me', 'Bringing my pointers diagram cheat sheet 📝', 12),
('tomas@pool.demo', 'x', true, 'Tomas', 'Tomas Kowalski', 'Data Science', 'DS', 1, '#2563EB', 'any',
 '{COMP1511,MATH1131}', '{2:10-14,4:14-18,6:11-17}', '{comp1511-a2,comp1511-lab,gym-beginners,hackathon}',
 'Coffee first, then debugging', 'Has the VS Code debugger set up & coffee ☕', 10),
('priya@pool.demo', 'x', true, 'Priya', 'Priya Sharma', 'Computer Science', 'CS', 3, '#9333EA', 'small',
 '{COMP3311,COMP2521}', '{3:10-15,4:13-18,6:12-16}', '{comp1511-a2,leetcode,coffee-internships,resume-roast}',
 'Third year. I like explaining things until they click', 'Did COMP1511 two years ago — ask me anything 🙂', 30),
('jordan@pool.demo', 'x', true, 'Jordan', 'Jordan Lee', 'Software Engineering', 'SENG', 1, '#DC2626', 'small',
 '{COMP1511,MATH1081}', '{1:9-12,3:13-18,5:9-13}', '{comp1511-a2,math1081-quiz,late-night-lib}',
 'Night owl, energy drink, mechanical keyboard', 'Will explain recursion with a diagram nobody asked for', 8),
('kenji@pool.demo', 'x', true, 'Kenji', 'Kenji Watanabe', 'Mechanical Engineering', 'MECH', 1, '#EA580C', 'one',
 '{ENGG1000,MATH1131}', '{2:16-20,5:12-17,0:10-14}', '{badminton,gym-beginners,run-club,bouldering}',
 'Sport > gym > anything indoors', 'Played badminton in high school, very rusty', 15),
('aisha@pool.demo', 'x', true, 'Aisha', 'Aisha Rahman', 'Medicine', 'MED', 2, '#BE185D', 'small',
 '{PSYC1001,BABS1201}', '{1:12-17,3:14-19,6:9-13}', '{matcha-reading,sketching,boba,lofi-cowork}',
 'Quiet cafés, long reads, lots of tea', 'Reading Pachinko for the third time', 20),
('lucas@pool.demo', 'x', true, 'Lucas', 'Lucas Silva', 'Commerce', 'COMM', 1, '#0891B2', 'any',
 '{ECON1101,ACCT1501}', '{1:9-14,3:12-20,5:15-21}', '{econ1101-papers,trivia-night,board-games,startup-ideas}',
 'Group study, then the Roundhouse', 'Ready to lose at trivia with dignity', 18),
('hana@pool.demo', 'x', true, 'Hana', 'Hana Kim', 'Design', 'DESN', 1, '#DB2777', 'small',
 '{DESN1000,ARTS1090}', '{1:14-19,3:10-14,6:10-16}', '{desn1000-build,sketching,photo-walk,boba}',
 'Makerspace rat, sketchbook always in bag', 'Knows how the laser cutter works (mostly)', 9),
('oliver@pool.demo', 'x', true, 'Oliver', 'Oliver Brown', 'Mechatronics', 'MTRN', 1, '#4F46E5', 'small',
 '{DESN1000,ENGG1000,MATH1131}', '{1:13-19,4:9-13,5:13-17}', '{desn1000-build,hackathon,bouldering}',
 'Build first, read the instructions later', 'Bringing calipers and spare M3 screws 🔩', 14),
('zara@pool.demo', 'x', true, 'Zara', 'Zara Ahmed', 'Computer Science', 'CS', 2, '#7C3AED', 'any',
 '{COMP1531,COMP2521}', '{3:12-18,4:10-14,1:10-13}', '{comp1531-standup,leetcode,hackathon,coffee-internships}',
 'Pair programming is the only programming', 'Our pipeline is green and I intend to keep it that way', 25),
('ethan@pool.demo', 'x', true, 'Ethan', 'Ethan Tran', 'Software Engineering', 'SENG', 2, '#059669', 'small',
 '{COMP1531,MATH1231}', '{3:12-17,5:10-15,2:13-17}', '{comp1531-standup,late-night-lib,anime-night}',
 'Headphones, lofi, late nights', 'Has opinions about tabs vs spaces', 22),
('sofia@pool.demo', 'x', true, 'Sofia', 'Sofia Rossi', 'Arts / Law', 'LAW', 1, '#C2410C', 'small',
 '{ARTS1090,LAWS1052}', '{2:10-15,4:15-20,6:11-15}', '{matcha-reading,language-exchange,photo-walk,boba}',
 'Bookshops, gelato, people-watching', 'Learning Mandarin badly but enthusiastically', 16),
('daniel@pool.demo', 'x', true, 'Daniel', 'Daniel Park', 'Computer Science', 'CS', 1, '#1D4ED8', 'one',
 '{COMP1511,MATH1131}', '{2:15-19,4:9-12,0:12-17}', '{comp1511-lab,badminton,leetcode}',
 'One-on-one, quiet, focused', 'Fast typer, slow talker', 7),
('chloe@pool.demo', 'x', true, 'Chloe', 'Chloe Martin', 'Psychology', 'PSYC', 1, '#E11D48', 'small',
 '{PSYC1001,PSYC1011}', '{1:10-15,3:15-20,5:11-16}', '{boba,board-games,anime-night,sketching}',
 'Board games and overthinking', 'Will bring Codenames', 11),
('arjun@pool.demo', 'x', true, 'Arjun', 'Arjun Mehta', 'Commerce / CS', 'COMM', 2, '#0F766E', 'any',
 '{COMP1531,ECON1101,ACCT1501}', '{1:9-13,3:12-21,4:11-15}', '{startup-ideas,trivia-night,coffee-internships,econ1101-papers}',
 'Always building something', 'Pitching you my startup in 30 seconds', 28),
('ella@pool.demo', 'x', true, 'Ella', 'Ella Nguyen', 'Computer Science', 'CS', 1, '#A21CAF', 'small',
 '{COMP1511,MATH1081}', '{1:10-13,5:10-14,6:10-16}', '{math1081-quiz,comp1511-lab,lofi-cowork,boba}',
 'Library L3 pods with snacks', 'Has every MATH1081 past paper printed', 6),
('ben@pool.demo', 'x', true, 'Ben', 'Ben Taylor', 'Civil Engineering', 'CVEN', 1, '#65A30D', 'any',
 '{ENGG1000,MATH1131}', '{2:15-20,3:16-21,0:9-13}', '{badminton,run-club,gym-beginners,trivia-night}',
 'Anything outdoors', 'Training for my first 5k 🏃', 13),
('linh@pool.demo', 'x', true, 'Linh', 'Linh Pham', 'Data Science', 'DS', 2, '#0369A1', 'small',
 '{MATH1231,COMP2521}', '{1:12-17,4:9-13,6:13-17}', '{leetcode,math1131-explain,lofi-cowork}',
 'Whiteboard + markers + quiet', 'Explains proofs with too many colours', 19),
('noah@pool.demo', 'x', true, 'Noah', 'Noah Williams', 'Software Engineering', 'SENG', 1, '#B45309', 'small',
 '{COMP1511,MATH1131}', '{2:13-18,4:13-18,6:12-16}', '{comp1511-lab,hackathon,anime-night,boba}',
 'Discord, debugging, dumplings', 'Will share my snacks if you share your test cases', 5),
('isla@pool.demo', 'x', true, 'Isla', 'Isla Wilson', 'Fine Arts', 'ARTS', 2, '#9D174D', 'small',
 '{ARTS1090,DESN1000}', '{1:13-18,3:9-13,6:10-14}', '{sketching,photo-walk,desn1000-build,matcha-reading}',
 'Galleries, film cameras, long walks', 'Film camera in my bag at all times 📷', 24),
('ryan@pool.demo', 'x', true, 'Ryan', 'Ryan Wong', 'Computer Science', 'CS', 1, '#155E75', 'any',
 '{COMP1511,MATH1081}', '{1:10-14,3:13-18,5:10-13}', '{late-night-lib,comp1511-lab,leetcode,board-games}',
 'Late nights, cold brew', 'Writes his notes in Markdown', 4),
('grace@pool.demo', 'x', true, 'Grace', 'Grace Liu', 'Accounting', 'ACCT', 1, '#C026D3', 'small',
 '{ACCT1501,ECON1101}', '{1:9-13,3:14-19,5:12-16}', '{econ1101-papers,language-exchange,boba}',
 'Spreadsheets and bubble tea', 'Colour-codes everything', 17),
('mateo@pool.demo', 'x', true, 'Mateo', 'Mateo García', 'Exercise Science', 'EXSC', 1, '#16A34A', 'one',
 '{PHSL2101,BABS1201}', '{2:16-20,4:7-11,0:10-15}', '{gym-beginners,run-club,badminton,bouldering}',
 'Gym at 7am, smoothie at 8', 'Will show you how the leg press works', 21),
('ava@pool.demo', 'x', true, 'Ava', 'Ava Thompson', 'Media', 'MDIA', 1, '#EA580C', 'small',
 '{MDIA1002,ARTS1090}', '{2:11-16,4:14-19,6:10-15}', '{photo-walk,anime-night,sketching,boba}',
 'Film photography and bad horror movies', 'Has seen every Ghibli film at least twice', 3),
('hassan@pool.demo', 'x', true, 'Hassan', 'Hassan Ali', 'Computer Science', 'CS', 3, '#0D9488', 'any',
 '{COMP3900,COMP3311}', '{2:12-16,3:12-17,4:12-16}', '{leetcode,coffee-internships,resume-roast,comp1531-standup}',
 'Interned at a startup last summer, happy to share', 'Has opinions on every big tech interview loop', 35),
('ruby@pool.demo', 'x', true, 'Ruby', 'Ruby Clarke', 'Commerce', 'COMM', 2, '#BE123C', 'small',
 '{ECON1101,MGMT1001}', '{3:13-19,4:11-16,1:10-13}', '{resume-roast,coffee-internships,startup-ideas,trivia-night}',
 'Career fairs and good coffee', 'Rewrote my résumé 11 times this term', 26),
('kai@pool.demo', 'x', true, 'Kai', 'Kai Yamamoto', 'Software Engineering', 'SENG', 1, '#2563EB', 'one',
 '{COMP1511,MATH1131}', '{2:15-19,5:12-16,0:11-15}', '{badminton,comp1511-lab,bouldering}',
 'Quiet, prefers one-on-one', 'Keyboard warrior, literally (I build keyboards)', 2),
('nadia@pool.demo', 'x', true, 'Nadia', 'Nadia Haddad', 'Law', 'LAW', 1, '#7E22CE', 'small',
 '{LAWS1052,ARTS1090}', '{2:10-14,4:14-19,6:9-13}', '{matcha-reading,late-night-lib,language-exchange}',
 'Law Library is my second home', 'Knows which Law Lib booths have working plugs', 23),
('leo@pool.demo', 'x', true, 'Leo', 'Leo Fischer', 'Physics', 'PHYS', 2, '#4338CA', 'any',
 '{MATH1231,PHYS1121}', '{1:13-18,3:9-13,5:13-18}', '{math1131-explain,board-games,bouldering,run-club}',
 'Puzzles, climbing, more puzzles', 'Brought a Rubik''s cube, will solve it while you study', 27),
('sienna@pool.demo', 'x', true, 'Sienna', 'Sienna Bose', 'Computer Science', 'CS', 1, '#DB2777', 'small',
 '{COMP1511,MATH1081}', '{1:10-14,4:9-13,5:10-14}', '{math1081-quiz,lofi-cowork,matcha-reading}',
 'Pomodoro 50/10, strictly enforced', 'Timer is already running ⏱️', 1),
('jack@pool.demo', 'x', true, 'Jack', 'Jack O''Brien', 'Commerce', 'COMM', 1, '#CA8A04', 'any',
 '{ECON1101,ACCT1501}', '{3:15-21,5:16-21,1:10-14}', '{trivia-night,board-games,boba,econ1101-papers}',
 'Social study: talk, snack, eventually study', 'Captain of a trivia team that has never won', 12);

alter table _people add column id uuid default gen_random_uuid();
update _people set id = gen_random_uuid() where id is null;

-- Auth accounts (the trigger creates a basic profile row for each).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt(case when is_seed then gen_random_uuid()::text else password end, extensions.gen_salt('bf')),
       now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('name', full_name),
       now() - make_interval(days => joined_days_ago), now(), '', '', '', ''
from _people;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from _people;

update public.profiles p set
  display_name = x.display_name,
  full_name    = x.full_name,
  initials     = upper(left(x.display_name, 1) || left(split_part(x.full_name, ' ', 2), 1)),
  avatar_color = x.avatar_color,
  degree       = x.degree,
  degree_short = x.degree_short,
  year         = x.year,
  vibe         = x.vibe,
  status_quote = x.status_quote,
  group_pref   = x.group_pref,
  is_seed      = x.is_seed,
  onboarded_at = now() - make_interval(days => x.joined_days_ago),
  created_at   = now() - make_interval(days => x.joined_days_ago)
from _people x where x.id = p.id;

insert into public.profile_courses (user_id, course)
select id, unnest(courses) from _people;

insert into public.availability (user_id, dow, start_hour, end_hour)
select id,
       split_part(slot, ':', 1)::int,
       split_part(split_part(slot, ':', 2), '-', 1)::int,
       split_part(split_part(slot, ':', 2), '-', 2)::int
from _people, unnest(avail) as slot;

insert into public.swipes (user_id, activity_id, decision, created_at)
select id, act, 'in', now() - make_interval(hours => (random() * 24 * 10)::int)
from _people, unnest(says_yes) as act;

-- Hobbies: what the demo accounts picked in onboarding; simulated students' come from what they said yes to.
update public.profiles p set interests = x.i
from (values
  ('maya@pool.demo', '{quiet focus,library,matcha,lofi,boba}'::text[]),
  ('alex@pool.demo', '{badminton,sport,gym,beginner friendly}'::text[]),
  ('sam@pool.demo',  '{trivia,startups,board games,social}'::text[])
) x(email, i), _people pe
where pe.email = x.email and p.id = pe.id;

update public.profiles p set interests = coalesce((
  select array_agg(distinct t) from (
    select unnest(a.tags) t from public.swipes s join public.activities a on a.id = s.activity_id
    where s.user_id = p.id and s.decision = 'in'
  ) z where t !~ '^[A-Z]{4}[0-9]{4}$' and t not in ('first years','assignment','exam prep','group project','feedback')
), '{}')
where p.is_seed;

-- Simulated students say "I'm in" to society events that suit them and when they're free.
insert into public.swipes (user_id, activity_id, decision, created_at)
select p.id, a.id, 'in', now() - make_interval(hours => (random() * 24 * 5)::int)
from public.activities a
cross join lateral (
  select pr.id from public.profiles pr
  where pr.is_seed
    and public.pool_is_free(pr.id, a.starts_at, a.duration_mins)
    and pr.interests && a.tags
  order by cardinality(array(select unnest(pr.interests) intersect select unnest(a.tags))) desc, md5(pr.id::text || a.id)
  limit 5
) p
where a.host is not null
on conflict do nothing;

-- A few "not for me" swipes so interest isn't uniformly positive.
insert into public.swipes (user_id, activity_id, decision, created_at)
select p.id, a.id, 'pass', now() - make_interval(hours => (random() * 24 * 10)::int)
from _people p cross join lateral (
  select id from public.activities a
  where not (a.id = any(p.says_yes))
    and not exists (select 1 from public.swipes sw where sw.user_id = p.id and sw.activity_id = a.id)
  order by md5(a.id || p.email) limit 3
) a
where p.is_seed;

-- ---------------------------------------------------------------------
-- Simulated history (last ~2 weeks) so the metrics screen has a realistic
-- funnel when "Incl. simulated students" is on. Only simulated students.
-- ---------------------------------------------------------------------
do $$
declare
  g        record;
  v_sq     uuid;
  v_start  timestamptz;
  v_mins   int;
begin
  for g in
    select * from (values
      ('comp1511-lab',  'mainlib-l3',   9, 14, array['mei','tomas','noah','ryan'],   'completed'),
      ('badminton',     'ufac',         8, 17, array['kenji','ben','mateo'],         'completed'),
      ('trivia-night',  'roundhouse',   7, 18, array['lucas','jack','arjun','ruby'], 'completed'),
      ('boba',          'gongcha',      6, 15, array['aisha','sofia','chloe'],       'completed'),
      ('leetcode',      'k17-lab',      5, 13, array['priya','zara','hassan'],       'completed'),
      ('desn1000-build','makerspace',   4, 15, array['hana','oliver','isla'],        'completed'),
      ('math1131-explain','lawlib-l2',  3, 10, array['linh','leo'],                  'completed'),
      ('boba',          'esmes',        2, 16, array['aisha','sofia'],               'completed'),
      ('anime-night',   'library-lawn', 1, 18, array['ethan','ava','chloe'],         'confirmed'),
      ('econ1101-papers','mainlib-l4', -2, 10, array['grace','lucas','jack'],        'proposed')
    ) t(act, venue, days_ago, hr, people, status)
  loop
    select duration_mins into v_mins from public.activities where id = g.act;
    v_start := (((now() at time zone 'Australia/Sydney')::date - g.days_ago) + make_time(g.hr, 0, 0)) at time zone 'Australia/Sydney';

    insert into public.squads (activity_id, venue_id, starts_at, ends_at, status, reasons, created_at)
    values (g.act, g.venue, v_start, v_start + make_interval(mins => v_mins), g.status,
            '{"Simulated history"}', v_start - interval '2 days')
    returning id into v_sq;

    insert into public.squad_members (squad_id, user_id, status, responded_at)
    select v_sq, p.id,
           case when g.status = 'proposed' and split_part(u.email, '@', 1) = 'jack' then 'invited' else 'accepted' end,
           v_start - interval '1 day'
    from public.profiles p join auth.users u on u.id = p.id
    where split_part(u.email, '@', 1) = any(g.people) and u.email like '%@pool.demo';

    if g.status = 'completed' then
      insert into public.member_ratings (squad_id, rater_id, ratee_id, score, created_at)
      select v_sq, a.user_id, b.user_id, 3 + abs(hashtext(a.user_id::text || b.user_id::text)) % 3, v_start + interval '4 hours'
      from public.squad_members a join public.squad_members b on b.squad_id = a.squad_id and b.user_id <> a.user_id
      where a.squad_id = v_sq
        and abs(hashtext(a.user_id::text)) % 5 <> 0;  -- most people rate, not everyone

      insert into public.venue_ratings (squad_id, rater_id, venue_id, score, created_at)
      select v_sq, m.user_id, g.venue,
             case when g.venue = 'lawlib-l2' then 2 else 3 + abs(hashtext(m.user_id::text || g.venue)) % 3 end,
             v_start + interval '4 hours'
      from public.squad_members m
      where m.squad_id = v_sq and abs(hashtext(m.user_id::text)) % 5 <> 0;
    end if;
  end loop;

  -- The second boba squad was a rebook of the first.
  update public.squads s set rebook_of = (
    select id from public.squads where activity_id = 'boba' and reasons = '{"Simulated history"}' order by starts_at limit 1)
  where s.id = (select id from public.squads where activity_id = 'boba' and reasons = '{"Simulated history"}' order by starts_at desc limit 1);
end $$;

-- App opens, so weekly-active and cohort retention have something to show.
insert into public.app_events (user_id, name, created_at)
select p.id, 'app_open', d + make_interval(hours => 8 + (abs(hashtext(p.id::text || d::text)) % 12))
from public.profiles p
cross join lateral generate_series(date_trunc('day', p.created_at), now() - interval '1 day', interval '1 day') d
where p.is_seed and abs(hashtext(p.id::text || d::text)) % 10 < 4;

-- Most people in finished simulated squads checked in (attendance for the metrics screen).
update public.squad_members m set checked_in_at = s.starts_at + interval '5 minutes'
from public.squads s
where s.id = m.squad_id and s.status = 'completed' and s.reasons = '{"Simulated history"}'
  and m.status = 'accepted' and abs(hashtext(m.user_id::text || s.id::text)) % 7 <> 0;

notify pgrst, 'reload schema';
