/**
 * Seeded pseudo-random number generator (sfc32, seeded through splitmix32).
 *
 * Every random decision in the simulation (spread, recoil jitter, bot choices) draws from an Rng
 * so that a match is reproducible from its seed. Systems get independent streams via
 * `deriveSeed(matchSeed, 'label')`, so adding a draw in one system never shifts another's sequence.
 */
export class Rng {
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed: number) {
    this.reseed(seed);
  }

  reseed(seed: number): void {
    let s = seed >>> 0;
    s = splitmix32(s);
    this.a = s;
    s = splitmix32(s);
    this.b = s;
    s = splitmix32(s);
    this.c = s;
    s = splitmix32(s);
    this.d = s;
    // Warm up so that nearby seeds diverge immediately.
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  /** Uniform unsigned 32-bit integer. */
  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number {
    return min + Math.floor((maxExclusive - min) * this.next());
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Uniform float in [-1, 1). */
  signed(): number {
    return this.next() * 2 - 1;
  }

  /** Copies the generator state into `out` (for snapshots and replays). */
  getState(out: Uint32Array): Uint32Array {
    out[0] = this.a >>> 0;
    out[1] = this.b >>> 0;
    out[2] = this.c >>> 0;
    out[3] = this.d >>> 0;
    return out;
  }

  setState(state: Uint32Array): void {
    this.a = state[0] ?? 0;
    this.b = state[1] ?? 0;
    this.c = state[2] ?? 0;
    this.d = state[3] ?? 0;
  }
}

/** splitmix32 step: a well-mixed 32-bit hash used to expand seeds. */
export function splitmix32(x: number): number {
  let z = (x + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/** FNV-1a hash of a string, for turning stream labels into seed material. */
export function hashString(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seed for an independent named stream, e.g. deriveSeed(matchSeed, 'recoil:rifle'). */
export function deriveSeed(seed: number, label: string): number {
  return splitmix32((seed ^ hashString(label)) >>> 0);
}
