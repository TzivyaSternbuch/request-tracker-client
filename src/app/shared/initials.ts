/** The first letter of the first two words, uppercase: "Dana Katz" → "DK", "dana" → "D". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
