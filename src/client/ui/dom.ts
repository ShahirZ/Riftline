/** Tiny DOM builder for the menus and panels. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; title?: string; attrs?: Record<string, string> } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.title) node.title = props.title;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

export interface RangeOptions {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly unit?: string;
  readonly hint?: string;
  readonly onInput: (value: number) => void;
}

/** A labelled slider with a linked number box. Returns the row and a setter for outside updates. */
export function rangeRow(o: RangeOptions): { row: HTMLElement; set: (value: number) => void } {
  const slider = el('input', {
    attrs: { type: 'range', min: String(o.min), max: String(o.max), step: String(o.step) },
  });
  const box = el('input', {
    className: 'num',
    attrs: { type: 'number', step: String(o.step), 'aria-label': o.label },
  });
  const set = (value: number): void => {
    slider.value = String(value);
    box.value = String(Number(value.toFixed(4)));
  };
  set(o.value);
  slider.addEventListener('input', () => {
    box.value = slider.value;
    o.onInput(Number(slider.value));
  });
  box.addEventListener('change', () => {
    const v = Number(box.value);
    if (!Number.isFinite(v)) return;
    slider.value = box.value;
    o.onInput(v);
  });
  const label = el('label', { text: o.label, title: o.hint ?? '' });
  const unit = el('span', { className: 'unit', text: o.unit ?? '' });
  const row = el('div', { className: 'row' }, label, slider, box, unit);
  return { row, set };
}

/** A labelled checkbox row. */
export function checkRow(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
  hint = '',
): { row: HTMLElement; set: (checked: boolean) => void } {
  const box = el('input', { attrs: { type: 'checkbox' } });
  box.checked = checked;
  box.addEventListener('change', () => onChange(box.checked));
  const row = el(
    'label',
    { className: 'row check', title: hint },
    box,
    el('span', { text: label }),
  );
  return {
    row,
    set: (value) => {
      box.checked = value;
    },
  };
}
