// Runs every 5 minutes (pg_cron). Pushes new storm watches/warnings to every phone in the zone.

import { withSupabase } from "npm:@supabase/server@^1";

// NWS requires a User-Agent naming the app — same one the app sends.
const USER_AGENT = "(Outerwinds, github.com/imAryanL/Outerwinds)";
const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

// Same list as the app's alert-rules.ts, so a push never fires for something the Alerts tab ignores.
const STORM_EVENTS = ["Hurricane", "Tropical Storm", "Storm Surge", "Flash Flood"];

// Expo takes at most 100 messages per request. Zones per NWS request is our own cap (URL length).
const EXPO_BATCH = 100;
const ZONE_BATCH = 50;

// Expo's docs: receipts are ready ~15 min after sending, and gone after 24 hours.
const RECEIPT_WAIT_MS = 15 * 60 * 1000;

type Level = "watch" | "warning";

type Message = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  interruptionLevel: "active" | "time-sensitive";
  data: { url: string };
};

type SentRow = { alert_id: string; zone_id: string; level: Level };

function levelFor(event: string): Level | null {
  let isStorm = false;
  for (const kind of STORM_EVENTS) {
    if (event.includes(kind)) {
      isStorm = true;
    }
  }
  if (!isStorm) {
    return null;
  }
  if (event.includes("Warning")) {
    return "warning";
  }
  if (event.includes("Watch")) {
    return "watch";
  }
  // Statements and advisories inside a storm event aren't watches or warnings — no push.
  return null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchAlerts(zones: string[]) {
  const features = [];
  for (const group of chunk(zones, ZONE_BATCH)) {
    const response = await fetch(`https://api.weather.gov/alerts/active?zone=${group.join(",")}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
    });
    // Throw instead of skipping: a quiet empty answer here would look exactly like "no storms".
    if (!response.ok) {
      throw new Error(`NWS answered ${response.status}`);
    }
    const body = await response.json();
    for (const feature of body.features) {
      features.push(feature.properties);
    }
  }
  return features;
}

export default {
  // 'secret': only the cron job (holding the secret key from Vault) can run this.
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    const db = ctx.supabaseAdmin;
    let zoneCount = 0;
    let sentCount = 0;

    try {
      // 1. Who's subscribed, grouped by zone.
      const { data: tokenRows, error: tokenError } = await db.from("push_tokens").select("expo_token, zone_id");
      if (tokenError) {
        throw new Error(`read push_tokens: ${tokenError.message}`);
      }

      const tokensByZone = new Map<string, string[]>();
      for (const row of tokenRows) {
        const list = tokensByZone.get(row.zone_id) ?? [];
        list.push(row.expo_token);
        tokensByZone.set(row.zone_id, list);
      }
      zoneCount = tokensByZone.size;

      // 2. Receipts for pushes sent 15+ minutes ago — prune phones Apple says are gone.
      await checkReceipts(db);

      if (zoneCount === 0) {
        await db.from("poll_runs").insert({ ok: true, zones: 0, sent: 0 });
        return Response.json({ ok: true, zones: 0, sent: 0 });
      }

      // 3. Every active alert across those zones, in as few NWS requests as possible.
      const alerts = await fetchAlerts([...tokensByZone.keys()]);

      // 4. What's already been sent, for these alerts and the older alerts they replace.
      const ids = [];
      for (const alert of alerts) {
        ids.push(alert.id);
        for (const ref of alert.references ?? []) {
          ids.push(ref.identifier);
        }
      }
      const sent: SentRow[] = [];
      for (const group of chunk(ids, 200)) {
        const { data, error } = await db.from("sent_alerts").select("alert_id, zone_id, level").in("alert_id", group);
        if (error) {
          throw new Error(`read sent_alerts: ${error.message}`);
        }
        sent.push(...data);
      }

      const messages: Message[] = [];
      const toRecord: SentRow[] = [];
      const seen = new Set<string>();

      for (const alert of alerts) {
        // A Cancel means the alert is over — nothing to warn about.
        if (alert.messageType === "Cancel") {
          continue;
        }
        const level = levelFor(alert.event);
        if (level === null) {
          continue;
        }

        const refIds = [];
        for (const ref of alert.references ?? []) {
          refIds.push(ref.identifier);
        }

        for (const zoneId of alert.geocode?.UGC ?? []) {
          const tokens = tokensByZone.get(zoneId);
          if (tokens === undefined) {
            continue;
          }

          let alreadySent = false;
          const earlier: SentRow[] = [];
          for (const row of sent) {
            if (row.zone_id !== zoneId) {
              continue;
            }
            if (row.alert_id === alert.id) {
              alreadySent = true;
            }
            if (refIds.includes(row.alert_id)) {
              earlier.push(row);
            }
          }
          // Also skip a zone NWS listed twice in one alert — two identical rows would fail the save.
          const key = `${alert.id}|${zoneId}`;
          if (alreadySent || seen.has(key)) {
            continue;
          }
          seen.add(key);

          // An Update to something this zone already got only pushes if it got worse (watch -> warning).
          // NWS reissues constantly during a storm; pushing every edit is how people learn to ignore you.
          let escalated = true;
          for (const row of earlier) {
            if (row.level === "warning" || level === "watch") {
              escalated = false;
            }
          }
          toRecord.push({ alert_id: alert.id, zone_id: zoneId, level });
          if (earlier.length > 0 && !escalated) {
            continue;
          }

          for (const token of tokens) {
            messages.push({
              to: token,
              // NWS's own words, never ours.
              title: alert.event,
              body: alert.headline ?? `${alert.event} for your area.`,
              sound: "default",
              priority: "high",
              // Warnings break through Focus; watches arrive like a normal notification.
              interruptionLevel: level === "warning" ? "time-sensitive" : "active",
              data: { url: "/alerts" },
            });
          }
        }
      }

      // 5. Send. If Expo fails, nothing is marked sent, so the next run (5 min) retries.
      for (const batch of chunk(messages, EXPO_BATCH)) {
        const response = await fetch(EXPO_SEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(batch),
        });
        if (!response.ok) {
          throw new Error(`Expo answered ${response.status}`);
        }
        const body = await response.json();
        await handleTickets(db, batch, body.data ?? []);
        sentCount += batch.length;
      }

      if (toRecord.length > 0) {
        const { error } = await db.from("sent_alerts").upsert(toRecord);
        if (error) {
          throw new Error(`write sent_alerts: ${error.message}`);
        }
      }

      await db.from("poll_runs").insert({ ok: true, zones: zoneCount, sent: sentCount });
      return Response.json({ ok: true, zones: zoneCount, sent: sentCount });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      await db.from("poll_runs").insert({ ok: false, zones: zoneCount, sent: sentCount, detail });
      return Response.json({ ok: false, detail }, { status: 500 });
    }
  }),
};

// Tickets come back in the same order as the messages. Dead phones are dropped now; the rest
// are saved so a later run can check their receipts.
// deno-lint-ignore no-explicit-any
async function handleTickets(db: any, batch: Message[], tickets: any[]) {
  const dead = [];
  const toCheck = [];
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      dead.push(batch[i].to);
    }
    if (ticket.status === "ok" && ticket.id) {
      toCheck.push({ ticket_id: ticket.id, expo_token: batch[i].to });
    }
  }
  if (dead.length > 0) {
    await db.from("push_tokens").delete().in("expo_token", dead);
  }
  if (toCheck.length > 0) {
    await db.from("push_tickets").insert(toCheck);
  }
}

// deno-lint-ignore no-explicit-any
async function checkReceipts(db: any) {
  const cutoff = new Date(Date.now() - RECEIPT_WAIT_MS).toISOString();
  const { data: rows } = await db.from("push_tickets").select("ticket_id, expo_token").lt("sent_at", cutoff).limit(1000);
  if (!rows || rows.length === 0) {
    return;
  }

  const ids = [];
  for (const row of rows) {
    ids.push(row.ticket_id);
  }
  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) {
    return; // Try again next run; receipts last 24 hours.
  }
  const body = await response.json();
  const receipts = body.data ?? {};

  const dead = [];
  for (const row of rows) {
    const receipt = receipts[row.ticket_id];
    if (receipt?.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
      dead.push(row.expo_token);
    }
  }
  if (dead.length > 0) {
    await db.from("push_tokens").delete().in("expo_token", dead);
  }
  await db.from("push_tickets").delete().in("ticket_id", ids);
}
