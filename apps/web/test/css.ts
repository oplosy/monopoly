import { readFileSync } from 'node:fs';

/** A stylesheet's text without comments. */
export function readCss(url: URL): string {
  return readFileSync(url, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The bodies of every block opened by `header`, and the text outside them. */
export function split(text: string, header: string): { inside: string; outside: string } {
  let inside = '';
  let outside = '';
  let at = 0;
  for (;;) {
    const start = text.indexOf(header, at);
    if (start < 0) return { inside, outside: outside + text.slice(at) };
    outside += text.slice(at, start);
    const open = text.indexOf('{', start);
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) break;
    }
    inside += text.slice(open + 1, i);
    at = i + 1;
  }
}

/** The body of the first rule whose selector is exactly `selector`. */
export function rule(text: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? '';
}
