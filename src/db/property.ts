// Storm Property Record (Pro) — one row per area, each with a Before and an After photo.

import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { copyIntoVault, vaultPhotoUri } from '@/db/documents';

// Photo columns hold a vault file name, or null until a photo is added.
export type AreaRow = {
  id: number;
  name: string;
  before_photo: string | null;
  before_taken_at: string | null;
  after_photo: string | null;
  after_taken_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

/**
 * One new row per picked area, all starting with no photos.
 */
export async function addAreas(db: SQLiteDatabase, names: string[]) {
  const now = new Date().toISOString();

  for (const name of names) {
    await db.runAsync(
      `INSERT INTO property_areas (name, created_at, updated_at)
       VALUES ($name, $created_at, $updated_at)`,
      {
        $name: name,
        $created_at: now,
        $updated_at: now,
      }
    );
  }
}

/**
 * Every area, oldest first.
 */
export async function getAreas(db: SQLiteDatabase) {
  return db.getAllAsync<AreaRow>('SELECT * FROM property_areas ORDER BY id');
}

/**
 * One area, for its own screen. Null when the id doesn't exist.
 */
export async function getArea(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<AreaRow>('SELECT * FROM property_areas WHERE id = $id', { $id: id });
}

/**
 * Saves a Before or After photo into the vault. Replacing one deletes the old file.
 */
export async function setAreaPhoto(
  db: SQLiteDatabase,
  id: number,
  slot: 'before' | 'after',
  sourceUri: string,
  takenAt: string
) {
  const area = await getArea(db, id);
  if (area === null) {
    return;
  }

  const fileName = await copyIntoVault(sourceUri, 0);
  const params = {
    $photo: fileName,
    $taken_at: takenAt,
    $updated_at: new Date().toISOString(),
    $id: id,
  };

  // A column name can't be a $placeholder, so each slot gets its own statement.
  let oldPhoto: string | null;
  if (slot === 'before') {
    oldPhoto = area.before_photo;
    await db.runAsync(
      `UPDATE property_areas
       SET before_photo = $photo, before_taken_at = $taken_at, updated_at = $updated_at
       WHERE id = $id`,
      params
    );
  } else {
    oldPhoto = area.after_photo;
    await db.runAsync(
      `UPDATE property_areas
       SET after_photo = $photo, after_taken_at = $taken_at, updated_at = $updated_at
       WHERE id = $id`,
      params
    );
  }

  // Only after the row points at the new file, so it never points at a deleted one.
  if (oldPhoto !== null) {
    try {
      new File(vaultPhotoUri(oldPhoto)).delete();
    } catch {
      // Already gone.
    }
  }
}

/**
 * Saves the free-text notes. Same shape as updateDocumentNotes.
 */
export async function updateAreaNotes(db: SQLiteDatabase, id: number, notes: string) {
  await db.runAsync('UPDATE property_areas SET notes = $notes, updated_at = $updated_at WHERE id = $id', {
    $notes: notes,
    $updated_at: new Date().toISOString(),
    $id: id,
  });
}

/**
 * Deletes the row, then both photo files. A missing file is skipped.
 */
export async function deleteArea(db: SQLiteDatabase, id: number) {
  const area = await getArea(db, id);
  if (area === null) {
    return;
  }

  // Row first, same reason as setAreaPhoto.
  await db.runAsync('DELETE FROM property_areas WHERE id = $id', { $id: id });

  const photos = [area.before_photo, area.after_photo];
  for (const photo of photos) {
    if (photo !== null) {
      try {
        new File(vaultPhotoUri(photo)).delete();
      } catch {
        // Already gone.
      }
    }
  }
}
