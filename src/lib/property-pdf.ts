// Turns the whole Storm Property Record into one PDF and hands it to the share sheet.
// Same shape as document-pdf.ts: every photo is resized and base64-inlined first.

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { vaultPhotoUri } from '@/db/documents';
import { getAreas } from '@/db/property';
import { photoToPdfDataUri } from '@/lib/document-image';
import { propertyPdfHtml, type AreaPhotos } from '@/lib/property-pdf-html';

// 'Storm property record Sep 24 2026.pdf', not expo-print's random id.
function fileName(date: Date) {
  const stamp = date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(/,/g, '');

  return `Storm property record ${stamp}.pdf`;
}

// A missing file prints as "No photo" instead of failing the whole export.
async function toDataUri(photo: string | null) {
  if (photo === null) {
    return null;
  }
  try {
    return await photoToPdfDataUri(vaultPhotoUri(photo));
  } catch {
    return null;
  }
}

/**
 * Builds the PDF and opens the share sheet. Returns false when the platform has no share
 * sheet, so the caller can say so. Throws if printing fails.
 */
export async function sharePropertyPdf(db: SQLiteDatabase): Promise<boolean> {
  const areas = await getAreas(db);

  const photos: AreaPhotos[] = [];
  for (const area of areas) {
    photos.push({
      before: await toDataUri(area.before_photo),
      after: await toDataUri(area.after_photo),
    });
  }

  const now = new Date();
  const { uri } = await Print.printToFileAsync({
    html: propertyPdfHtml(areas, photos, now),
    base64: false,
  });

  // Cache, not the vault: this is a file the user exports, not one the app keeps.
  let shareUri = uri;
  try {
    const target = new File(Paths.cache, fileName(now));
    if (target.exists) {
      target.delete();
    }
    new File(uri).move(target);
    shareUri = target.uri;
  } catch {
    // The rename is cosmetic — the PDF itself is still fine.
  }

  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }

  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Storm property record',
  });
  return true;
}
