import { readFileSync } from 'node:fs';

/** A stylesheet's text without comments. */
export function readCss(url: URL): string {
  return readFileSync(url, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The index of the brace closing the one opened at `open`. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return text.length;
}

/** Every style rule, also inside @media and @supports; @keyframes and @property are skipped. */
export function rules(text: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  let at = 0;
  for (;;) {
    const open = text.indexOf('{', at);
    if (open < 0) return out;
    const header = text.slice(at, open).trim();
    const end = closing(text, open);
    const body = text.slice(open + 1, end);
    if (header.startsWith('@media') || header.startsWith('@supports')) out.push(...rules(body));
    else if (!header.startsWith('@')) out.push({ selector: header, body });
    at = end + 1;
  }
}

/** The body of the first rule whose selector is exactly `selector` ('' if none). */
export function rule(text: string, selector: string): string {
  return rules(text).find((r) => r.selector === selector)?.body ?? '';
}
