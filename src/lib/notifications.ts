// Asks for notification permission the same way on iOS and Android.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Android 13+ won't show its popup until the app has at least one notification channel.
export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  return Notifications.requestPermissionsAsync();
}
