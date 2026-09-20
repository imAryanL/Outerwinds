// Makes the printable plan into a real PDF and hands it to the share sheet.

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { buildPrepPlan } from '@/lib/prep-plan';
import { prepPlanHtml } from '@/lib/prep-plan-html';

// 'Storm plan Sep 20 2026.pdf' — expo-print names the file with a random id, which
// looks broken in a share sheet and in Files.
function fileName(date: Date) {
  const stamp = date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(/,/g, '');

  return `Storm plan ${stamp}.pdf`;
}

/**
 * Builds the PDF and returns where it landed. Throws if printing fails, so callers
 * can tell the user rather than leaving a button that silently does nothing.
 */
export async function createPrepPlanPdf(db: SQLiteDatabase): Promise<string> {
  const now = new Date();
  const plan = await buildPrepPlan(db, now);

  const { uri } = await Print.printToFileAsync({
    html: prepPlanHtml(plan),
    base64: false,
  });

  // Cache, not document: this is a file the user exports, not one the app keeps.
  // Same File/Paths API the document vault uses.
  try {
    const target = new File(Paths.cache, fileName(now));

    // Generating twice in one day would otherwise hit an existing file.
    if (target.exists) {
      target.delete();
    }

    new File(uri).move(target);
    return target.uri;
  } catch {
    // The rename is cosmetic — if it fails, the PDF itself is still fine.
    return uri;
  }
}

/**
 * Generates the plan and opens the share sheet. Returns false when the platform has
 * no share sheet at all, so the caller can say so instead of appearing to do nothing.
 */
export async function sharePrepPlanPdf(db: SQLiteDatabase): Promise<boolean> {
  const uri = await createPrepPlanPdf(db);

  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Your storm plan',
  });

  return true;
}
