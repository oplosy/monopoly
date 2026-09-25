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

/**
 * Lays one player's tableau into its zone (spec §5.2): groups in a row, then the bank. When they do not fit,
 * the row tightens, wraps onto a second row where the zone is tall enough, then groups overlap (each keeps
 * half its width showing); the cards shrink only as a last resort, never below `floorW`.
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
  const cascade = picking ? 0.5 : 0.3;
  const bankStep = picking ? 0.3 : 0.14;
  const slots = Math.max(1, groups.length); // an empty tableau still shows its "No properties yet" slot
  const items = slots + 1; // the bank always takes a slot, even empty
  const deepest = Math.max(1, ...groups);
  /** Width of `n` items with `gap`, counting the bank's spread when it is among them, in card widths. */
  const rowWidth = (n: number, gap: number, withBank: boolean) => n + (withBank ? Math.max(0, bank - 1) * bankStep : 0) + (n - 1) * gap;
  const height = (rows: number) => rows * (CARD_RATIO + (deepest - 1) * cascade) + (rows - 1) * ROW_GAP;
  const attempt = (w: number): Omit<TableauFit, 'cardW' | 'overflow'> | null => {
    if (height(1) * w > zone.h) return null;
    for (const gap of [GAP.loose, GAP.tight]) if (rowWidth(items, gap, true) * w <= zone.w) return { cascade, gap, bankStep, rows: 1 };
    if (items > 2 && height(2) * w <= zone.h) {
      const first = Math.ceil(items / 2);
      const widest = Math.max(rowWidth(first, GAP.tight, false), rowWidth(items - first, GAP.tight, true));
      if (widest * w <= zone.w) return { cascade, gap: GAP.tight, bankStep, rows: 2 };
    }
    // Overlap: the gap that makes one row fit, no tighter than each group showing half its width.
    const spread = 1 + Math.max(0, bank - 1) * bankStep;
    const gap = (zone.w / w - slots - spread) / (items - 1);
    if (gap >= GAP.overlap) return { cascade, gap: Math.min(gap, GAP.tight), bankStep, rows: 1 };
    return null;
  };
  for (let w = cardW; w >= floorW; w -= 1) {
    const fit = attempt(w);
    if (fit) return { cardW: w, ...fit, overflow: false };
  }
  return { cardW: floorW, cascade, gap: GAP.overlap, bankStep, rows: 1, overflow: true };
}
