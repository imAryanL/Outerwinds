-- pg_cron runs the 5-minute timer; pg_net lets it call the poll-alerts function.
create extension if not exists pg_cron;
-- In its own schema, not public (the security advisor flags public). Its functions still live in net.
create extension if not exists pg_net with schema extensions;
