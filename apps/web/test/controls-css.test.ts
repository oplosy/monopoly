import { describe, expect, it } from 'vitest';
import { readCss, rule } from './css';

const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
const motion = readCss(new URL('../src/motion/motion.css', import.meta.url));

describe('a spent hand and a due End turn (spec 2026-09-25-table-controls D2, D3)', () => {
  it('darkens a hand card that cannot be played, never making it see-through', () => {
    const dim = rule(table, '.hand-fan .table-card.tone-dim');
    expect(dim).toMatch(/opacity:\s*1\b/);
    expect(dim).toMatch(/filter:\s*brightness\(0\.5\)\s*saturate\(0\.55\)/);
  });

  it('lights End turn up once no plays are left, and lets it breathe only with animations on', () => {
    expect(rule(table, '.end-turn.is-due')).toMatch(/box-shadow:[^;]*var\(--gold\)/);
    expect(rule(motion, ":root[data-motion='on'] .end-turn.is-due")).toMatch(/animation:\s*due-breathe/);
  });
});

describe('a round End turn with its clock (D5)', () => {
  it('is a round button, larger on wide screens than on phones', () => {
    const end = rule(table, '.end-turn');
    expect(end).toMatch(/--end:\s*112px/);
    expect(end).toMatch(/width:\s*var\(--end\)/);
    expect(rule(table, '.end-turn-button')).toMatch(/border-radius:\s*50%/);
    expect(table).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.end-turn \{[^}]*--end:\s*76px/);
  });

  it('rings itself with my clock, red in the last seconds', () => {
    expect(rule(table, '.end-turn-ring')).toMatch(/conic-gradient\(var\(--ring-color\) calc\(var\(--p\) \* 1turn\)/);
    expect(rule(table, '.end-turn.is-low')).toMatch(/--ring-color:\s*#d93a2b/);
  });
});
