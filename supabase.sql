-- Run this in the Supabase dashboard → SQL Editor.

-- 1) Shared pool data (predictions, results, knockout, leagues)
create table if not exists kv (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);
alter table kv enable row level security;

-- Signed-in users can read all pool data and write to it. (The /api/sync
-- function uses the service role, which bypasses RLS.)
drop policy if exists "kv anon read write" on kv;
drop policy if exists "kv auth read"  on kv;
drop policy if exists "kv auth write" on kv;
create policy "kv auth read"  on kv for select to authenticated using (true);
create policy "kv auth write" on kv for all    to authenticated using (true) with check (true);

-- 2) Accounts → unique display names + which league they're in
create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  name_lower text unique,           -- enforces globally-unique names (case-insensitive)
  group_code text,
  updated_at timestamptz default now()
);
alter table profiles enable row level security;

-- Anyone signed in can read profiles (needed to show names + check uniqueness);
-- you can only create/update YOUR OWN profile row.
drop policy if exists "profiles read"  on profiles;
drop policy if exists "profiles write" on profiles;
create policy "profiles read"  on profiles for select to authenticated using (true);
create policy "profiles write" on profiles for all    to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- OPTIONAL: hard-lock results to the host (recommended).
-- The app already hides the Results tab from non-hosts, but that's only in the
-- browser. To enforce it on the server too (so nobody can write results even
-- with developer tools), run this — replacing the email with YOUR account email.
-- The /api/sync function uses the service role and still bypasses this.
--
-- drop policy if exists "kv auth write" on kv;
-- create policy "kv write predictions/leagues" on kv for all to authenticated
--   using ( key not like 'wc26:results%' and key not like 'wc26:knockout%' )
--   with check ( key not like 'wc26:results%' and key not like 'wc26:knockout%' );
-- create policy "kv write results host only" on kv for all to authenticated
--   using ( (auth.jwt() ->> 'email') = 'you@example.com' )
--   with check ( (auth.jwt() ->> 'email') = 'you@example.com' );
