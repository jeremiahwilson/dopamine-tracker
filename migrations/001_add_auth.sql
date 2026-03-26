-- Migration 001: Add user_id + enable RLS
-- Run this in the Supabase SQL Editor.

-- 1. Add user_id to each table
alter table items            add column user_id uuid references auth.users(id);
alter table schedule_entries add column user_id uuid references auth.users(id);
alter table log_entries      add column user_id uuid references auth.users(id);

-- 2. Assign existing rows to your current user (run BEFORE enabling RLS
--    or existing rows become invisible). Replace the UUID below with your
--    user's UUID from Authentication > Users in the dashboard.
-- update items            set user_id = 'YOUR-UUID-HERE';
-- update schedule_entries set user_id = 'YOUR-UUID-HERE';
-- update log_entries      set user_id = 'YOUR-UUID-HERE';

-- 3. Enable RLS
alter table items            enable row level security;
alter table schedule_entries enable row level security;
alter table log_entries      enable row level security;

-- 4. RLS policies: each user sees and manages only their own rows
create policy "items: own rows" on items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "schedule_entries: own rows" on schedule_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "log_entries: own rows" on log_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
