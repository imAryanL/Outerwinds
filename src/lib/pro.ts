// The one place the app asks "is Pro unlocked?". Every paid feature reads this and
// nothing else, so swapping the dev switch for RevenueCat later is a change to this
// file alone.
//
// Until RevenueCat exists, the answer is a flag in the settings table that a
// development-only row in Settings can flip.

import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings';

const PRO_KEY = 'pro_unlocked';

// Free is the safe answer: if we can't tell, the user isn't charged for something
// they didn't buy. ⚠️ This gates ADDING only — never opening what's already saved.
export async function isPro(db: SQLiteDatabase): Promise<boolean> {
  try {
    return (await getSetting(db, PRO_KEY)) === 'true';
  } catch {
    return false;
  }
}

// Development only. The real unlock will come from a purchase, not a toggle.
export async function setProForDevelopment(db: SQLiteDatabase, unlocked: boolean) {
  await setSetting(db, PRO_KEY, unlocked ? 'true' : 'false');
}

// How many documents the free tier holds. Exported so the vault and the paywall copy
// can't disagree about the number.
export const FREE_DOCUMENT_LIMIT = 3;
