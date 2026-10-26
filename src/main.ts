import './style.css';
import { App } from './app/App';
import { showFatalError } from './app/fatal';
import { TuningStore } from './client/debug/TuningStore';
import { GameRenderer } from './client/render/GameRenderer';
import { SettingsStore, browserStorage } from './client/settings/Settings';
import { FOUNDRY_MAP } from './data/maps/foundry';
import { GYM_MAP } from './data/maps/gym';
import { MOVEMENT } from './data/movement';
import type { MapDef } from './sim/map/MapDef';
import { initPhysics } from './sim/physics/PhysicsWorld';
import { Sim } from './sim/Sim';

/** Fixed seed until matches exist (M5); nothing random runs in M1 yet. */
const MATCH_SEED = 0x5eed;

const MAPS: readonly { id: string; name: string; map: MapDef }[] = [
  { id: 'foundry', name: 'Foundry (blockout)', map: FOUNDRY_MAP },
  { id: 'gym', name: 'Movement gym', map: GYM_MAP },
];

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`index.html is missing #${id}`);
  return el;
}

async function boot(): Promise<void> {
  const container = requireElement('game');
  const hud = requireElement('hud');
  const params = new URLSearchParams(window.location.search);
  const entry = MAPS.find((m) => m.id === params.get('map')) ?? MAPS[0];
  if (!entry) throw new Error('No maps are registered');

  await initPhysics();
  const storage = browserStorage();
  const settings = new SettingsStore(storage);
  const tuning = new TuningStore(storage, MOVEMENT);
  const sim = new Sim({ seed: MATCH_SEED, map: entry.map, tuning: tuning.get() });
  const player = sim.addPlayer('attacker');

  let renderer: GameRenderer;
  try {
    renderer = new GameRenderer(container);
  } catch (error) {
    showFatalError(
      'WebGL is not available',
      `${error instanceof Error ? error.message : String(error)} ` +
        'RIFTLINE needs WebGL 2. Check that hardware acceleration is enabled in your browser settings.',
    );
    return;
  }
  renderer.setMap(sim.map);
  window.addEventListener('resize', () => renderer.resize());

  const app = new App({
    sim,
    player,
    renderer,
    hud,
    settings,
    tuning,
    maps: MAPS,
    buildSha: __BUILD_SHA__,
    debugVisible: params.has('debug'),
  });
  app.start();

  document.getElementById('loading')?.remove();
  window.__RIFTLINE__ = {
    ready: true,
    build: __BUILD_SHA__,
    map: sim.map.id,
    tick: () => sim.tick,
    playing: () => app.isPlaying,
    player: () => ({
      x: player.x,
      y: player.y,
      z: player.z,
      speed: player.speed,
      onGround: player.onGround,
      crouched: player.crouched,
    }),
  };
}

boot().catch((error: unknown) => {
  showFatalError('RIFTLINE failed to start', error);
});
