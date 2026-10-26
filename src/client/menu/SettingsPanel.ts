import { SETTINGS_LIMITS, cmPer360 } from '../settings/Settings';
import type { SettingsStore } from '../settings/Settings';
import { checkRow, el, rangeRow } from '../ui/dom';

/** Settings tab of the menu. Every change applies and saves immediately. */
export class SettingsPanel {
  readonly root: HTMLElement;

  constructor(store: SettingsStore) {
    const s = store.get();
    const cm = el('p', { className: 'hint' });
    const showCm = (sensitivity: number): void => {
      cm.textContent = `${cmPer360(sensitivity).toFixed(1)} cm of mouse travel per 360° turn at 800 DPI.`;
    };
    showCm(s.sensitivity);

    const sensitivity = rangeRow({
      label: 'Mouse sensitivity',
      min: SETTINGS_LIMITS.sensitivity.min,
      max: 4,
      step: 0.01,
      value: s.sensitivity,
      onInput: (v) => {
        store.update({ sensitivity: v });
        showCm(store.get().sensitivity);
      },
    });
    const invert = checkRow('Invert mouse Y', s.invertY, (v) => store.update({ invertY: v }));
    const fov = rangeRow({
      label: 'Field of view',
      min: SETTINGS_LIMITS.fov.min,
      max: SETTINGS_LIMITS.fov.max,
      step: 1,
      value: s.fov,
      unit: '°',
      hint: 'Horizontal, measured on a 16:9 screen. Wider screens see more at the sides.',
      onInput: (v) => store.update({ fov: v }),
    });
    const volume = rangeRow({
      label: 'Master volume',
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(s.volume * 100),
      unit: '%',
      onInput: (v) => store.update({ volume: v / 100 }),
    });
    const grid = checkRow('Dev grid on map surfaces (1 m and 5 m lines)', s.devGrid, (v) =>
      store.update({ devGrid: v }),
    );
    const hud = checkRow('Speed graph and movement timings while playing', s.speedHud, (v) =>
      store.update({ speedHud: v }),
    );
    const reset = el('button', { className: 'ghost', text: 'Reset to defaults' });
    reset.addEventListener('click', () => {
      store.reset();
      const d = store.get();
      sensitivity.set(d.sensitivity);
      invert.set(d.invertY);
      fov.set(d.fov);
      volume.set(Math.round(d.volume * 100));
      grid.set(d.devGrid);
      hud.set(d.speedHud);
      showCm(d.sensitivity);
    });

    this.root = el(
      'section',
      { className: 'panel settings-panel' },
      el('h2', { text: 'Settings' }),
      el('h3', { text: 'Mouse' }),
      sensitivity.row,
      cm,
      invert.row,
      el('h3', { text: 'View' }),
      fov.row,
      grid.row,
      hud.row,
      el('h3', { text: 'Audio' }),
      volume.row,
      // STUB(M7): the volume is saved, but nothing makes sound yet.
      el('p', { className: 'hint', text: 'No sound yet: audio arrives in a later milestone.' }),
      el('div', { className: 'actions' }, reset),
    );
  }
}
