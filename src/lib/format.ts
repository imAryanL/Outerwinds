// Small text helpers shared by screens and by the printable plan. No React, no database.

// "1 adult", "3 pets". Callers drop zero counts rather than printing "0 kids".
export function countLabel(count: number, word: string) {
  if (count === 1) {
    return '1 ' + word;
  }

  return count + ' ' + word + 's';
}
