import { hashString } from '../../sim/core/rng';
import type { MovementTuning } from '../../sim/movement/MovementTuning';
import type { KeyValueStorage } from '../settings/Settings';

export const TUNING_STORAGE_KEY = 'riftline.tuning.v1';

/** Identifies a set of defaults, so overrides made against older defaults are discarded. */
export function tuningFingerprint(defaults: MovementTuning): string {
  return hashString(JSON.stringify(defaults)).toString(16);
}

/**
 * Live movement tuning overrides, persisted so a tuning session survives reloads. Overrides are
 * stored with a fingerprint of the defaults they were made against: once the shipped defaults
 * change, stale overrides are dropped instead of silently masking the new values.
 */
export class TuningStore {
  private values: MovementTuning;

  constructor(
    private readonly storage: KeyValueStorage | null,
    readonly defaults: Readonly<MovementTuning>,
  ) {
    this.values = this.load();
  }

  get(): Readonly<MovementTuning> {
    return this.values;
  }

  set(key: keyof MovementTuning, value: number): void {
    if (!Number.isFinite(value)) return;
    this.values = { ...this.values, [key]: value };
    this.save();
  }

  reset(key?: keyof MovementTuning): void {
    this.values = key ? { ...this.values, [key]: this.defaults[key] } : { ...this.defaults };
    this.save();
  }

  /** Keys whose value differs from the shipped default. */
  changedKeys(): (keyof MovementTuning)[] {
    return (Object.keys(this.defaults) as (keyof MovementTuning)[]).filter(
      (k) => this.values[k] !== this.defaults[k],
    );
  }

  /** The full current tuning as JSON, ready to paste into src/data/movement.ts. */
  toJson(): string {
    return JSON.stringify(this.values, null, 2);
  }

  private load(): MovementTuning {
    const values = { ...this.defaults };
    try {
      const text = this.storage?.getItem(TUNING_STORAGE_KEY);
      if (!text) return values;
      const saved = JSON.parse(text) as { base?: unknown; values?: Record<string, unknown> };
      if (saved.base !== tuningFingerprint(this.defaults) || !saved.values) return values;
      for (const key of Object.keys(values) as (keyof MovementTuning)[]) {
        const v = saved.values[key];
        if (typeof v === 'number' && Number.isFinite(v)) values[key] = v;
      }
    } catch {
      // Corrupt or blocked storage: start from the defaults.
    }
    return values;
  }

  private save(): void {
    try {
      const changed = this.changedKeys();
      if (changed.length === 0) {
        this.storage?.setItem(TUNING_STORAGE_KEY, '');
        return;
      }
      const values: Record<string, number> = {};
      for (const k of changed) values[k] = this.values[k];
      this.storage?.setItem(
        TUNING_STORAGE_KEY,
        JSON.stringify({ base: tuningFingerprint(this.defaults), values }),
      );
    } catch {
      // Storage unavailable: overrides last for this session only.
    }
  }
}
