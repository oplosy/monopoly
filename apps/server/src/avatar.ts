import { AVATAR_COUNT } from '@deal-city/protocol';

/** FNV-1a hash of a player id, so a seat's default character does not depend on join order alone. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The first free character, starting from the player's hash and wrapping around. */
export function defaultAvatar(playerId: string, taken: ReadonlySet<number>): number {
  const start = hash(playerId) % AVATAR_COUNT;
  for (let i = 0; i < AVATAR_COUNT; i++) {
    const avatar = (start + i) % AVATAR_COUNT;
    if (!taken.has(avatar)) return avatar;
  }
  // Unreachable while MAX_SEATS <= AVATAR_COUNT.
  return start;
}
