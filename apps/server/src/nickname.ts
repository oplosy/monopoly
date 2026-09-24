const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * Strips control, format, private-use and unassigned characters, keeps at most two stacked
 * accents per letter, normalizes to NFC and collapses whitespace. Returns null unless 1–16
 * characters remain, counted as people see them (grapheme clusters), so emoji count as one.
 */
export function sanitizeNickname(raw: string): string | null {
  // Accents are capped in decomposed form, where each one is a separate mark, then recomposed.
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}]/gu, '')
    .replace(/(\p{M}{2})\p{M}+/gu, '$1')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
  const length = [...graphemes.segment(cleaned)].length;
  return length >= 1 && length <= 16 ? cleaned : null;
}
