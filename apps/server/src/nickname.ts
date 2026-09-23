/** Trims, strips control/format characters, collapses whitespace; null unless 1-16 characters remain. */
export function sanitizeNickname(raw: string): string | null {
  const cleaned = raw.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  return cleaned.length >= 1 && cleaned.length <= 16 ? cleaned : null;
}
