/**
 * ChaCha20 (RFC 8439) keyed by a 256-bit seed. A 32-bit PRNG would let a player brute-force the
 * seed from their opening hand and predict every draw, so the server seeds this with 8 crypto words.
 */
export interface RngState {
  key: number[]; // 8 unsigned 32-bit words
  counter: number; // block counter
}

const rotl = (v: number, n: number): number => (v << n) | (v >>> (32 - n));

function quarterRound(x: number[], a: number, b: number, c: number, d: number): void {
  x[a] = (x[a]! + x[b]!) | 0; x[d] = rotl(x[d]! ^ x[a]!, 16);
  x[c] = (x[c]! + x[d]!) | 0; x[b] = rotl(x[b]! ^ x[c]!, 12);
  x[a] = (x[a]! + x[b]!) | 0; x[d] = rotl(x[d]! ^ x[a]!, 8);
  x[c] = (x[c]! + x[d]!) | 0; x[b] = rotl(x[b]! ^ x[c]!, 7);
}

/** One ChaCha20 block: 16 unsigned 32-bit words. */
export function chachaBlock(key: readonly number[], counter: number, nonce: readonly number[] = [0, 0, 0]): number[] {
  const init = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574, ...key, counter >>> 0, ...nonce].map((v) => v | 0);
  const x = [...init];
  for (let i = 0; i < 10; i++) {
    quarterRound(x, 0, 4, 8, 12);
    quarterRound(x, 1, 5, 9, 13);
    quarterRound(x, 2, 6, 10, 14);
    quarterRound(x, 3, 7, 11, 15);
    quarterRound(x, 0, 5, 10, 15);
    quarterRound(x, 1, 6, 11, 12);
    quarterRound(x, 2, 7, 8, 13);
    quarterRound(x, 3, 4, 9, 14);
  }
  return x.map((v, i) => (v + init[i]!) >>> 0);
}

/** A number seed is for tests and replays; production passes 8 crypto-random 32-bit words. */
export function rngFromSeed(seed: number | readonly number[]): RngState {
  if (typeof seed === 'number') return { key: [seed >>> 0, 0, 0, 0, 0, 0, 0, 0], counter: 0 };
  if (seed.length !== 8) throw new Error('rng seed must be 8 x 32-bit words');
  return { key: seed.map((w) => w >>> 0), counter: 0 };
}

/** Returns [float in [0,1) with 53 random bits, nextState]. */
export function nextRandom(state: RngState): [number, RngState] {
  const [hi, lo] = chachaBlock(state.key, state.counter);
  const r = (hi! * 2 ** 21 + (lo! >>> 11)) / 2 ** 53;
  return [r, { key: state.key, counter: state.counter + 1 }];
}

/** Fisher–Yates shuffle driven by the seeded generator. Returns [shuffled copy, nextState]. */
export function shuffle<T>(items: readonly T[], state: RngState): [T[], RngState] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, ns] = nextRandom(s);
    s = ns;
    const j = Math.floor(r * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return [out, s];
}
