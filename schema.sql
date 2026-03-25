create table items (
  id          text primary key,
  name        text not null,
  type        text not null check (type in ('habit', 'task')),
  effort      numeric(3,1) not null check (effort >= 0 and effort <= 10),
  dopamine    numeric(3,1) not null check (dopamine >= 0 and dopamine <= 10),
  created_at  timestamptz default now()
);

create table schedule_entries (
  id           text primary key,
  date         date not null,
  item_id      text references items(id) on delete set null,
  duration_min integer not null,
  position     integer not null default 0,
  created_at   timestamptz default now()
);

create table log_entries (
  id           text primary key,
  date         date not null,
  item_id      text references items(id) on delete set null,
  start_time   text,
  duration_min integer not null,
  created_at   timestamptz default now()
);

-- RLS is disabled for now since there's no auth yet.
-- Re-enable and add per-user policies when auth is added.
alter table items            disable row level security;
alter table schedule_entries disable row level security;
alter table log_entries      disable row level security;
