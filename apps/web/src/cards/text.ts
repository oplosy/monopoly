/** Greedy word wrap by character count (SVG has no text flow). Over-long words get their own line. */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Keeps generated SVG coordinates short and stable. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Character budgets per text box (checked against every card's text by tests). */
export const NAME_WRAP = 14;
export const TITLE_WRAP = 13;
export const EFFECT_WRAP = 28;
export const RENT_WRAP = 30;
