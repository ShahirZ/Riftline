import type { MapDef } from '../../sim/map/MapDef';

/**
 * STUB(M1): placeholder diorama, replaced by the Foundry blockout.
 *
 * It exercises the map pipeline (data -> colliders + merged mesh) and the art direction.
 */
export const SHOWCASE_MAP = {
  id: 'showcase',
  name: 'Showcase (M0 placeholder)',
  bounds: { min: [-16, -2, -16], max: [16, 12, 16] },
  solids: [
    // Ground slab.
    { kind: 'box', min: [-14, -1, -14], max: [14, 0, 14], material: 'concrete' },

    // Raised north deck with a ramp up from the south.
    { kind: 'box', min: [-8, 0, -12], max: [8, 1.5, -6], material: 'concrete' },
    { kind: 'ramp', min: [-2, 0, -6], max: [2, 1.5, -1.5], rise: '-z', material: 'grate' },
    { kind: 'box', min: [-8, 1.5, -6.2], max: [-2, 1.62, -6], material: 'trim' },
    { kind: 'box', min: [2, 1.5, -6.2], max: [8, 1.62, -6], material: 'trim' },

    // Relay pedestal on the deck.
    { kind: 'box', min: [-0.9, 1.5, -9.9], max: [0.9, 2.0, -8.1], material: 'metal' },
    { kind: 'box', min: [-0.6, 2.0, -9.6], max: [0.6, 2.12, -8.4], material: 'trim' },

    // Back wall behind the deck, with team-colored panels at either end.
    { kind: 'box', min: [-14, 0, -14], max: [14, 4.5, -12.6], material: 'concrete' },
    { kind: 'box', min: [8.5, 1.5, -12.6], max: [12.5, 3.8, -12.4], material: 'attacker' },
    { kind: 'box', min: [-12.5, 1.5, -12.6], max: [-8.5, 3.8, -12.4], material: 'defender' },

    // Deck support pillars.
    { kind: 'box', min: [-8, 1.5, -12.6], max: [-7.2, 4.5, -11.8], material: 'metal' },
    { kind: 'box', min: [7.2, 1.5, -12.6], max: [8, 4.5, -11.8], material: 'metal' },

    // East crate stack.
    { kind: 'box', min: [5, 0, 2], max: [6.5, 1.5, 3.5], material: 'wood' },
    { kind: 'box', min: [5.2, 1.5, 2.2], max: [6.3, 2.6, 3.3], material: 'wood' },
    { kind: 'box', min: [6.5, 0, 2.3], max: [7.7, 1.2, 3.5], material: 'wood' },

    // West crates.
    { kind: 'box', min: [-7, 0, 3], max: [-5.5, 1.5, 4.5], material: 'wood' },
    { kind: 'box', min: [-7, 0, 4.5], max: [-5.5, 1.5, 6], material: 'wood' },
    { kind: 'box', min: [-6.9, 1.5, 3.6], max: [-5.6, 2.8, 4.9], material: 'metal' },

    // Low cover wall in front.
    { kind: 'box', min: [-3, 0, 3.6], max: [3, 1.1, 4.2], material: 'concrete' },
    { kind: 'box', min: [-3, 1.1, 3.6], max: [3, 1.18, 4.2], material: 'trim' },

    // Team spawn markers on the floor.
    { kind: 'box', min: [9.5, 0, -3.5], max: [12.5, 0.04, 0.5], material: 'attacker' },
    { kind: 'box', min: [-12.5, 0, -3.5], max: [-9.5, 0.04, 0.5], material: 'defender' },
  ],
} as const satisfies MapDef;
