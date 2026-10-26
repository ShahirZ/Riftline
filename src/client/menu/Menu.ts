import { inputLabel } from '../input/bindings';
import type { Bindings } from '../input/bindings';
import { el } from '../ui/dom';

export type MenuTab = 'controls' | 'settings' | 'tuning';

export interface MenuOptions {
  readonly bindings: Bindings;
  readonly mapId: string;
  readonly mapName: string;
  readonly maps: readonly { readonly id: string; readonly name: string }[];
  readonly settingsPanel: HTMLElement;
  readonly tuningPanel: HTMLElement;
  /** Called from the Play/Resume click, which counts as the user gesture pointer lock needs. */
  readonly onPlay: () => void;
}

/**
 * Start screen and pause menu: title, Play/Resume, and tabs for controls, settings and movement
 * tuning. The game runs only while the pointer is locked; this shows whenever it is not.
 */
export class Menu {
  readonly root: HTMLElement;
  private readonly play: HTMLButtonElement;
  private readonly heading: HTMLElement;
  private readonly message: HTMLElement;
  private readonly tabs = new Map<MenuTab, [HTMLButtonElement, HTMLElement]>();

  constructor(parent: HTMLElement, o: MenuOptions) {
    this.heading = el('div', { className: 'menu-heading', text: 'Movement & camera build' });
    this.play = el('button', { className: 'play', text: 'Play' });
    this.play.addEventListener('click', () => o.onPlay());
    this.message = el('p', { className: 'menu-message', attrs: { role: 'status' } });

    const tabBar = el('nav', { className: 'menu-tabs' });
    const panelSlot = el('div', { className: 'menu-panel' });
    const tabContent: [MenuTab, string, HTMLElement][] = [
      ['controls', 'Controls', controlsPanel(o.bindings)],
      ['settings', 'Settings', o.settingsPanel],
      ['tuning', 'Movement tuning', o.tuningPanel],
    ];
    for (const [id, label, content] of tabContent) {
      const button = el('button', { className: 'tab', text: label });
      button.addEventListener('click', () => this.showTab(id));
      tabBar.append(button);
      panelSlot.append(content);
      this.tabs.set(id, [button, content]);
    }

    const maps = el('p', { className: 'menu-maps' }, 'Map: ');
    o.maps.forEach((m, i) => {
      if (i > 0) maps.append(' · ');
      maps.append(
        m.id === o.mapId
          ? el('strong', { text: m.name })
          : el('a', { text: m.name, attrs: { href: `?map=${m.id}` } }),
      );
    });

    this.root = el(
      'div',
      { className: 'menu' },
      el(
        'div',
        { className: 'menu-side' },
        el('div', { className: 'wordmark', text: 'RIFTLINE' }),
        el('div', { className: 'rift', attrs: { 'aria-hidden': 'true' } }, el('span'), el('span')),
        this.heading,
        this.play,
        this.message,
        tabBar,
        maps,
      ),
      panelSlot,
    );
    parent.append(this.root);
    this.showTab('controls');
  }

  /** Shows the menu: 'start' before the first lock, 'paused' after. */
  show(mode: 'start' | 'paused'): void {
    this.root.hidden = false;
    this.play.textContent = mode === 'start' ? 'Play' : 'Resume';
    this.heading.textContent = mode === 'start' ? 'Movement & camera build' : 'Paused';
  }

  hide(): void {
    this.root.hidden = true;
    this.setMessage('');
  }

  setMessage(text: string): void {
    this.message.textContent = text;
  }

  showTab(tab: MenuTab): void {
    for (const [id, [button, content]] of this.tabs) {
      button.classList.toggle('active', id === tab);
      content.hidden = id !== tab;
    }
  }
}

function controlsPanel(b: Bindings): HTMLElement {
  const keys = (list: readonly string[]): string => list.map(inputLabel).join(' / ');
  const rows: [string, string][] = [
    ['Move', [b.forward, b.left, b.back, b.right].map((l) => keys(l)).join(' ')],
    ['Look', 'Mouse'],
    ['Jump', keys(b.Jump)],
    ['Crouch (hold)', keys(b.Crouch)],
    ['Walk, quiet (hold)', keys(b.Walk)],
    ['Pause, free the mouse', 'Esc'],
    ['Debug overlay', '` (key below Esc)'],
  ];
  const table = el('table', { className: 'controls' });
  for (const [action, key] of rows) {
    table.append(el('tr', {}, el('td', { text: action }), el('td', {}, el('kbd', { text: key }))));
  }
  return el(
    'section',
    { className: 'panel controls-panel' },
    el('h2', { text: 'Controls' }),
    table,
    el('h3', { text: 'Tips' }),
    el(
      'ul',
      {},
      el('li', {
        text: 'Tap the opposite direction to stop fast (counter-strafe); letting go stops slower.',
      }),
      el('li', {
        text: 'Crouch at the top of a jump to tuck your feet and reach higher ledges (about 1.6 m).',
      }),
      el('li', {
        text: 'Ledges up to 0.45 m are climbed by walking; stairs and ramps need no jumping.',
      }),
      el('li', {
        text: 'The grid on every surface marks 1 m (thin) and 5 m (thick) for judging distance and speed.',
      }),
    ),
  );
}
