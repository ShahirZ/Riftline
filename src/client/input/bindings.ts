import { Button } from '../../sim/input/InputCommand';
import type { ButtonName } from '../../sim/input/InputCommand';

/** Movement axes, sampled into InputCommand.forward/strafe. */
export type MoveAction = 'forward' | 'back' | 'left' | 'right';

/** Everything a key or mouse button can be bound to. */
export type Action = MoveAction | ButtonName;

const MOVE_ACTIONS: readonly MoveAction[] = ['forward', 'back', 'left', 'right'];
const BUTTON_ACTIONS = Object.keys(Button) as ButtonName[];
export const ACTIONS: readonly Action[] = [...MOVE_ACTIONS, ...BUTTON_ACTIONS];

/**
 * Input names: KeyboardEvent.code for keys (physical position, so WASD stays under the same fingers
 * on any keyboard layout) and 'Mouse0'..'Mouse4' for mouse buttons.
 */
export type Bindings = Readonly<Record<Action, readonly string[]>>;

export const DEFAULT_BINDINGS: Bindings = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  Jump: ['Space'],
  // Not Ctrl: Ctrl+W closes the browser tab and pages cannot block it.
  Crouch: ['KeyC'],
  Walk: ['ShiftLeft', 'ShiftRight'],
  Fire: ['Mouse0'],
  AltFire: ['Mouse2'],
  Reload: ['KeyR'],
  Use: ['KeyF'],
  Ability1: ['KeyQ'],
  Ability2: ['KeyE'],
  Drop: ['KeyG'],
};

/** Readable label for an input name, for the controls list. */
export function inputLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named: Record<string, string> = {
    Space: 'Space',
    ShiftLeft: 'Shift',
    ShiftRight: 'Right Shift',
    ControlLeft: 'Ctrl',
    Mouse0: 'Left mouse',
    Mouse1: 'Middle mouse',
    Mouse2: 'Right mouse',
  };
  return named[code] ?? code;
}
