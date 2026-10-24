import './style.css';
import { App } from './app/App';
import { showFatalError } from './app/fatal';
import { GameRenderer } from './client/render/GameRenderer';
import { SHOWCASE_MAP } from './data/maps/showcase';
import { initPhysics } from './sim/physics/PhysicsWorld';
import { Sim } from './sim/Sim';

/** Fixed seed for the placeholder scene; matches get their own seeds from M5. */
const SHOWCASE_SEED = 0x5eed;

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`index.html is missing #${id}`);
  return el;
}

async function boot(): Promise<void> {
  const container = requireElement('game');
  const hud = requireElement('hud');

  await initPhysics();
  const sim = new Sim({ seed: SHOWCASE_SEED, map: SHOWCASE_MAP });

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

  const debugVisible = new URLSearchParams(window.location.search).has('debug');
  const app = new App(sim, renderer, hud, __BUILD_SHA__, debugVisible);
  app.start();

  document.getElementById('loading')?.remove();
  window.__RIFTLINE__ = { ready: true, build: __BUILD_SHA__, tick: () => sim.tick };
}

boot().catch((error: unknown) => {
  showFatalError('RIFTLINE failed to start', error);
});
