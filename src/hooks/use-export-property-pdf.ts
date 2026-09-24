// The Export-as-PDF action on the Storm Property Record. Same shape as
// use-export-document-pdf.ts, minus the Pro check: only Pro users can have areas to
// export, and a failed purchase check must never trap someone's record on the phone.

import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { sharePropertyPdf } from '@/lib/property-pdf';

export function useExportPropertyPdf() {
  const db = useSQLiteContext();

  // Resizing every photo takes a moment, so the row can say so and a second tap can't
  // start a second build.
  const [working, setWorking] = useState(false);

  async function exportPdf() {
    if (working) {
      return;
    }

    setWorking(true);
    try {
      const shared = await sharePropertyPdf(db);
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
