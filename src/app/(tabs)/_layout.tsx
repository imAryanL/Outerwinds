// Layout for the four main tabs, and the first-launch gate.
// The tabs sit inside a stack so onboarding can open full-screen with no tab bar.

import * as Notifications from 'expo-notifications';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { hasHousehold } from '@/db/household';
import { rescheduleAllReminders, syncPushRegistration } from '@/lib/notifications';

// Three answers, not a boolean — guessing while the database replies flashes the wrong screen.
type GateStatus = 'checking' | 'onboarding' | 'ready';

export default function TabsLayout() {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<GateStatus>('checking');

  useEffect(() => {
    async function check() {
      const exists = await hasHousehold(db);
      setStatus(exists ? 'ready' : 'onboarding');
    }

    check();
  }, [db]);

  // On launch and every return to the app, so a permission changed in the phone's Settings
  // reaches the server and the reminders the next time the app opens.
  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    function syncNotifications() {
      syncPushRegistration(db);
      rescheduleAllReminders(db);
    }

    syncNotifications();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncNotifications();
      }
    });

    return () => subscription.remove();
  }, [db, status]);

  // The last notification the user tapped, including the one that launched the app.
  const lastTap = Notifications.useLastNotificationResponse();

  // Storm pushes carry data.url. Only /alerts is followed, so a payload can't send the app
  // anywhere else. Waits for 'ready' so the tabs exist to open on.
  useEffect(() => {
    if (status !== 'ready' || !lastTap) {
      return;
    }
    if (lastTap.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }

    if (lastTap.notification.request.content.data?.url === '/alerts') {
      router.push('/alerts');
    }
  }, [lastTap, status]);

  // The splash usually covers this frame, but it leaves on a timer that knows nothing
  // about the database, so this has to be correct on its own.
  if (status === 'checking') {
    return null;
  }

  if (status === 'onboarding') {
    return <Redirect href="/onboarding/welcome" />;
  }

  return <AppTabs />;
}
