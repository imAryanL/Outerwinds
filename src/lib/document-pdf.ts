// Turns one vault document's photos into a single PDF and hands it to the share sheet.
// Same shape as prep-plan-pdf.ts; the extra step here is resizing and base64-inlining
// every photo first (document-image.ts), since printed HTML can't load them by file
// path at all.

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDocument, getPhotoUris } from '@/db/documents';
import { photoToPdfDataUri } from '@/lib/document-image';
import { documentPdfHtml } from '@/lib/document-pdf-html';

// Filesystem-unsafe characters stripped so the document's own title can be the filename.
function fileName(title: string) {
  const safe = title.replace(/[/\\:*?"<>|]/g, '').trim();
  return `${safe === '' ? 'Document' : safe}.pdf`;
}

/**
 * Builds the PDF and returns where it landed, plus the title for the share sheet's
 * dialog. Throws if the document is missing or printing fails, so callers can tell
 * the user rather than leaving a button that silently does nothing.
 */
export async function createDocumentPdf(
  db: SQLiteDatabase,
  documentId: number
): Promise<{ uri: string; title: string }> {
  const doc = await getDocument(db, documentId);
  if (doc === null) {
    throw new Error('Document not found');
  }

  const photoUris = getPhotoUris(doc);
  const dataUris = [];
  for (const uri of photoUris) {
    dataUris.push(await photoToPdfDataUri(uri));
  }

  const { uri } = await Print.printToFileAsync({
    html: documentPdfHtml(doc, dataUris),
    base64: false,
  });

  // Cache, not the vault: this is a file the user exports, not one the app keeps.
  try {
    const target = new File(Paths.cache, fileName(doc.title));

    if (target.exists) {
      target.delete();
    }

    new File(uri).move(target);
    return { uri: target.uri, title: doc.title };
  } catch {
    // The rename is cosmetic — if it fails, the PDF itself is still fine.
    return { uri, title: doc.title };
  }
}

/**
 * Generates the PDF and opens the share sheet. Returns false when the platform has
 * no share sheet at all, so the caller can say so instead of appearing to do nothing.
 */
export async function shareDocumentPdf(db: SQLiteDatabase, documentId: number): Promise<boolean> {
  const { uri, title } = await createDocumentPdf(db, documentId);

  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: title,
  });

  return true;
}
