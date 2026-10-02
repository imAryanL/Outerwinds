// The app's four haptic feels, so screens never import expo-haptics directly.
import * as Haptics from 'expo-haptics';

// The calls return promises; nothing waits on a buzz, so they're fired and forgotten.

// Ordinary buttons.
export function tap(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

// Chips, radios, checkboxes, steppers: a choice changed.
export function tick(): void {
  void Haptics.selectionAsync();
}

// A save or a finished flow.
export function success(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

// Destructive actions, like delete.
export function warn(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
