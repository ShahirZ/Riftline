import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
  cmPer360,
  sanitizeSettings,
} from './Settings';
import type { KeyValueStorage } from './Settings';

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

class BrokenStorage implements KeyValueStorage {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

describe('sanitizeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ fov: 'wide', invertY: 1, sensitivity: NaN })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('clamps numbers into range and keeps valid values', () => {
    const s = sanitizeSettings({ fov: 400, sensitivity: -2, volume: 0.25, invertY: true });
    expect(s.fov).toBe(120);
    expect(s.sensitivity).toBe(0.05);
    expect(s.volume).toBe(0.25);
    expect(s.invertY).toBe(true);
  });

  it('drops unknown keys', () => {
    expect(Object.keys(sanitizeSettings({ hacks: true }))).toEqual(Object.keys(DEFAULT_SETTINGS));
  });
});

describe('SettingsStore', () => {
  it('persists changes and reloads them', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.update({ fov: 110, invertY: true });
    expect(JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      fov: 110,
      invertY: true,
    });
    expect(new SettingsStore(storage).get()).toMatchObject({ fov: 110, invertY: true });
  });

  it('survives corrupt JSON and throwing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    expect(new SettingsStore(storage).get()).toEqual(DEFAULT_SETTINGS);
    const broken = new SettingsStore(new BrokenStorage());
    expect(broken.get()).toEqual(DEFAULT_SETTINGS);
    expect(() => broken.update({ fov: 90 })).not.toThrow();
    expect(broken.get().fov).toBe(90);
  });

  it('notifies subscribers immediately and on change', () => {
    const store = new SettingsStore(null);
    const seen: number[] = [];
    store.subscribe((s) => seen.push(s.fov));
    store.update({ fov: 95 });
    store.reset();
    expect(seen).toEqual([DEFAULT_SETTINGS.fov, 95, DEFAULT_SETTINGS.fov]);
  });
});

describe('cmPer360', () => {
  it('halves when sensitivity doubles', () => {
    expect(cmPer360(2)).toBeCloseTo(cmPer360(1) / 2);
    // Sanity: the default lands in the usual tactical-shooter range at 800 DPI.
    expect(cmPer360(1)).toBeGreaterThan(25);
    expect(cmPer360(1)).toBeLessThan(45);
  });
});
