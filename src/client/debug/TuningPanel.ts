import type { MovementTuning } from '../../sim/movement/MovementTuning';
import { el, rangeRow } from '../ui/dom';
import { TUNING_FIELDS } from './tuningSchema';
import type { TuningGroup } from './tuningSchema';
import type { TuningStore } from './TuningStore';

/**
 * Live movement tuning (menu tab). Every slider applies to the running sim at once; "Copy as
 * JSON" puts the full tuning on the clipboard so feel feedback comes back as exact numbers.
 */
export class TuningPanel {
  readonly root: HTMLElement;
  private readonly setters = new Map<keyof MovementTuning, (v: number) => void>();
  private readonly rows = new Map<keyof MovementTuning, HTMLElement>();
  private readonly status = el('p', { className: 'hint' });
  private readonly json = el('textarea', { className: 'json', attrs: { readonly: '', rows: '8' } });

  constructor(
    private readonly store: TuningStore,
    private readonly apply: (tuning: MovementTuning) => void,
  ) {
    const groups = new Map<TuningGroup, HTMLElement>();
    for (const field of TUNING_FIELDS) {
      let group = groups.get(field.group);
      if (!group) {
        group = el('div', { className: 'group' }, el('h3', { text: field.group }));
        groups.set(field.group, group);
      }
      const { row, set } = rangeRow({
        label: field.label,
        min: field.min,
        max: field.max,
        step: field.step,
        value: store.get()[field.key],
        unit: field.unit,
        hint: field.hint,
        onInput: (v) => {
          store.set(field.key, v);
          this.changed();
        },
      });
      const undo = el('button', { className: 'mini', text: '↺', title: 'Back to default' });
      undo.addEventListener('click', () => {
        store.reset(field.key);
        set(store.defaults[field.key]);
        this.changed();
      });
      row.append(undo);
      this.setters.set(field.key, set);
      this.rows.set(field.key, row);
      group.append(row);
    }

    const copy = el('button', { text: 'Copy as JSON' });
    copy.addEventListener('click', () => this.copy(copy));
    const resetAll = el('button', { className: 'ghost', text: 'Reset all' });
    resetAll.addEventListener('click', () => {
      store.reset();
      for (const [key, set] of this.setters) set(store.defaults[key]);
      this.changed();
    });

    this.root = el(
      'section',
      { className: 'panel tuning-panel' },
      el('h2', { text: 'Movement tuning' }),
      el('p', {
        className: 'hint',
        text: 'Changes apply immediately and survive reloads. Hover a name for what it does. Turn on the speed graph in Settings to see stop and jump timings while playing.',
      }),
      el('div', { className: 'actions' }, copy, resetAll),
      this.status,
      ...groups.values(),
      this.json,
    );
    this.json.hidden = true;
    this.changed();
  }

  private changed(): void {
    this.apply(this.store.get());
    const changed = this.store.changedKeys();
    this.status.textContent =
      changed.length === 0
        ? 'All values are the shipped defaults.'
        : `${changed.length} changed from the defaults (highlighted).`;
    for (const [key, row] of this.rows) row.classList.toggle('changed', changed.includes(key));
  }

  private copy(button: HTMLButtonElement): void {
    const text = this.store.toJson();
    const done = (label: string): void => {
      button.textContent = label;
      window.setTimeout(() => (button.textContent = 'Copy as JSON'), 1500);
    };
    // The clipboard API needs a secure context and permission; fall back to a selectable box.
    const fallback = (): void => {
      this.json.hidden = false;
      this.json.value = text;
      this.json.select();
      done('Select and copy below');
    };
    if (!navigator.clipboard) {
      fallback();
      return;
    }
    navigator.clipboard.writeText(text).then(() => done('Copied'), fallback);
  }
}
