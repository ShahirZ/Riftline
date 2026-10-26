# RIFTLINE

An original, browser-based tactical FPS: round-based 4v4 attack and defend against bots.
Attackers carry a relay to one of two sites and arm it; defenders stop them. Built with three.js,
Rapier physics and fully synthesized audio. No external art or audio assets.

**Status:** M1 movement and camera. You can run, walk, crouch and jump around a blockout of the
map Foundry (or the movement gym) and tune the movement live. Weapons arrive in M2. See
[docs/ROADMAP.md](docs/ROADMAP.md) for the milestone plan.

## Play

**Live:** https://shahirz.github.io/Riftline/

Click **Play** to capture the mouse; press **Esc** to pause and get the mouse back. The game needs
WebGL 2 and a mouse; Chromium-based browsers also get raw (unaccelerated) mouse input.

| Key / input  | Action                              |
| ------------ | ----------------------------------- |
| W A S D      | Move                                |
| Mouse        | Look                                |
| Space        | Jump                                |
| C (hold)     | Crouch (in the air: tuck your feet) |
| Shift (hold) | Walk (slow, quiet)                  |
| Esc          | Pause, free the mouse               |
| `` ` ``      | Debug overlay (the key below Esc)   |

Maps: Foundry (default) and the movement gym, a test course with measured steps, slopes, jump
boxes, crouch tunnels and gaps: https://shahirz.github.io/Riftline/?map=gym. Add `?debug` (or
`&debug`) to the URL to open the debug overlay on load.

The pause menu has **Settings** (mouse sensitivity with a cm/360 readout, invert Y, field of view,
dev grid, speed graph; saved in the browser) and **Movement tuning**: every movement constant on a
slider, applied live, with **Copy as JSON** to share the exact numbers. Turn on the speed graph in
Settings to see stop times (release vs counter-strafe), time to full speed and jump stats while
playing.

Top-down layout images: [docs/maps/foundry.svg](docs/maps/foundry.svg),
[docs/maps/gym.svg](docs/maps/gym.svg).

## Deploy

The site deploys automatically from `main` through GitHub Actions. One-time setup for the
repository owner:

1. Open the repository's **Settings -> Pages**.
2. Under **Build and deployment -> Source**, choose **GitHub Actions**.
3. Push to `main` (or re-run the latest CI workflow on `main`). The `Deploy to GitHub Pages` job
   prints the URL when it finishes.

Every branch push also runs the full checks and uploads the built site as a workflow artifact
(`github-pages`), so any branch build can be downloaded and served locally.

## Develop

Requires Node.js 22.12 or newer.

```sh
npm ci            # install exact locked dependencies
npm run dev       # http://localhost:5173/Riftline/
npm test          # unit tests, including movement tests and map fuzzing
npm run lint      # ESLint + Prettier check
npm run build     # typecheck + production build into dist/
npm run preview   # serve dist/ at http://localhost:4173/Riftline/
npm run maps      # regenerate docs/maps/*.svg after changing a map
```

The design spec is [docs/DESIGN.md](docs/DESIGN.md). Architecture, conventions and project rules
are in [CLAUDE.md](CLAUDE.md).
