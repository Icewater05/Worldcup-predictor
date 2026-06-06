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
