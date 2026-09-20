// Small app-level flags, one row per key. Anything that isn't about a household,
// a supply or a document lives here.

import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSetting(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = $key',
    { $key: key }
  );

  return row?.value ?? null;
}

// Upsert, so callers never have to know whether the key already exists.
export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ($key, $value)
       ON CONFLICT(key) DO UPDATE SET value = $value`,
    { $key: key, $value: value }
  );
}
