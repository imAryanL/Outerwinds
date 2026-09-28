-- Expo's ticket for each push, kept until a later poll checks its delivery receipt (~15 min).
create table public.push_tickets (
  ticket_id text primary key,
  expo_token text not null,
  sent_at timestamptz not null default now()
);

alter table public.push_tickets enable row level security;
