// Notification permission (same on iOS and Android) and registering this phone for storm pushes.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getRenewingDocuments } from '@/db/documents';
import { getHousehold } from '@/db/household';
import { getExpiringSupplies } from '@/db/inventory';
import { scheduleExpiryReminders, scheduleRenewalReminders } from '@/lib/reminders';

// Same reason as nws.ts: fetch never gives up on its own.
const TIMEOUT_MS = 8000;

// Without this, a notification that arrives while the app is open shows nothing at all.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 13+ won't show its popup until the app has at least one notification channel.
export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Storm alerts and reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  return Notifications.requestPermissionsAsync();
}

// Tells our server which zone this phone wants storm pushes for. zoneId null = stop sending
// (notifications turned off). Returns false on any failure — push is extra, so the app
// carries on and the caller can retry on the next launch.
export async function registerPushToken(zoneId: string | null): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      return false;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const response = await fetch(
      process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1/register-device',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
        },
        body: JSON.stringify({ token, zoneId }),
        signal: controller.signal,
      },
    );

    return response.ok;
  } catch {
    // No signal, no push entitlement in this build, or the timeout above.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Makes the server match the phone: the saved zone if notifications are on, nothing if they
// are off. Reads both fresh each time, so it fixes every drift at once — a zone that
// landed late, an edited ZIP, permission switched in the phone's Settings.
export async function syncPushRegistration(db: SQLiteDatabase) {
  const household = await getHousehold(db);
  if (household === null) {
    return;
  }

  const permission = await Notifications.getPermissionsAsync();
  await registerPushToken(permission.granted ? household.nws_zone_id : null);
}

// For "Delete all my data". False means the server couldn't be reached, and nothing was cancelled.
export async function stopAllNotifications(): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();

  // Only a phone that allowed notifications can be on the server's list.
  if (permission.granted) {
    const removed = await registerPushToken(null);
    if (!removed) {
      return false;
    }
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  return true;
}

// Reminders are only queued when a date is saved, and skipped without permission. So dates
// saved before notifications were turned on never got theirs. Fixed ids make re-queueing
// everything safe to repeat.
export async function rescheduleAllReminders(db: SQLiteDatabase) {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    return;
  }

  for (const supply of await getExpiringSupplies(db)) {
    await scheduleExpiryReminders(supply.id, supply.name, supply.expires_at);
  }

  for (const doc of await getRenewingDocuments(db)) {
    await scheduleRenewalReminders(doc.id, doc.title, doc.renews_at);
  }
}
