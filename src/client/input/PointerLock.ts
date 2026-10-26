/** 'raw': unaccelerated mouse counts (Chromium). 'standard': OS pointer acceleration applies. */
export type LockMode = 'raw' | 'standard';

interface Pending {
  resolve: (mode: LockMode) => void;
  reject: (reason: Error) => void;
}

/**
 * Pointer lock for mouse look. Asks for raw, unaccelerated mouse input first and falls back to
 * standard input where the platform refuses it (Firefox, Safari, some Linux setups).
 *
 * Browser quirks handled here:
 * - The first mousemove after locking often carries a bogus jump; it is dropped.
 * - When the raw request fails, Chromium fires its pointerlockerror late, after the fallback
 *   request has already succeeded. Where requestPointerLock returns a promise, only the promise of
 *   the latest attempt counts; the error and change events decide only in browsers without it.
 * - Browsers refuse to re-lock for about a second after the user pressed Esc, and only on a click;
 *   request() rejects so the menu can ask for another click.
 */
export class PointerLock {
  locked = false;
  /** Input mode of the current (or last) lock. */
  mode: LockMode | null = null;
  private skipNextMove = false;
  private pending: Pending | null = null;
  private attemptId = 0;
  private attemptMode: LockMode = 'raw';
  private usesPromises = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly onMove: (dx: number, dy: number) => void,
    private readonly onChange: (locked: boolean) => void,
  ) {
    document.addEventListener('pointerlockchange', this.handleChange);
    document.addEventListener('pointerlockerror', this.handleError);
    document.addEventListener('mousemove', this.handleMove);
  }

  /** Locks the pointer. Must be called from a click handler. */
  request(): Promise<LockMode> {
    if (this.locked && this.mode) return Promise.resolve(this.mode);
    if (typeof this.element.requestPointerLock !== 'function') {
      return Promise.reject(new Error('This browser does not support pointer lock.'));
    }
    this.pending?.reject(new Error('Superseded by a newer request.'));
    return new Promise<LockMode>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.attempt('raw');
    });
  }

  exit(): void {
    if (document.pointerLockElement === this.element) document.exitPointerLock();
  }

  private attempt(mode: LockMode): void {
    const id = ++this.attemptId;
    this.attemptMode = mode;
    const options: PointerLockOptions | undefined =
      mode === 'raw' ? { unadjustedMovement: true } : undefined;
    // Typed as unknown: older browsers return undefined instead of a promise (their events decide).
    let result: unknown;
    try {
      result = this.element.requestPointerLock(options);
    } catch (error) {
      this.fail(id, error);
      return;
    }
    if (result instanceof Promise) {
      this.usesPromises = true;
      result.then(
        () => this.succeed(id),
        (error: unknown) => this.fail(id, error),
      );
    }
  }

  private succeed(id: number): void {
    if (id !== this.attemptId) return;
    this.mode = this.attemptMode;
    this.pending?.resolve(this.mode);
    this.pending = null;
  }

  private fail(id: number, error: unknown): void {
    if (id !== this.attemptId || !this.pending) return;
    if (this.attemptMode === 'raw') {
      // No raw input on this platform: try again with standard input.
      this.attempt('standard');
      return;
    }
    const reason =
      error instanceof Error ? error : new Error('The browser refused to capture the mouse.');
    this.pending.reject(reason);
    this.pending = null;
  }

  private readonly handleChange = (): void => {
    const locked = document.pointerLockElement === this.element;
    if (locked === this.locked) return;
    this.locked = locked;
    if (locked) {
      this.skipNextMove = true;
      if (!this.usesPromises) this.succeed(this.attemptId);
    }
    this.onChange(locked);
  };

  private readonly handleError = (): void => {
    if (this.usesPromises || this.locked) return;
    this.fail(this.attemptId, new Error('The browser refused to capture the mouse. Click again.'));
  };

  private readonly handleMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    if (this.skipNextMove) {
      this.skipNextMove = false;
      return;
    }
    this.onMove(event.movementX, event.movementY);
  };
}
