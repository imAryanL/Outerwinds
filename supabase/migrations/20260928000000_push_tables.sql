-- One row per phone that allowed notifications, and the NWS zone it lives in.
create table public.push_tokens (
  expo_token text primary key,
  zone_id text not null,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_zone_id_idx on public.push_tokens (zone_id);

-- Every alert already pushed to a zone, so a 5-minute poll never sends it twice.
create table public.sent_alerts (
  alert_id text not null,
  zone_id text not null,
  level text not null check (level in ('watch', 'warning')),
  sent_at timestamptz not null default now(),
  primary key (alert_id, zone_id)
);

-- One row per poll, so a silent failure during a storm shows up.
create table public.poll_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  zones integer not null default 0,
  sent integer not null default 0,
  detail text
);

-- Only the edge functions (secret key) touch these. No policies = the public key gets nothing.
alter table public.push_tokens enable row level security;
alter table public.sent_alerts enable row level security;
alter table public.poll_runs enable row level security;
