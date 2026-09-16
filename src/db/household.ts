// Writes the one household row. Screens call this instead of writing SQL themselves.
// Onboarding fills a draft in memory; the summary screen hands it here to be saved.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { OnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { formatPlace, type PointData } from '@/lib/nws';
import { lookupZip } from '@/lib/zip-lookup';

// There is only ever one household, so the row always uses the same id. That also makes a
// later 'edit your household' screen an update rather than a second row.
const HOUSEHOLD_ID = 1;

// Named placeholders instead of a row of question marks — seventeen columns lined up by
// position is too easy to get wrong, and a swapped latitude and longitude would be silent.
const INSERT_HOUSEHOLD = `
  INSERT OR REPLACE INTO household (
    id, name, adults, kids, pets, pet_types,
    has_medical_needs, medical_notes, home_type, zip_code,
    county, nws_zone_id, nws_office, latitude, longitude, place,
    created_at, updated_at
  ) VALUES (
    $id, $name, $adults, $kids, $pets, $pet_types,
    $has_medical_needs, $medical_notes, $home_type, $zip_code,
    $county, $nws_zone_id, $nws_office, $latitude, $longitude, $place,
    $created_at, $updated_at
  )
`;

// The answers a household is made of. Onboarding fills these in a draft; the Settings edit
// screen collects the same set again, minus the supplies it already seeded.
export type HouseholdEdit = {
  name: string;
  adults: number;
  kids: number;
  pets: number;
  concerns: string[];
  zip: string;
  homeType: string | null;
  point: PointData | null;
};

// The same columns again, minus id and created_at. An edit must not restamp the date the
// household was first set up.
const UPDATE_HOUSEHOLD = `
  UPDATE household SET
    name = $name, adults = $adults, kids = $kids, pets = $pets,
    has_medical_needs = $has_medical_needs, medical_notes = $medical_notes,
    home_type = $home_type, zip_code = $zip_code,
    county = $county, nws_zone_id = $nws_zone_id, nws_office = $nws_office,
    latitude = $latitude, longitude = $longitude, place = $place,
    updated_at = $updated_at
  WHERE id = $id
`;

// Turns those answers into the flat values the table stores.
function draftToRow(draft: HouseholdEdit) {
  const now = new Date().toISOString();

  // These stay null when the lookup never succeeded — onboarding is allowed to finish
  // offline, and they get filled in later.
  let county = null;
  let zoneId = null;
  let office = null;
  let place = null;
  if (draft.point !== null) {
    county = draft.point.county;
    zoneId = draft.point.zoneId;
    office = draft.point.office;

    // The only human-readable part of the reply — county and office are codes like FLC011
    // and MFL. Stored joined because 'Plantation, FL' is the only form anything displays.
    place = formatPlace(draft.point);
  }

  // PointData carries no coordinates, so they come back out of the bundled ZIP table.
  // That's a local file, so this still works with no signal.
  let latitude = null;
  let longitude = null;
  const coords = lookupZip(draft.zip);
  if (coords !== null) {
    latitude = coords.lat;
    longitude = coords.lon;
  }

  return {
    name: draft.name,
    adults: draft.adults,
    kids: draft.kids,
    pets: draft.pets,
    pet_types: null,

    // The table has no column for the concern chips. The flag answers 'anything at all',
    // and the JSON keeps which ones, so the checklist can add the right items later.
    has_medical_needs: draft.concerns.length > 0 ? 1 : 0,
    medical_notes: JSON.stringify(draft.concerns),

    home_type: draft.homeType,
    zip_code: draft.zip,
    county: county,
    nws_zone_id: zoneId,
    nws_office: office,
    latitude: latitude,
    longitude: longitude,
    place: place,
    created_at: now,
    updated_at: now,
  };
}

// One saved household, exactly as the table stores it. The field names are snake_case
// because that is what SQLite hands back — converting them would mean a mapping layer
// that has to be kept in step with the columns for no real gain.
export type Household = {
  id: number;
  name: string | null;
  adults: number;
  kids: number;
  pets: number;
  pet_types: string | null;
  has_medical_needs: number;
  medical_notes: string | null;
  home_type: string | null;
  zip_code: string | null;
  county: string | null;
  nws_zone_id: string | null;
  nws_office: string | null;
  latitude: number | null;
  longitude: number | null;
  place: string | null;
  created_at: string;
  updated_at: string;
};

// The saved household, or null if onboarding never ran. Screens that only need to know
// whether it exists should use hasHousehold instead of pulling every column.
export async function getHousehold(db: SQLiteDatabase) {
  return db.getFirstAsync<Household>(
    'SELECT * FROM household WHERE id = ?',
    HOUSEHOLD_ID
  );
}

// Whether onboarding has ever finished. This is the whole first-launch check: no row
// means the user has never been through it, so there is no separate 'completed' flag to
// keep in sync.
export async function hasHousehold(db: SQLiteDatabase) {
  // Only the id is selected — the question is whether the row exists, not what is in it.
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM household WHERE id = ?',
    HOUSEHOLD_ID
  );

  return row !== null;
}

// Saves everything onboarding collected. The first time this app writes to the database.
export async function saveHousehold(db: SQLiteDatabase, draft: OnboardingDraft) {
  const row = draftToRow(draft);

  await db.runAsync(INSERT_HOUSEHOLD, {
    $id: HOUSEHOLD_ID,
    $name: row.name,
    $adults: row.adults,
    $kids: row.kids,
    $pets: row.pets,
    $pet_types: row.pet_types,
    $has_medical_needs: row.has_medical_needs,
    $medical_notes: row.medical_notes,
    $home_type: row.home_type,
    $zip_code: row.zip_code,
    $county: row.county,
    $nws_zone_id: row.nws_zone_id,
    $nws_office: row.nws_office,
    $latitude: row.latitude,
    $longitude: row.longitude,
    $place: row.place,
    $created_at: row.created_at,
    $updated_at: row.updated_at,
  });
}

// Saves an edit made from Settings. UPDATE rather than INSERT OR REPLACE so created_at
// survives — replacing the row would stamp it with today's date on every edit.
export async function updateHousehold(db: SQLiteDatabase, values: HouseholdEdit) {
  const row = draftToRow(values);

  await db.runAsync(UPDATE_HOUSEHOLD, {
    $id: HOUSEHOLD_ID,
    $name: row.name,
    $adults: row.adults,
    $kids: row.kids,
    $pets: row.pets,
    $has_medical_needs: row.has_medical_needs,
    $medical_notes: row.medical_notes,
    $home_type: row.home_type,
    $zip_code: row.zip_code,
    $county: row.county,
    $nws_zone_id: row.nws_zone_id,
    $nws_office: row.nws_office,
    $latitude: row.latitude,
    $longitude: row.longitude,
    $place: row.place,
    $updated_at: row.updated_at,
  });
}
