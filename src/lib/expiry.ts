// How close a supply's replace-by date is, and the words for it. Pure date math.
// The column is still expires_at; the user-facing word is "replace", per ready.gov.

// JS can't subtract two dates into days, so the gap goes through milliseconds.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Midnight at the start of the same calendar day, in the phone's time zone.
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Negative once the date has passed. Counts calendar days, so a replace date of today reads 0
// whatever the time of day. Rounded only because a daylight-saving day isn't exactly 24 hours.
export function daysUntil(expiresAt: string, today: Date): number {
  const gap = startOfDay(new Date(expiresAt)).getTime() - startOfDay(today).getTime();
  return Math.round(gap / MS_PER_DAY);
}

// Also when the 30-day reminder fires, so the amber on screen matches the notification.
export function isExpiringSoon(daysLeft: number): boolean {
  return daysLeft <= 30;
}

export function expiryLabel(daysLeft: number): string {
  if (daysLeft > 1) {
    return `Replace in ${daysLeft} days`;
  }
  if (daysLeft === 1) {
    return 'Replace tomorrow';
  }
  if (daysLeft === 0) {
    return 'Replace today';
  }
  if (daysLeft === -1) {
    return 'Was due yesterday';
  }
  return `Was due ${-daysLeft} days ago`;
}
