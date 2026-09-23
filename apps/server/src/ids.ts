import { randomBytes, randomInt } from 'node:crypto';

/** No 0/O, 1/I/L so codes can be read aloud and typed. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function roomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

export function sessionToken(): string {
  return randomBytes(16).toString('hex');
}

/** 8 x 32-bit words for the engine's ChaCha20 rng. */
export function gameSeed(): number[] {
  const bytes = randomBytes(32);
  return Array.from({ length: 8 }, (_, i) => bytes.readUInt32LE(i * 4));
}
