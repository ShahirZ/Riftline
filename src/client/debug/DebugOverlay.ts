/** Physical key (KeyboardEvent.code) that toggles the overlay: the key below Esc. */
export const DEBUG_TOGGLE_CODE = 'Backquote';

/** How often the overlay text refreshes while visible. */
const REFRESH_MS = 250;

/**
 * Developer overlay with live performance and state readouts. Text is produced by a provider
 * callback and only refreshed a few times per second, and only while visible, so it costs
 * nothing during normal play.
 */
export class DebugOverlay {
  private readonly root: HTMLElement;
  private readonly text: HTMLPreElement;
  private visible = false;
  private nextRefresh = 0;

  constructor(
    parent: HTMLElement,
    private readonly provider: () => string,
    initiallyVisible = false,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'debug-overlay';
    this.root.setAttribute('aria-hidden', 'true');
    this.text = document.createElement('pre');
    this.root.appendChild(this.text);
    parent.appendChild(this.root);
    this.setVisible(initiallyVisible);
    window.addEventListener('keydown', this.onKeyDown);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
    this.nextRefresh = 0;
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  /** Call once per frame with the frame timestamp in milliseconds. */
  update(nowMs: number): void {
    if (!this.visible || nowMs < this.nextRefresh) return;
    this.nextRefresh = nowMs + REFRESH_MS;
    this.text.textContent = this.provider();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== DEBUG_TOGGLE_CODE || event.repeat) return;
    event.preventDefault();
    this.toggle();
  };
}
