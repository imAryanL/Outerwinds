// The Print-my-plan action, shared by the checklist and Settings. Each screen draws its
// own row; this owns the Pro check, the work, and what to say when either fails.

import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { isPro } from '@/lib/pro';
import { sharePrepPlanPdf } from '@/lib/prep-plan-pdf';

export function usePrintPlan() {
  const db = useSQLiteContext();

  // Building the PDF takes a moment on a long checklist, so the row can say so and
  // a second tap can't start a second build.
  const [working, setWorking] = useState(false);

  async function print() {
    if (working) {
      return;
    }

    if (!(await isPro(db))) {
      // Stands in for the real paywall until RevenueCat exists.
      Alert.alert(
        'A Pro feature',
        'Unlock Pro to print your plan, with what you still need and what is due for replacing.',
        [{ text: 'OK' }]
      );
      return;
    }

    setWorking(true);
    try {
      const shared = await sharePrepPlanPdf(db);
      if (!shared) {
        Alert.alert('Sharing unavailable', 'This device has no way to share a file.');
      }
    } catch {
      Alert.alert('Could not make the plan', 'Something went wrong. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  return { working, print };
}
