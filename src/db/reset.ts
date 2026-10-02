// Empties every table, for "Delete all my data". The tables stay, so the app can start over.

import type { SQLiteDatabase } from 'expo-sqlite';

const TABLES = [
  'household',
  'checklist_items',
  'inventory_items',
  'documents',
  'property_areas',
  'alerts_cache',
  'settings',
];

// One transaction, so a failure halfway can't leave half a household behind.
// settings holds the Pro flag, which today is only a testing switch. Once Pro is a real
// purchase it must not be cleared here.
export async function deleteAllData(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  });
}
