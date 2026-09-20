// Sets up the local database and upgrades old files in place instead of wiping them.

import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'landfall.db';

// Bump this by one every time a step is added to the ladder below.
const DATABASE_VERSION = 8;

/**
 * Brings a database file up to the current version. Runs once when the app starts.
 * A new phone comes in at version 0 and runs every step; a phone that already ran
 * version 1 skips past it and keeps its data.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // The version number is stored inside the database file, so it travels with the data.
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );

  // A file that has never been touched reports 0.
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  console.log(`[db] upgrading from version ${currentVersion} to ${DATABASE_VERSION}`);

  // --- Step 1 ------------------------------------------------------------------------
  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE household (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT,

        -- These drive the checklist targets, like 1 gallon of water per person per day.
        adults INTEGER NOT NULL DEFAULT 1,
        kids INTEGER NOT NULL DEFAULT 0,
        pets INTEGER NOT NULL DEFAULT 0,
        pet_types TEXT,

        -- SQLite has no true/false type, so a flag is 0 or 1.
        has_medical_needs INTEGER NOT NULL DEFAULT 0,
        medical_notes TEXT,

        home_type TEXT,

        -- Text, not a number: saved as a number, a zip like 01234 would lose its
        -- leading zero and become 1234.
        zip_code TEXT,

        -- Filled in by the National Weather Service, never typed by the user and never
        -- hardcoded by us. One call to /points returns all of these.
        county TEXT,
        nws_zone_id TEXT,
        nws_office TEXT,
        latitude REAL,
        longitude REAL,

        -- ISO strings — SQLite has no date type.
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentVersion = 1;
  }

  // --- Step 2 ------------------------------------------------------------------------
  if (currentVersion === 1) {
    await db.execAsync(`
      CREATE TABLE inventory_items (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category TEXT,

        -- Onboarding seeds these at 1: the user only said they own it, not how much.
        quantity INTEGER NOT NULL DEFAULT 1,

        -- ISO string like the household dates. Null for anything that never expires.
        expires_at TEXT,

        -- A path to a file on this phone, not the image itself.
        photo_uri TEXT,
        storage_location TEXT,

        -- The checklist item this stocks. No foreign key yet — checklist_items
        -- doesn't exist, and SQLite would only complain about it at write time.
        checklist_item_id INTEGER,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentVersion = 2;
  }

  // --- Step 3 ------------------------------------------------------------------------
  if (currentVersion === 2) {
    // 'Plantation, FL'. A new step, not an edit to step 1 — step 1 already ran on phones.
    await db.execAsync(`
      ALTER TABLE household ADD COLUMN place TEXT;
    `);

    currentVersion = 3;
  }

  // --- Step 4 ------------------------------------------------------------------------
  if (currentVersion === 3) {
    await db.execAsync(`
      CREATE TABLE checklist_items (
        id INTEGER PRIMARY KEY NOT NULL,

        -- Which rule produced this row, like 'water' or 'flashlights'. It is how the
        -- engine finds an item again to update it when the household changes size,
        -- instead of adding a second water row. Null for anything the user typed.
        template_id TEXT,

        name TEXT NOT NULL,
        category TEXT,

        -- The short line under the name, like '1 gallon per person, per day'.
        rationale TEXT,

        -- Split on purpose. The screen shows '8 gallons', but a number and a unit kept
        -- apart are what let the app compare what is stored against what is needed.
        -- One combined string would look the same and answer nothing.
        target_qty INTEGER,
        unit TEXT,

        -- 0 or 1. done_at is kept so Home can eventually say what moved this week.
        done INTEGER NOT NULL DEFAULT 0,
        done_at TEXT,

        -- Items the user added themselves survive the engine re-running.
        is_custom INTEGER NOT NULL DEFAULT 0,

        -- The order the list is drawn in, so it does not shuffle between launches.
        sort_order INTEGER NOT NULL DEFAULT 0,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentVersion = 4;
  }

  // --- Step 5 ------------------------------------------------------------------------
  if (currentVersion === 4) {
    // One row, not one per alert — an all-clear is an empty list and still needs a time.
    await db.execAsync(`
      CREATE TABLE alerts_cache (
        id INTEGER PRIMARY KEY NOT NULL,

        -- The list NWS returned, as JSON. '[]' means it answered and nothing is active.
        alerts TEXT NOT NULL,
        checked_at TEXT NOT NULL,

        -- So a saved answer for an old zone never shows under a new one.
        zone_id TEXT NOT NULL
      );
    `);

    currentVersion = 5;
  }

  // --- Step 6 ------------------------------------------------------------------------
  if (currentVersion === 5) {
    await db.execAsync(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY NOT NULL,

        title TEXT NOT NULL,
        category TEXT NOT NULL,

        -- JSON array of paths under the app's own documents directory, e.g. front and
        -- back of an ID. Same trick household.medical_notes uses for a list in one column.
        photo_uris TEXT NOT NULL,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentVersion = 6;
  }

  // --- Step 7 ------------------------------------------------------------------------
  if (currentVersion === 6) {
    // Free text — a policy number, an agent's phone, anything worth having handy
    // without needing to zoom into the photo. Optional, so existing rows default empty.
    await db.execAsync(`
      ALTER TABLE documents ADD COLUMN notes TEXT NOT NULL DEFAULT '';
    `);

    currentVersion = 7;
  }

  // --- Step 8 ------------------------------------------------------------------------
  if (currentVersion === 7) {
    // A key/value shelf for small app-level flags that don't belong to a household,
    // a supply or a document — starting with whether Pro is unlocked.
    await db.execAsync(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    currentVersion = 8;
  }

  // --- Future steps go here ----------------------------------------------------------
  //   if (currentVersion === 8) {
  //     ...
  //     currentVersion = 9;
  //   }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
