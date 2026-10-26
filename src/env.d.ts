/** Short commit hash of this build, injected by vite.config.ts. */
declare const __BUILD_SHA__: string;

/** Read-only hooks for automated smoke tests. Never used by game code. */
interface RiftlineDebugHandle {
  readonly ready: boolean;
  readonly build: string;
  readonly map: string;
  tick(): number;
  playing(): boolean;
  player(): {
    x: number;
    y: number;
    z: number;
    speed: number;
    onGround: boolean;
    crouched: boolean;
  };
}

interface Window {
  __RIFTLINE__?: RiftlineDebugHandle;
}
