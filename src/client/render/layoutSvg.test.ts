import { describe, expect, it } from 'vitest';
import { FOUNDRY_MAP } from '../../data/maps/foundry';
import { GYM_MAP } from '../../data/maps/gym';
import { layoutSvg } from './layoutSvg';

/**
 * The committed layout images in docs/maps are file snapshots of the map data: a map change
 * without regenerated images fails here. Regenerate with `npm run maps`.
 */
const IMAGES = [
  { map: FOUNDRY_MAP, file: '../../../docs/maps/foundry.svg' },
  { map: GYM_MAP, file: '../../../docs/maps/gym.svg' },
];

describe('layoutSvg', () => {
  it('renders a well-formed SVG with every callout and spawn', () => {
    const svg = layoutSvg(FOUNDRY_MAP);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    for (const r of FOUNDRY_MAP.regions) expect(svg).toContain(`>${r.name}<`);
    const spawns = FOUNDRY_MAP.spawns.attacker.length + FOUNDRY_MAP.spawns.defender.length;
    expect(svg.match(/<circle /g)?.length).toBe(spawns);
  });

  it.each(IMAGES)('committed $file matches the map data', async ({ map, file }) => {
    await expect(layoutSvg(map)).toMatchFileSnapshot(file);
  });
});
