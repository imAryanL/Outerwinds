// The document vault. Photos are normalized and copied into a folder the app owns, so
// they survive the original being deleted from the camera roll.

import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { normalizePhotoForVault } from '@/lib/document-image';

// photo_uris is a JSON list — read it with getPhotoUris, never JSON.parse directly.
export type DocumentRow = {
  id: number;
  title: string;
  category: string;
  photo_uris: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

// The app's folder path changes on every App Store update, so only the file name
// is trusted. Also handles older rows that saved the full path.
function vaultPhotoUri(saved: string) {
  const parts = saved.split('/');
  const fileName = parts[parts.length - 1];
  return new File(Paths.document, 'vault', fileName).uri;
}

// Every photo in a document, as paths that work right now. Read photo_uris through this.
export function getPhotoUris(doc: DocumentRow) {
  const saved: string[] = JSON.parse(doc.photo_uris);
  const uris = [];
  for (const entry of saved) {
    uris.push(vaultPhotoUri(entry));
  }
  return uris;
}

// The index keeps two photos saved in the same millisecond from sharing a name.
// Always .jpg — normalizePhotoForVault re-encodes every photo.
async function copyIntoVault(sourceUri: string, index: number) {
  const vaultDir = new Directory(Paths.document, 'vault');
  vaultDir.create({ idempotent: true });

  const normalizedUri = await normalizePhotoForVault(sourceUri);
  const destFile = new File(vaultDir, `${Date.now()}-${index}.jpg`);

  await new File(normalizedUri).move(destFile);

  // Just the name, never the full path — see vaultPhotoUri.
  return destFile.name;
}

/**
 * Copies every photo into the vault, then writes one row pointing at the copies.
 */
export async function saveDocument(
  db: SQLiteDatabase,
  title: string,
  category: string,
  sourceUris: string[],
  notes: string
) {
  const fileNames = [];
  for (let i = 0; i < sourceUris.length; i++) {
    fileNames.push(await copyIntoVault(sourceUris[i], i));
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO documents (title, category, photo_uris, notes, created_at, updated_at)
     VALUES ($title, $category, $photo_uris, $notes, $created_at, $updated_at)`,
    {
      $title: title,
      $category: category,
      $photo_uris: JSON.stringify(fileNames),
      $notes: notes,
      $created_at: now,
      $updated_at: now,
    }
  );
}

/**
 * Every saved document. The screen groups these by category.
 */
export async function getDocuments(db: SQLiteDatabase) {
  return db.getAllAsync<DocumentRow>('SELECT * FROM documents ORDER BY id');
}

/**
 * How many categories have at least one document. Feeds Home's Documents bar.
 */
export async function getCoveredCategoryCount(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ covered: number }>(
    'SELECT COUNT(DISTINCT category) AS covered FROM documents'
  );
  return row?.covered ?? 0;
}

/**
 * One document, for the detail screen. Null when the id doesn't exist.
 */
export async function getDocument(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<DocumentRow>('SELECT * FROM documents WHERE id = $id', { $id: id });
}

/**
 * Renames a document.
 */
export async function updateDocumentTitle(db: SQLiteDatabase, id: number, title: string) {
  await db.runAsync('UPDATE documents SET title = $title, updated_at = $updated_at WHERE id = $id', {
    $title: title,
    $updated_at: new Date().toISOString(),
    $id: id,
  });
}

/**
 * Saves the free-text notes field. Same shape as updateDocumentTitle.
 */
export async function updateDocumentNotes(db: SQLiteDatabase, id: number, notes: string) {
  await db.runAsync('UPDATE documents SET notes = $notes, updated_at = $updated_at WHERE id = $id', {
    $notes: notes,
    $updated_at: new Date().toISOString(),
    $id: id,
  });
}

/**
 * Deletes the row and its photo files. A missing file is skipped, not a blocker.
 */
export async function deleteDocument(db: SQLiteDatabase, id: number) {
  const doc = await getDocument(db, id);
  if (doc === null) {
    return;
  }

  const uris = getPhotoUris(doc);
  for (const uri of uris) {
    try {
      new File(uri).delete();
    } catch {
      // Already gone.
    }
  }

  await db.runAsync('DELETE FROM documents WHERE id = $id', { $id: id });
}
