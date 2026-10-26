/**
 * Player settings, persisted in localStorage. Everything read back from storage is validated and
 * clamped, so a corrupt or outdated entry can never break the game; storage failures (private
 * browsing, disabled storage, quota) fall back to defaults silently.
 */
export interface Settings {
  /** Mouse sensitivity multiplier: 1.0 turns BASE_DEGREES_PER_COUNT per mouse count. */
  sensitivity: number;
  invertY: boolean;
  /** Horizontal field of view in degrees, measured on a 16:9 screen (wider screens see more). */
  fov: number;
  /** Master volume, 0..1. STUB(M7): stored and shown, but nothing makes sound yet. */
  volume: number;
  /** World-space 1 m / 5 m grid on all map surfaces, for judging distance and speed. */
  devGrid: boolean;
  /** Speed graph and movement measurements on screen while playing. */
  speedHud: boolean;
}

/** Degrees of turn per mouse count at sensitivity 1.0. */
export const BASE_DEGREES_PER_COUNT = 0.035;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  sensitivity: 1,
  invertY: false,
  fov: 100,
  volume: 0.8,
  devGrid: true,
  speedHud: false,
};

export const SETTINGS_LIMITS = {
  sensitivity: { min: 0.05, max: 10 },
  fov: { min: 80, max: 120 },
  volume: { min: 0, max: 1 },
} as const;

/** Versioned key: bump the version if a setting's meaning changes. */
export const SETTINGS_STORAGE_KEY = 'riftline.settings.v1';

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Builds valid settings from anything (parsed JSON, partial objects); unknown keys are dropped. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  const l = SETTINGS_LIMITS;
  return {
    sensitivity: clampNumber(r['sensitivity'], l.sensitivity.min, l.sensitivity.max, d.sensitivity),
    invertY: bool(r['invertY'], d.invertY),
    fov: clampNumber(r['fov'], l.fov.min, l.fov.max, d.fov),
    volume: clampNumber(r['volume'], l.volume.min, l.volume.max, d.volume),
    devGrid: bool(r['devGrid'], d.devGrid),
    speedHud: bool(r['speedHud'], d.speedHud),
  };
}

/** Mouse travel for a full turn, in cm, for a mouse with the given DPI. */
export function cmPer360(sensitivity: number, dpi = 800): number {
  const counts = 360 / (BASE_DEGREES_PER_COUNT * sensitivity);
  return (counts / dpi) * 2.54;
}

/** The subset of the Web Storage API the store needs (tests pass a fake). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Wraps localStorage; every access is guarded because browsers can throw on any of them. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class SettingsStore {
  private current: Settings;
  private readonly listeners: ((settings: Readonly<Settings>) => void)[] = [];

  constructor(private readonly storage: KeyValueStorage | null) {
    this.current = this.load();
  }

  get(): Readonly<Settings> {
    return this.current;
  }

  /** Applies a change, persists it and notifies listeners. */
  update(change: Partial<Settings>): void {
    this.current = sanitizeSettings({ ...this.current, ...change });
    this.save();
    for (const listener of this.listeners) listener(this.current);
  }

  reset(): void {
    this.update(DEFAULT_SETTINGS);
  }

  /** Calls `listener` now and on every change. */
  subscribe(listener: (settings: Readonly<Settings>) => void): void {
    this.listeners.push(listener);
    listener(this.current);
  }

  private load(): Settings {
    try {
      const text = this.storage?.getItem(SETTINGS_STORAGE_KEY);
      return sanitizeSettings(text ? JSON.parse(text) : null);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // Storage full or blocked: settings still apply for this session.
    }
  }
}
