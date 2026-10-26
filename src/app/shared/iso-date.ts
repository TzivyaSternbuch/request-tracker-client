// A calendar day as picked in the UI ↔ `yyyy-MM-dd`. Local calendar fields on both sides, so the day the user picked
// is the day sent, whatever the browser's time zone.

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Expects text already validated as `yyyy-MM-dd` (the URL parser drops anything else). */
export function fromIsoDate(text: string | null): Date | null {
  if (!text) return null;
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day);
}
