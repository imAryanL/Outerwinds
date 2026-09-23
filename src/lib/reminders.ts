// The 30- and 7-day heads-up before a date. Shared by supplies and documents.

import * as Notifications from 'expo-notifications';

export type ReminderText = {
  thirtyDayTitle: string;
  thirtyDayBody: string;
  sevenDayTitle: string;
  sevenDayBody: string;
};

// The prefix keeps supply ('expiry') and document ('renewal') ids apart.
// ⚠️ Never change an existing prefix — reminders already on phones use it.
export async function cancelReminders(prefix: string, id: number) {
  await Notifications.cancelScheduledNotificationAsync(`${prefix}-30-${id}`);
  await Notifications.cancelScheduledNotificationAsync(`${prefix}-7-${id}`);
}

// Fixed ids, so cancelling first is always safe — an unknown id is a no-op.
export async function scheduleReminders(
  prefix: string,
  id: number,
  dueAt: string | null,
  text: ReminderText
) {
  await cancelReminders(prefix, id);

  if (dueAt === null) {
    return;
  }

  // The date still saves without permission; only the reminders need it.
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    return;
  }

  const due = new Date(dueAt);
  const now = new Date();

  const thirtyDaysBefore = new Date(due);
  thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);

  const sevenDaysBefore = new Date(due);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);

  // Skip a reminder that would already be in the past — it would just fire immediately.
  if (thirtyDaysBefore > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${prefix}-30-${id}`,
      content: { title: text.thirtyDayTitle, body: text.thirtyDayBody },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: thirtyDaysBefore },
    });
  }

  if (sevenDaysBefore > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${prefix}-7-${id}`,
      content: { title: text.sevenDayTitle, body: text.sevenDayBody },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: sevenDaysBefore },
    });
  }
}
