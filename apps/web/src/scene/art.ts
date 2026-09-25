/** The painted scene layers (spec 2026-09-25 §3.1), served from public/scene/. */
export const SCENE_ART = {
  plateLandscape: 'bg-landscape.webp',
  platePortrait: 'bg-portrait.webp',
  table: 'table-top.webp',
  cloth: 'cloth.webp',
  dapple: 'dapple.webp',
  caustics: 'caustics.webp',
  leavesLeft: 'leaves-left.webp',
  leavesTop: 'leaves-top.webp',
  butterfly: 'butterfly.webp',
  dishMelon: 'dish-melon.webp',
  dishBerries: 'dish-berries.webp',
  dishChips: 'dish-chips.webp',
} as const;

/** The URL of a scene file, under the app's base path. */
export function sceneUrl(file: string): string {
  return `${import.meta.env.BASE_URL}scene/${file}`;
}

/** Taller than wide: the portrait plate, its box and its lake. One query for all three, so they switch together. */
export const PORTRAIT = '(orientation: portrait)';
