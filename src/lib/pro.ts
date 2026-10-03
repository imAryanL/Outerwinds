// The one place the app asks "is Pro unlocked?". Every paid feature reads this and nothing else.

import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings';
import { hasProEntitlement } from '@/lib/purchases';

// The development switch in Settings.
const DEV_KEY = 'pro_unlocked';
// RevenueCat's last answer, kept for when it can't be reached.
const LAST_KNOWN_KEY = 'pro_last_known';

// ⚠️ This gates ADDING only — never opening what's already saved.
export async function isPro(db: SQLiteDatabase): Promise<boolean> {
  if (__DEV__ && (await getSetting(db, DEV_KEY)) === 'true') {
    return true;
  }

  try {
    const unlocked = await hasProEntitlement();
    await setSetting(db, LAST_KNOWN_KEY, unlocked ? 'true' : 'false');
    return unlocked;
  } catch {
    // RevenueCat couldn't answer, so a paying user keeps Pro and everyone else stays free.
    return (await getSetting(db, LAST_KNOWN_KEY)) === 'true';
  }
}

// Development only. The real unlock comes from a purchase, not this toggle.
export async function setProForDevelopment(db: SQLiteDatabase, unlocked: boolean) {
  await setSetting(db, DEV_KEY, unlocked ? 'true' : 'false');
}

// How many documents the free tier holds. Exported so the vault and the paywall copy
// can't disagree about the number.
export const FREE_DOCUMENT_LIMIT = 3;
