// Checklist rows: seeded at onboarding, then read, ticked, added to, and deleted from.
// What goes in the starting list is decided in checklist-template.ts.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { OnboardingDraft } from '@/components/onboarding/onboarding-draft';
import type { HouseholdEdit } from '@/db/household';
import { buildChecklist, newlyApplicable } from '@/lib/checklist-template';

// is_custom is left out — template items take the column default, 0.
const INSERT_ITEM = `
  INSERT INTO checklist_items (
    template_id, name, category, rationale,
    target_qty, unit, done, done_at, sort_order,
    created_at, updated_at
  ) VALUES (
    $template_id, $name, $category, $rationale,
    $target_qty, $unit, $done, $done_at, $sort_order,
    $created_at, $updated_at
  )
`;

// Runs once. The first-launch gate keeps it from running again.
export async function saveChecklist(db: SQLiteDatabase, draft: OnboardingDraft) {
  const items = buildChecklist(
    draft.adults,
    draft.kids,
    draft.pets,
    draft.owned,
    draft.homeType,
    draft.concerns
  );
  const now = new Date().toISOString();

  for (const item of items) {
    await db.runAsync(INSERT_ITEM, {
      $template_id: item.templateId,
      $name: item.name,
      $category: item.category,
      $rationale: item.rationale,
      $target_qty: item.targetQty,
      $unit: item.unit,
      $done: item.done ? 1 : 0,
      $done_at: item.done ? now : null,
      $sort_order: item.sortOrder,
      $created_at: now,
      $updated_at: now,
    });
  }
}

// Household size changed, so the three counted items need new targets. What's on hand is
// left alone — only the number you're aiming for moves.
export async function updateTargets(
  db: SQLiteDatabase,
  adults: number,
  kids: number,
  pets: number
) {
  // buildChecklist already knows which item takes which figure, so that mapping stays in
  // one place. Home type and concerns are irrelevant here — every counted item applies to
  // everyone, and nothing is written for the items this skips.
  const items = buildChecklist(adults, kids, pets, [], null, []);
  const now = new Date().toISOString();

  for (const item of items) {
    if (item.targetQty === null) {
      continue;
    }

    await db.runAsync(
      `UPDATE checklist_items
          SET target_qty = $target_qty, updated_at = $updated_at
        WHERE template_id = $template_id`,
      {
        $target_qty: item.targetQty,
        $updated_at: now,
        $template_id: item.templateId,
      }
    );
  }
}

// The household changed, so some items start applying — a new home type, or a newly ticked
// concern. Only additions happen here: an item the user removed on purpose stays gone.
// Returns the template ids added, so their supply rows can be created next.
export async function addNewlyApplicableItems(
  db: SQLiteDatabase,
  before: { homeType: string | null; concerns: string[] },
  after: HouseholdEdit
) {
  const added = newlyApplicable(before.homeType, before.concerns, after.homeType, after.concerns);

  if (added.length === 0) {
    return [];
  }

  const items = buildChecklist(
    after.adults,
    after.kids,
    after.pets,
    [],
    after.homeType,
    after.concerns
  );
  const now = new Date().toISOString();

  // New rows go after everything already saved, so nothing on screen reshuffles.
  const last = await db.getFirstAsync<{ highest: number | null }>(
    'SELECT MAX(sort_order) AS highest FROM checklist_items'
  );
  let sortOrder = (last?.highest ?? 0) + 1;

  for (const item of items) {
    if (!added.includes(item.templateId)) {
      continue;
    }

    // Never started as done — the user has not said they own it.
    await db.runAsync(INSERT_ITEM, {
      $template_id: item.templateId,
      $name: item.name,
      $category: item.category,
      $rationale: item.rationale,
      $target_qty: item.targetQty,
      $unit: item.unit,
      $done: 0,
      $done_at: null,
      $sort_order: sortOrder,
      $created_at: now,
      $updated_at: now,
    });

    sortOrder = sortOrder + 1;
  }

  return added;
}

export type ChecklistProgress = {
  done: number;
  total: number;
};

/**
 * How much is finished. done is 0 or 1, so SUM counts the ticked ones.
 */
export async function getChecklistProgress(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<ChecklistProgress>(
    'SELECT COUNT(*) AS total, COALESCE(SUM(done), 0) AS done FROM checklist_items'
  );

  if (row === null) {
    return { done: 0, total: 0 };
  }

  return row;
}

// inventory_id and on_hand come from the linked supply — null for a custom item.
export type ChecklistItemRow = {
  id: number;
  template_id: string | null;
  name: string;
  category: string | null;
  rationale: string | null;
  target_qty: number | null;
  unit: string | null;
  done: number;
  sort_order: number;
  is_custom: number;
  inventory_id: number | null;
  on_hand: number | null;
};

// Template items in their laid-out order, then custom items oldest first.
export async function getChecklist(db: SQLiteDatabase) {
  return db.getAllAsync<ChecklistItemRow>(
    `SELECT checklist_items.id,
            checklist_items.template_id,
            checklist_items.name,
            checklist_items.category,
            checklist_items.rationale,
            checklist_items.target_qty,
            checklist_items.unit,
            checklist_items.done,
            checklist_items.sort_order,
            checklist_items.is_custom,
            inventory_items.id AS inventory_id,
            inventory_items.quantity AS on_hand
       FROM checklist_items
       LEFT JOIN inventory_items
              ON inventory_items.checklist_item_id = checklist_items.id
      ORDER BY checklist_items.is_custom, checklist_items.sort_order, checklist_items.id`
  );
}

/**
 * Ticks or unticks one item. done_at clears on untick, so it means "last finished".
 */
export async function setChecklistItemDone(
  db: SQLiteDatabase,
  id: number,
  done: boolean
) {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE checklist_items
        SET done = $done, done_at = $done_at, updated_at = $updated_at
      WHERE id = $id`,
    {
      $done: done ? 1 : 0,
      $done_at: done ? now : null,
      $updated_at: now,
      $id: id,
    }
  );
}

/**
 * Every template id mapped to its row id, so other tables can link to it.
 */
export async function getChecklistIdsByTemplate(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ id: number; template_id: string }>(
    'SELECT id, template_id FROM checklist_items WHERE template_id IS NOT NULL'
  );

  const byTemplate: Record<string, number> = {};
  for (const row of rows) {
    byTemplate[row.template_id] = row.id;
  }

  return byTemplate;
}

/**
 * Adds an item the user typed in. Everything but name and category takes its default.
 */
export async function addCustomChecklistItem(
  db: SQLiteDatabase,
  name: string,
  category: string
) {
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO checklist_items (name, category, is_custom, created_at, updated_at)
     VALUES ($name, $category, 1, $created_at, $updated_at)`,
    { $name: name, $category: category, $created_at: now, $updated_at: now }
  );
}

/**
 * Deletes an item the user added. is_custom = 1 means a template item can never be deleted here.
 */
export async function deleteCustomChecklistItem(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM checklist_items WHERE id = $id AND is_custom = 1', { $id: id });
}

/**
 * Removes a built-in item and its supply row. Items with a target (water, food, flashlights) can't be.
 */
export async function removeChecklistItem(db: SQLiteDatabase, id: number) {
  // One transaction, so a failure can't leave a supply row behind with no checklist item.
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'DELETE FROM checklist_items WHERE id = $id AND target_qty IS NULL',
      { $id: id }
    );

    // Nothing deleted means it had a target, so its supply row stays too.
    if (result.changes === 0) {
      return;
    }

    await db.runAsync('DELETE FROM inventory_items WHERE checklist_item_id = $id', { $id: id });
  });
}

// Which checklist items ask for a number. Owning water doesn't finish 25 gallons.
export async function getTargetTemplateIds(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ template_id: string }>(
    'SELECT template_id FROM checklist_items WHERE target_qty IS NOT NULL'
  );

  const ids = [];
  for (const row of rows) {
    ids.push(row.template_id);
  }

  return ids;
}
