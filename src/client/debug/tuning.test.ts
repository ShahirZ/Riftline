import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../../data/movement';
import type { MovementTuning } from '../../sim/movement/MovementTuning';
import type { KeyValueStorage } from '../settings/Settings';
import { TUNING_FIELDS } from './tuningSchema';
import { TUNING_STORAGE_KEY, TuningStore, tuningFingerprint } from './TuningStore';

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('tuning schema', () => {
  it('covers every movement constant exactly once, with the default inside its slider range', () => {
    const keys = TUNING_FIELDS.map((f) => f.key).sort();
    expect(keys).toEqual(Object.keys(MOVEMENT).sort());
    for (const f of TUNING_FIELDS) {
      expect(MOVEMENT[f.key], f.key).toBeGreaterThanOrEqual(f.min);
      expect(MOVEMENT[f.key], f.key).toBeLessThanOrEqual(f.max);
    }
  });
});

describe('TuningStore', () => {
  it('persists overrides and reports what changed', () => {
    const storage = new MemoryStorage();
    const store = new TuningStore(storage, MOVEMENT);
    store.set('runSpeed', 6.5);
    expect(store.changedKeys()).toEqual(['runSpeed']);
    const reloaded = new TuningStore(storage, MOVEMENT);
    expect(reloaded.get().runSpeed).toBe(6.5);
    expect(JSON.parse(reloaded.toJson())).toMatchObject({ ...MOVEMENT, runSpeed: 6.5 });
  });

  it('drops overrides made against different defaults', () => {
    const storage = new MemoryStorage();
    new TuningStore(storage, MOVEMENT).set('gravity', 30);
    const newDefaults: MovementTuning = { ...MOVEMENT, jumpHeight: 1.2 };
    expect(tuningFingerprint(newDefaults)).not.toBe(tuningFingerprint(MOVEMENT));
    expect(new TuningStore(storage, newDefaults).get().gravity).toBe(MOVEMENT.gravity);
  });

  it('resets one key or everything, and ignores garbage', () => {
    const storage = new MemoryStorage();
    const store = new TuningStore(storage, MOVEMENT);
    store.set('friction', 10);
    store.set('stopSpeed', 1);
    store.set('airAccel', NaN);
    store.reset('friction');
    expect(store.changedKeys()).toEqual(['stopSpeed']);
    store.reset();
    expect(store.changedKeys()).toEqual([]);
    storage.setItem(TUNING_STORAGE_KEY, '{oops');
    expect(new TuningStore(storage, MOVEMENT).get()).toEqual(MOVEMENT);
  });
});
