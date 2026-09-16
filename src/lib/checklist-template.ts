// The prep checklist every household starts with. Plain data and math, no database or React.
// Ids match the onboarding supplies screen, so "I already own this" lands on the right row.

import { computeTargets } from '@/lib/targets';

// Which computeTargets figure fills the target. Null for have-it-or-don't items.
type QuantitySource = 'waterGallons' | 'meals' | 'flashlights' | null;

type TemplateItem = {
  templateId: string;
  name: string;
  category: string;
  rationale: string;
  quantityFrom: QuantitySource;
  unit: string | null;
  // Leave these out and the item goes to every household.
  homeTypes?: string[];
  concern?: string;
};

// Matches the onboarding supplies screen word for word.
export const CHECKLIST_CATEGORIES = [
  'Water & food',
  'Power & light',
  'Medical & documents',
  'Home & property',
] as const;

const TEMPLATE: TemplateItem[] = [
  {
    templateId: 'water',
    name: 'Drinking water',
    category: 'Water & food',
    rationale: 'One gallon per person, per day',
    quantityFrom: 'waterGallons',
    unit: 'gallons',
  },
  {
    templateId: 'food',
    name: 'Non-perishable food',
    category: 'Water & food',
    rationale: 'No cooking, no refrigeration',
    quantityFrom: 'meals',
    unit: 'meals',
  },
  {
    templateId: 'can_opener',
    name: 'Manual can opener',
    category: 'Water & food',
    rationale: 'No power required',
    quantityFrom: null,
    unit: null,
  },
  {
    templateId: 'flashlights',
    name: 'Flashlights',
    category: 'Power & light',
    rationale: 'Safer than candles indoors',
    quantityFrom: 'flashlights',
    unit: null,
  },
  {
    templateId: 'batteries',
    name: 'Batteries',
    category: 'Power & light',
    rationale: 'Powers the radio and the lights',
    quantityFrom: null,
    unit: null,
  },
  {
    templateId: 'radio',
    name: 'Battery or hand-crank radio',
    category: 'Power & light',
    rationale: 'Weather alerts with no signal',
    quantityFrom: null,
    unit: null,
  },
  {
    templateId: 'first_aid',
    name: 'First aid kit',
    category: 'Medical & documents',
    rationale: 'Pharmacies close before a storm',
    quantityFrom: null,
    unit: null,
  },
  {
    templateId: 'medicines',
    name: 'Prescription medicines',
    category: 'Medical & documents',
    rationale: 'Refills can take days afterwards',
    quantityFrom: null,
    unit: null,
    concern: 'prescriptions',
  },
  {
    templateId: 'cash',
    name: 'Cash',
    category: 'Medical & documents',
    rationale: 'Card readers need power',
    quantityFrom: null,
    unit: null,
  },
  {
    templateId: 'documents',
    name: 'Important documents',
    category: 'Medical & documents',
    rationale: 'Insurance, IDs, prescriptions',
    quantityFrom: null,
    unit: null,
  },
  {
    templateId: 'shutters',
    name: 'Storm shutters or plywood',
    category: 'Home & property',
    rationale: 'Protects windows from wind-driven debris',
    quantityFrom: null,
    unit: null,
  },
  {
    templateId: 'sandbags',
    name: 'Sandbags',
    category: 'Home & property',
    rationale: 'Blocks water at doors and thresholds',
    quantityFrom: null,
    unit: null,
    homeTypes: ['house'],
  },
  {
    templateId: 'tarp',
    name: 'Heavy-duty tarp',
    category: 'Home & property',
    rationale: 'Covers roof damage until repairs',
    quantityFrom: null,
    unit: null,
    homeTypes: ['house', 'mobile'],
  },
  {
    templateId: 'tie_downs',
    name: 'Rope or tie-downs',
    category: 'Home & property',
    rationale: 'Secures grills, furniture, and bins',
    quantityFrom: null,
    unit: null,
    homeTypes: ['house', 'mobile'],
  },
];

// Whether an item belongs on this household's checklist.
export function itemApplies(
  templateId: string,
  homeType: string | null,
  concerns: string[]
): boolean {
  for (const item of TEMPLATE) {
    if (item.templateId !== templateId) {
      continue;
    }

    if (item.concern !== undefined && !concerns.includes(item.concern)) {
      return false;
    }

    // Home type is optional on screen 3, so an unknown one keeps the item.
    if (item.homeTypes !== undefined && homeType !== null) {
      if (!item.homeTypes.includes(homeType)) {
        return false;
      }
    }

    return true;
  }

  return true;
}

// Items that start applying when the household changes — a new home type or a newly
// ticked concern. Editing the household adds these and never takes anything away, so an
// item the user deleted on purpose can't come back.
export function newlyApplicable(
  oldHomeType: string | null,
  oldConcerns: string[],
  newHomeType: string | null,
  newConcerns: string[]
): string[] {
  const ids: string[] = [];

  for (const item of TEMPLATE) {
    const applied = itemApplies(item.templateId, oldHomeType, oldConcerns);
    const applies = itemApplies(item.templateId, newHomeType, newConcerns);

    if (!applied && applies) {
      ids.push(item.templateId);
    }
  }

  return ids;
}

// One checklist row, ready to be written to the database.
export type ChecklistDraftItem = {
  templateId: string;
  name: string;
  category: string;
  rationale: string;
  targetQty: number | null;
  unit: string | null;
  done: boolean;
  sortOrder: number;
};

// `owned` is the supply ids the user tapped on screen 4.
export function buildChecklist(
  adults: number,
  kids: number,
  pets: number,
  owned: string[],
  homeType: string | null,
  concerns: string[]
): ChecklistDraftItem[] {
  const targets = computeTargets(adults, kids, pets);
  const items: ChecklistDraftItem[] = [];

  let sortOrder = 0;
  for (const item of TEMPLATE) {
    if (!itemApplies(item.templateId, homeType, concerns)) {
      continue;
    }

    let targetQty = null;
    if (item.quantityFrom !== null) {
      targetQty = targets[item.quantityFrom];
    }

    // Owning water isn't having 25 gallons, so only items without a target start done.
    const isBinary = item.quantityFrom === null;
    const done = isBinary && owned.includes(item.templateId);

    items.push({
      templateId: item.templateId,
      name: item.name,
      category: item.category,
      rationale: item.rationale,
      targetQty: targetQty,
      unit: item.unit,
      done: done,
      sortOrder: sortOrder,
    });

    sortOrder = sortOrder + 1;
  }

  return items;
}
