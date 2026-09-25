import { CARD_RATIO } from './layout';

export interface TableauFit {
  /** Card width in plane px. */
  cardW: number;
  /** How much of each card behind shows in a group, in card widths. */
  cascade: number;
  /** Space between groups in card widths; negative when groups overlap. */
  gap: number;
  /** How far each bank note lies from the one below, in card widths. */
  bankStep: number;
  rows: 1 | 2;
  /** True when even the floor size does not fit: the tableau spills over its zone. */
  overflow: boolean;
}

/** The loosest gap between groups, the tightest before they overlap, and the most they overlap (each keeps half showing). */
const GAP = { loose: 0.18, tight: 0.08, overlap: -0.5 } as const;
/** Space between two rows, in card widths. */
const ROW_GAP = 0.12;

/** Each card behind shows at least its colour band: this much of a card width. */
const BAND = 0.3;

/**
 * Lays one player's tableau into its zone (spec §5.2): groups in a row, then the bank. A stack too tall for the
 * zone tightens its fan first (never below the colour band). A row too wide tightens, wraps onto a second row
 * where the zone is tall enough, then groups overlap (each keeps half its width showing); the cards shrink only
 * as a last resort, never below `floorW`. What still does not fit spills over the zone, flagged `overflow`, with
 * the spacing its width allows.
 * `groups` holds each group's card count (none: the "No properties yet" slot, card-sized, takes a group's place);
 * `picking` fans groups and the bank out so each card is easy to hit.
 */
export function fitTableau(
  zone: { w: number; h: number },
  groups: readonly number[],
  bank: number,
  cardW: number,
  floorW: number,
  picking = false,
): TableauFit {
  const fanned = picking ? 0.5 : BAND;
  const bankStep = picking ? 0.3 : 0.14;
  const slots = Math.max(1, groups.length); // an empty tableau still shows its "No properties yet" slot
  const items = slots + 1; // the bank always takes a slot, even empty
  const deepest = Math.max(1, ...groups);
  const spread = 1 + Math.max(0, bank - 1) * bankStep;
  /** Width of `n` items with `gap`, counting the bank's spread when it is among them, in card widths. */
  const rowWidth = (n: number, gap: number, withBank: boolean) => n + (withBank ? spread - 1 : 0) + (n - 1) * gap;
  /** The loosest cascade (≤ `fanned`, ≥ the band) whose `rows` rows fit the zone's height at card width `w`; null if none. */
  const cascadeFor = (w: number, rows: number): number | null => {
    if (deepest === 1) return rows * CARD_RATIO * w + (rows - 1) * ROW_GAP * w <= zone.h ? fanned : null;
    const room = (zone.h / w - (rows - 1) * ROW_GAP) / rows - CARD_RATIO;
    const c = Math.min(fanned, Math.floor((room / (deepest - 1)) * 100) / 100);
    return c >= BAND ? c : null;
  };
  /** The row's gap at width `w`: loose, tight, or overlapping down to half of each group; null if even that is too wide. */
  const gapFor = (w: number): number | null => {
    for (const gap of [GAP.loose, GAP.tight]) if (rowWidth(items, gap, true) * w <= zone.w) return gap;
    const gap = (zone.w / w - slots - spread) / (items - 1);
    return gap >= GAP.overlap ? Math.min(gap, GAP.tight) : null;
  };
  for (let w = cardW; w >= floorW; w -= 1) {
    const cascade = cascadeFor(w, 1);
    if (cascade === null) continue;
    for (const gap of [GAP.loose, GAP.tight]) if (rowWidth(items, gap, true) * w <= zone.w) return { cardW: w, cascade, gap, bankStep, rows: 1, overflow: false };
    const two = items > 2 ? cascadeFor(w, 2) : null;
    if (two !== null) {
      const first = Math.ceil(items / 2);
      if (Math.max(rowWidth(first, GAP.tight, false), rowWidth(items - first, GAP.tight, true)) * w <= zone.w)
        return { cardW: w, cascade: two, gap: GAP.tight, bankStep, rows: 2, overflow: false };
    }
    const gap = gapFor(w);
    if (gap !== null) return { cardW: w, cascade, gap, bankStep, rows: 1, overflow: false };
  }
  // Nothing fits even at the floor: the tallest the band allows, the spacing the width allows, and a spill.
  const gap = gapFor(floorW) ?? GAP.overlap;
  return { cardW: floorW, cascade: cascadeFor(floorW, 1) ?? BAND, gap, bankStep, rows: 1, overflow: true };
}
