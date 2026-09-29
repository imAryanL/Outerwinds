// The last answer NWS gave, saved so the Alerts screen still has something true to show offline.

import type { SQLiteDatabase } from 'expo-sqlite';

import { stillRunning } from '@/lib/alert-rules';
import type { AlertData } from '@/lib/nws';

// One row ever — each answer replaces the last.
const CACHE_ID = 1;

export type CachedAlerts = {
  alerts: AlertData[];
  checkedAt: string;
};

// Hands back what it saved, so the screen shows the same time the row holds.
export async function saveAlerts(db: SQLiteDatabase, zoneId: string, alerts: AlertData[]) {
  const saved: CachedAlerts = {
    alerts: alerts,
    checkedAt: new Date().toISOString(),
  };

  await db.runAsync(
    'INSERT OR REPLACE INTO alerts_cache (id, alerts, checked_at, zone_id) VALUES ($id, $alerts, $checked_at, $zone_id)',
    {
      $id: CACHE_ID,
      $alerts: JSON.stringify(saved.alerts),
      $checked_at: saved.checkedAt,
      $zone_id: zoneId,
    }
  );

  return saved;
}

// Null when nothing has been saved for this zone yet. Alerts that have ended since are
// dropped here, so Home and Alerts can't show one that's over.
export async function getCachedAlerts(db: SQLiteDatabase, zoneId: string) {
  const row = await db.getFirstAsync<{ alerts: string; checked_at: string }>(
    'SELECT alerts, checked_at FROM alerts_cache WHERE id = ? AND zone_id = ?',
    CACHE_ID,
    zoneId
  );

  if (row === null) {
    return null;
  }

  const cached: CachedAlerts = {
    alerts: stillRunning(JSON.parse(row.alerts)),
    checkedAt: row.checked_at,
  };
  return cached;
}
