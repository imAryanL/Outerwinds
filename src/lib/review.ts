// Asks for an App Store rating once, on a quiet Home screen, after the app has been used for real.

import * as StoreReview from 'expo-store-review';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings';

const ASKED_KEY = 'review_asked';

// Two ticked items means they've done something in the app, not just opened it.
const ITEMS_DONE_NEEDED = 2;

// Onboarding ticks the supplies someone already owns, so the item count can be met in the first
// minutes. Waiting a day means they've come back to the app at least once.
const DAYS_SINCE_SETUP_NEEDED = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A beat after Home appears, so the sheet doesn't jump out the instant someone lands.
const WAIT_MS = 2000;

export async function askForReviewIfReady(
  db: SQLiteDatabase,
  itemsDone: number,
  stormQuiet: boolean,
  setUpAt: string
) {
  if (itemsDone < ITEMS_DONE_NEEDED || !stormQuiet) {
    return;
  }

  const daysSinceSetup = (Date.now() - new Date(setUpAt).getTime()) / MS_PER_DAY;
  if (daysSinceSetup < DAYS_SINCE_SETUP_NEEDED) {
    return;
  }

  // Once only. Apple also caps how often the sheet can show, so a second ask could do nothing anyway.
  if ((await getSetting(db, ASKED_KEY)) !== null) {
    return;
  }

  // False in TestFlight and on web, where there is no sheet to show.
  if (!(await StoreReview.isAvailableAsync())) {
    return;
  }

  // Saved before asking, so a crash or a quick tab switch can't ask twice.
  await setSetting(db, ASKED_KEY, new Date().toISOString());

  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  await StoreReview.requestReview();
}
