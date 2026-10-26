import { el } from '../ui/dom';

/** A plain center crosshair (four ticks around a gap). Customization arrives with weapons (M2). */
export class Crosshair {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el(
      'div',
      { className: 'crosshair', attrs: { 'aria-hidden': 'true' } },
      el('span', { className: 'up' }),
      el('span', { className: 'down' }),
      el('span', { className: 'left' }),
      el('span', { className: 'right' }),
    );
    this.root.hidden = true;
    parent.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }
}
