// Supply rows: seeded by onboarding, then read and updated by the checklist, Home, and
// the supply detail screen.

import type { SQLiteDatabase } from 'expo-sqlite';

import { SUPPLY_SECTIONS } from '@/app/onboarding/supplies';
import type { OnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { getChecklistIdsByTemplate, getTargetTemplateIds } from '@/db/checklist';
import { itemApplies } from '@/lib/checklist-template';

const INSERT_ITEM = `
  INSERT INTO inventory_items (
    name, category, quantity, checklist_item_id, created_at, updated_at
  ) VALUES (
    $name, $category, $quantity, $checklist_item_id, $created_at, $updated_at
  )
`;

// Screen 4's ids become rows with the label the user read and its section as the category.
function draftToRows(draft: OnboardingDraft) {
  const now = new Date().toISOString();
  const rows = [];

  // Tapped or not, so every checklist item has a detail screen.
  for (const section of SUPPLY_SECTIONS) {
    for (const item of section.items) {
      if (!itemApplies(item.id, draft.homeType, draft.concerns)) {
        continue;
      }

      rows.push({
        templateId: item.id,
        name: item.label,
        category: section.title,
        owned: draft.owned.includes(item.id),
        created_at: now,
        updated_at: now,
      });
    }
  }

  return rows;
}

// Runs once. The first-launch gate keeps it from running again.
export async function saveInventory(db: SQLiteDatabase, draft: OnboardingDraft) {
  const rows = draftToRows(draft);

  // The checklist is written first, so its rows already exist to link to.
  const byTemplate = await getChecklistIdsByTemplate(db);

  const targetIds = await getTargetTemplateIds(db);

  for (const row of rows) {
    // Target items start at 0 — owning bottled water isn't having 25 gallons.
    let quantity = 0;
    if (!targetIds.includes(row.templateId) && row.owned) {
      quantity = 1;
    }

    await db.runAsync(INSERT_ITEM, {
      $name: row.name,
      $category: row.category,
      $quantity: quantity,
      $checklist_item_id: byTemplate[row.templateId] ?? null,
      $created_at: row.created_at,
      $updated_at: row.updated_at,
    });
  }
}

// Supply rows for items a household edit just added to the checklist. Same shape as the
// onboarding seed, so every checklist row still has a detail screen to open.
export async function addSuppliesFor(db: SQLiteDatabase, templateIds: string[]) {
  if (templateIds.length === 0) {
    return;
  }

  // The checklist rows are written first, so their ids already exist to link to.
  const byTemplate = await getChecklistIdsByTemplate(db);
  const now = new Date().toISOString();

  for (const section of SUPPLY_SECTIONS) {
    for (const item of section.items) {
      if (!templateIds.includes(item.id)) {
        continue;
      }

      await db.runAsync(INSERT_ITEM, {
        $name: item.label,
        $category: section.title,
        // Nothing on hand — the user has not said they own it.
        $quantity: 0,
        $checklist_item_id: byTemplate[item.id] ?? null,
        $created_at: now,
        $updated_at: now,
      });
    }
  }
}

// Target, unit, and done come from the linked checklist item — null when there isn't one.
export type InventoryItemRow = {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  storage_location: string | null;
  expires_at: string | null;
  checklist_item_id: number | null;
  template_id: string | null;
  target_qty: number | null;
  unit: string | null;
  done: number | null;
};

// Linked supplies show the checklist's name, so onboarding's "Bottled water" reads as
// "Drinking water" everywhere. Done on read, so rows already saved are fixed too.
const DISPLAY_NAME = 'COALESCE(checklist_items.name, inventory_items.name) AS name';

// Shared by both reads so the list and the detail screen can't ask for different things.
const SELECT_ITEMS = `
  SELECT inventory_items.id,
         ${DISPLAY_NAME},
         inventory_items.category,
         inventory_items.quantity,
         inventory_items.storage_location,
         inventory_items.expires_at,
         inventory_items.checklist_item_id,
         checklist_items.template_id,
         checklist_items.target_qty,
         checklist_items.unit,
         checklist_items.done
    FROM inventory_items
    LEFT JOIN checklist_items
           ON checklist_items.id = inventory_items.checklist_item_id
`;

/**
 * Every supply, in the order onboarding wrote them.
 */
export async function getInventory(db: SQLiteDatabase) {
  return db.getAllAsync<InventoryItemRow>(`${SELECT_ITEMS} ORDER BY inventory_items.id`);
}

/**
 * One supply, for the detail screen. Null when the id doesn't exist.
 */
export async function getInventoryItem(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<InventoryItemRow>(
    `${SELECT_ITEMS} WHERE inventory_items.id = $id`,
    { $id: id }
  );
}

export type SupplyCoverage = {
  stocked: number;
  target: number;
};

/**
 * Home's Supplies bar. MIN stops an overstocked item from covering for another one.
 */
export async function getSupplyCoverage(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<SupplyCoverage>(
    `SELECT COALESCE(SUM(MIN(inventory_items.quantity, checklist_items.target_qty)), 0) AS stocked,
            COALESCE(SUM(checklist_items.target_qty), 0) AS target
       FROM checklist_items
       JOIN inventory_items ON inventory_items.checklist_item_id = checklist_items.id
      WHERE checklist_items.target_qty IS NOT NULL`
  );

  return row ?? { stocked: 0, target: 0 };
}

/**
 * Saves a new count, then keeps the linked checklist item in step. Floors at zero here too.
 */
export async function setInventoryQuantity(
  db: SQLiteDatabase,
  id: number,
  quantity: number
) {
  let safeQuantity = quantity;
  if (safeQuantity < 0) {
    safeQuantity = 0;
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE inventory_items
        SET quantity = $quantity, updated_at = $updated_at
      WHERE id = $id`,
    {
      $quantity: safeQuantity,
      $updated_at: now,
      $id: id,
    }
  );

  // Ticks at target, unticks below it. COALESCE keeps the first done_at.
  await db.runAsync(
    `UPDATE checklist_items
        SET done = CASE WHEN $quantity >= target_qty THEN 1 ELSE 0 END,
            done_at = CASE WHEN $quantity >= target_qty THEN COALESCE(done_at, $now) ELSE NULL END,
            updated_at = $now
      WHERE target_qty IS NOT NULL
        AND id = (SELECT checklist_item_id FROM inventory_items WHERE id = $id)`,
    {
      $quantity: safeQuantity,
      $now: now,
      $id: id,
    }
  );
}

/**
 * Sets or clears one supply's expiry date. Null clears it.
 */
export async function setExpiryDate(db: SQLiteDatabase, id: number, expiresAt: string | null) {
  await db.runAsync(
    `UPDATE inventory_items SET expires_at = $expires_at, updated_at = $updated_at WHERE id = $id`,
    { $expires_at: expiresAt, $updated_at: new Date().toISOString(), $id: id }
  );
}

export type LowestSupply = {
  id: number;
  name: string;
  quantity: number;
  target_qty: number;
  unit: string | null;
  template_id: string | null;
};

/**
 * The countable supply furthest from its target, as a fraction. Whether it's LOW is Home's call.
 */
export async function getLowestSupply(db: SQLiteDatabase) {
  return db.getFirstAsync<LowestSupply>(
    `SELECT inventory_items.id,
            ${DISPLAY_NAME},
            inventory_items.quantity,
            checklist_items.target_qty,
            checklist_items.unit,
            checklist_items.template_id
       FROM inventory_items
       JOIN checklist_items ON checklist_items.id = inventory_items.checklist_item_id
      WHERE checklist_items.target_qty IS NOT NULL
      ORDER BY (CAST(inventory_items.quantity AS REAL) / checklist_items.target_qty) ASC,
               inventory_items.id ASC
      LIMIT 1`
  );
}

export type SoonestExpiring = {
  id: number;
  name: string;
  expires_at: string;
};

/**
 * The supply with the nearest expiry date. Whether it's SOON is Home's call.
 */
export async function getSoonestExpiring(db: SQLiteDatabase) {
  return db.getFirstAsync<SoonestExpiring>(
    `SELECT inventory_items.id,
            ${DISPLAY_NAME},
            inventory_items.expires_at
       FROM inventory_items
       LEFT JOIN checklist_items ON checklist_items.id = inventory_items.checklist_item_id
      WHERE inventory_items.expires_at IS NOT NULL
      ORDER BY inventory_items.expires_at ASC
      LIMIT 1`
  );
}
