-- Runs poll-alerts every 5 minutes. Keys come from Vault at call time, never stored in this SQL.
-- Needs two Vault secrets first: 'project_url' and 'secret_key' (the sb_secret_ key, added by hand).
select cron.schedule(
  'poll-alerts-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/poll-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
