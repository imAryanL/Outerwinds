// The Export-as-PDF action on a saved document. Owns the Pro check, the work, and
// what to say when either fails — same shape as use-print-plan.ts.

import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { shareDocumentPdf } from '@/lib/document-pdf';
import { isPro } from '@/lib/pro';

export function useExportDocumentPdf(documentId: number) {
  const db = useSQLiteContext();

  // Resizing and base64-encoding several photos takes a moment, so the row can say
  // so and a second tap can't start a second build.
  const [working, setWorking] = useState(false);

  async function exportPdf() {
    if (working) {
      return;
    }

    if (!(await isPro(db))) {
      // Stands in for the real paywall until RevenueCat exists.
      Alert.alert(
        'A Pro feature',
        'Unlock Pro to export this document as a single PDF.',
        [{ text: 'OK' }]
      );
      return;
    }

    setWorking(true);
    try {
      const shared = await shareDocumentPdf(db, documentId);
      if (!shared) {
        Alert.alert('Sharing unavailable', 'This device has no way to share a file.');
      }
    } catch {
      Alert.alert('Could not export', 'Something went wrong. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  return { working, exportPdf };
}
