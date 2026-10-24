# RIFTLINE

An original, browser-based tactical FPS: round-based 4v4 attack and defend against bots.
Attackers carry a relay to one of two sites and arm it; defenders stop them. Built with three.js,
Rapier physics and fully synthesized audio. No external art or audio assets.

**Status:** M0 foundation. The current build is a placeholder scene that proves the tech stack
end to end. See [docs/ROADMAP.md](docs/ROADMAP.md) for the milestone plan.

## Play

**Live:** https://shahirz.github.io/Riftline/

The site deploys automatically from `main` through GitHub Actions. One-time setup for the
repository owner:

1. Open the repository's **Settings -> Pages**.
2. Under **Build and deployment -> Source**, choose **GitHub Actions**.
3. Push to `main` (or re-run the latest CI workflow on `main`). The `Deploy to GitHub Pages` job
   prints the URL when it finishes.

Every branch push also runs the full checks and uploads the built site as a workflow artifact
(`github-pages`), so any branch build can be downloaded and served locally.

## Controls

| Key     | Action                                   |
| ------- | ---------------------------------------- |
| `` ` `` | Toggle the debug overlay (key below Esc) |

Add `?debug` to the URL to open the debug overlay on load. Movement, shooting and the full control
scheme arrive with milestones M1 and M2.

## Develop

Requires Node.js 22.12 or newer.

```sh
npm ci            # install exact locked dependencies
npm run dev       # http://localhost:5173/Riftline/
npm test          # unit tests
npm run lint      # ESLint + Prettier check
npm run build     # typecheck + production build into dist/
npm run preview   # serve dist/ at http://localhost:4173/Riftline/
```

Architecture, conventions and project rules are in [CLAUDE.md](CLAUDE.md).
