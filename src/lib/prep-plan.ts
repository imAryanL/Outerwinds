// Everything the printable prep plan needs, gathered in one read. No formatting here —
// this hands back plain data so the PDF template and the on-screen preview can't disagree.

import type { SQLiteDatabase } from 'expo-sqlite';

import { getChecklist, type ChecklistItemRow } from '@/db/checklist';
import { getHousehold, type Household } from '@/db/household';
import { getInventory } from '@/db/inventory';
import { groupByCategory } from '@/lib/checklist-template';
import { daysUntil, isExpiringSoon } from '@/lib/expiry';

// What's short: the checklist row plus how many more are needed.
export type ShortfallRow = {
  name: string;
  onHand: number;
  target: number;
  short: number;
  unit: string | null;
};

// What's aging: a supply you already have, with its replace-by date.
export type ReplacementRow = {
  name: string;
  expiresAt: string;
  daysLeft: number;
};

export type PrepPlan = {
  household: Household | null;
  generatedAt: Date;
  done: number;
  total: number;
  categories: { name: string; items: ChecklistItemRow[] }[];
  stillToBuy: ShortfallRow[];
  dueForReplacing: ReplacementRow[];
};

/**
 * `today` is passed in rather than read here so the sections can be tested against a
 * fixed date, the same way daysUntil already works.
 */
export async function buildPrepPlan(db: SQLiteDatabase, today: Date): Promise<PrepPlan> {
  const household = await getHousehold(db);
  const checklist = await getChecklist(db);
  const inventory = await getInventory(db);

  let done = 0;
  for (const item of checklist) {
    if (item.done === 1) {
      done = done + 1;
    }
  }

  // Short of target. Only counted items can be short — a plain tick-box has no target,
  // and an item with nothing linked to it has no count to compare against.
  const stillToBuy: ShortfallRow[] = [];
  for (const item of checklist) {
    if (item.target_qty === null || item.on_hand === null) {
      continue;
    }
    if (item.on_hand >= item.target_qty) {
      continue;
    }

    stillToBuy.push({
      name: item.name,
      onHand: item.on_hand,
      target: item.target_qty,
      short: item.target_qty - item.on_hand,
      unit: item.unit,
    });
  }

  // Deliberately a separate pass, not a filter on the list above: something aging is
  // NOT something missing. You own it, it's just old, and the plan must not claim
  // you need to buy it twice.
  const dueForReplacing: ReplacementRow[] = [];
  for (const supply of inventory) {
    if (supply.expires_at === null) {
      continue;
    }

    const daysLeft = daysUntil(supply.expires_at, today);
    if (!isExpiringSoon(daysLeft)) {
      continue;
    }

    dueForReplacing.push({
      name: supply.name,
      expiresAt: supply.expires_at,
      daysLeft: daysLeft,
    });
  }

  // Soonest first, so anything already overdue leads.
  dueForReplacing.sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    household: household,
    generatedAt: today,
    done: done,
    total: checklist.length,
    categories: groupByCategory(checklist),
    stillToBuy: stillToBuy,
    dueForReplacing: dueForReplacing,
  };
}
