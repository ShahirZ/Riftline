import { MOVEMENT, PLAYER_BODY } from '../../data/movement';
import type { MapDef, RampSolid, SolidDef } from '../../sim/map/MapDef';
import { TEAM_COLORS } from './palette';

/** Pixels per meter in the layout image. */
const SCALE = 8;
const MARGIN = 40;
/** Narrow maps get extra room on the right so the legend fits. */
const MIN_WIDTH = 780;
const LEGEND_HEIGHT = 112;

/** What a player can do with a solid of a given top height (from the movement numbers). */
const STEP = MOVEMENT.stepHeight;
const JUMP = MOVEMENT.jumpHeight;
const CROUCH_JUMP = MOVEMENT.jumpHeight + (PLAYER_BODY.standHeight - PLAYER_BODY.crouchHeight);

const COLORS = {
  background: '#141a24',
  floor: '#c9ced6',
  wall: '#2b313b',
  step: '#a9b3bf',
  jump: '#7f9db5',
  crouchJump: '#c9a35f',
  block: '#5b6572',
  grid: 'rgba(20, 26, 36, 0.18)',
  label: '#141a24',
  text: '#edf0f4',
} as const;

function heightColor(top: number): string {
  if (top <= STEP + 1e-6) return COLORS.step;
  if (top <= JUMP + 1e-6) return COLORS.jump;
  if (top <= CROUCH_JUMP + 1e-6) return COLORS.crouchJump;
  return COLORS.block;
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Renders a top-down layout image of a map as SVG: floors, walls, cover colored by what movement
 * can do with it, ramps with rise arrows, overhead roofs, callout names, spawns with facing, a 5 m
 * grid and a scale bar. +X is right (east), +Z is down (south), as in the game.
 */
export function layoutSvg(map: MapDef): string {
  const [x0, , z0] = map.bounds.min;
  const [x1, , z1] = map.bounds.max;
  const width = Math.max((x1 - x0) * SCALE + MARGIN * 2, MIN_WIDTH);
  const height = (z1 - z0) * SCALE + MARGIN * 2 + LEGEND_HEIGHT;
  const px = (x: number): string => fmt((x - x0) * SCALE + MARGIN);
  const pz = (z: number): string => fmt((z - z0) * SCALE + MARGIN);
  const out: string[] = [];
  const add = (s: string): void => {
    out.push(s);
  };

  // The blockout mass is the tallest geometry standing on the floor.
  let wallTop = 0;
  for (const s of map.solids)
    if (s.min[1] <= 0 && s.min[1] >= -1e-6) wallTop = Math.max(wallTop, s.max[1]);

  add(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">`,
  );
  add(`<title>${escapeXml(map.name)}: top-down layout</title>`);
  add(`<rect width="100%" height="100%" fill="${COLORS.background}"/>`);
  add(
    `<rect x="${px(x0)}" y="${pz(z0)}" width="${fmt((x1 - x0) * SCALE)}" height="${fmt((z1 - z0) * SCALE)}" fill="${COLORS.floor}"/>`,
  );

  const walls: SolidDef[] = [];
  const raised: SolidDef[] = [];
  const overhead: SolidDef[] = [];
  for (const s of map.solids) {
    if (s.min[1] < -1e-6) continue; // the ground slab
    // Anything a crouched player fits under is drawn as overhead, labelled with its clearance.
    if (s.min[1] > PLAYER_BODY.crouchHeight) overhead.push(s);
    else if (s.kind === 'box' && s.max[1] >= wallTop - 1e-6) walls.push(s);
    else raised.push(s);
  }
  raised.sort((a, b) => a.max[1] - b.max[1]);

  for (const s of walls) add(rect(s, COLORS.wall, px, pz));

  // 5 m grid over everything walkable.
  for (let x = Math.ceil(x0 / 5) * 5; x <= x1; x += 5) {
    add(
      `<line x1="${px(x)}" y1="${pz(z0)}" x2="${px(x)}" y2="${pz(z1)}" stroke="${COLORS.grid}"/>`,
    );
  }
  for (let z = Math.ceil(z0 / 5) * 5; z <= z1; z += 5) {
    add(
      `<line x1="${px(x0)}" y1="${pz(z)}" x2="${px(x1)}" y2="${pz(z)}" stroke="${COLORS.grid}"/>`,
    );
  }

  for (const s of raised) {
    if (s.material === 'attacker' || s.material === 'defender') {
      add(rect(s, hex(TEAM_COLORS[s.material]), px, pz, 0.85));
    } else if (s.kind === 'ramp') {
      add(rect(s, heightColor(s.max[1]), px, pz, 0.9));
      add(rampArrow(s, px, pz));
    } else {
      add(rect(s, heightColor(s.max[1]), px, pz));
      const area = (s.max[0] - s.min[0]) * (s.max[2] - s.min[2]);
      if (area >= 3 && s.max[1] > STEP) add(heightLabel(s, px, pz));
    }
  }
  for (const s of overhead) {
    add(
      `<rect x="${px(s.min[0])}" y="${pz(s.min[2])}" width="${fmt((s.max[0] - s.min[0]) * SCALE)}" height="${fmt((s.max[2] - s.min[2]) * SCALE)}" fill="none" stroke="#141a24" stroke-width="1.5" stroke-dasharray="6 4"/>`,
    );
    const cx = (s.min[0] + s.max[0]) / 2;
    const cz = (s.min[2] + s.max[2]) / 2;
    add(
      `<text x="${px(cx)}" y="${pz(cz)}" font-size="9" text-anchor="middle" dominant-baseline="middle" fill="#141a24" transform="rotate(-90 ${px(cx)} ${pz(cz)})">${fmt(s.min[1])} m clear</text>`,
    );
  }

  // Callouts: one label per name, centered on that name's largest area.
  const best = new Map<string, { cx: number; cz: number; area: number }>();
  for (const r of map.regions) {
    const area = (r.max[0] - r.min[0]) * (r.max[1] - r.min[1]);
    const prev = best.get(r.name);
    if (!prev || area > prev.area) {
      best.set(r.name, { cx: (r.min[0] + r.max[0]) / 2, cz: (r.min[1] + r.max[1]) / 2, area });
    }
  }
  for (const [name, c] of best) {
    add(
      `<text x="${px(c.cx)}" y="${pz(c.cz)}" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${COLORS.label}" stroke="${COLORS.floor}" stroke-width="3" paint-order="stroke">${escapeXml(name)}</text>`,
    );
  }

  for (const team of ['attacker', 'defender'] as const) {
    const color = hex(TEAM_COLORS[team]);
    for (const sp of map.spawns[team]) {
      const [sx, , sz] = sp.position;
      // Facing: yaw 0 looks toward -Z; positive yaw turns left (counter-clockwise from above).
      const fx = sx - Math.sin(sp.yaw) * 1.6;
      const fz = sz - Math.cos(sp.yaw) * 1.6;
      add(
        `<line x1="${px(sx)}" y1="${pz(sz)}" x2="${px(fx)}" y2="${pz(fz)}" stroke="${color}" stroke-width="2.5"/>`,
      );
      add(
        `<circle cx="${px(sx)}" cy="${pz(sz)}" r="5" fill="${color}" stroke="#141a24" stroke-width="1.5"/>`,
      );
    }
  }

  // Edge coordinates every 10 m.
  for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) {
    add(
      `<text x="${px(x)}" y="${fmt(MARGIN - 10)}" font-size="10" text-anchor="middle" fill="${COLORS.text}">${x}</text>`,
    );
  }
  for (let z = Math.ceil(z0 / 10) * 10; z <= z1; z += 10) {
    add(
      `<text x="${fmt(MARGIN - 8)}" y="${pz(z)}" font-size="10" text-anchor="end" dominant-baseline="middle" fill="${COLORS.text}">${z}</text>`,
    );
  }

  add(legend(map, height));
  add('</svg>');
  return `${out.join('\n')}\n`;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function rect(
  s: SolidDef,
  fill: string,
  px: (x: number) => string,
  pz: (z: number) => string,
  opacity = 1,
): string {
  const w = fmt((s.max[0] - s.min[0]) * SCALE);
  const h = fmt((s.max[2] - s.min[2]) * SCALE);
  const o = opacity < 1 ? ` fill-opacity="${opacity}"` : '';
  return `<rect x="${px(s.min[0])}" y="${pz(s.min[2])}" width="${w}" height="${h}" fill="${fill}"${o} stroke="#141a24" stroke-opacity="0.35"/>`;
}

function heightLabel(s: SolidDef, px: (x: number) => string, pz: (z: number) => string): string {
  const cx = (s.min[0] + s.max[0]) / 2;
  const cz = (s.min[2] + s.max[2]) / 2;
  return `<text x="${px(cx)}" y="${pz(cz)}" font-size="9" text-anchor="middle" dominant-baseline="middle" fill="#141a24">${fmt(s.max[1])}</text>`;
}

function rampArrow(r: RampSolid, px: (x: number) => string, pz: (z: number) => string): string {
  const cx = (r.min[0] + r.max[0]) / 2;
  const cz = (r.min[2] + r.max[2]) / 2;
  const reach = Math.min(r.max[0] - r.min[0], r.max[2] - r.min[2]) * 0.35 + 0.6;
  const along = r.rise === '+x' || r.rise === '-x';
  const sign = r.rise.startsWith('+') ? 1 : -1;
  const len = (along ? r.max[0] - r.min[0] : r.max[2] - r.min[2]) * 0.35;
  const ax = cx - (along ? sign * len : 0);
  const az = cz - (along ? 0 : sign * len);
  const bx = cx + (along ? sign * len : 0);
  const bz = cz + (along ? 0 : sign * len);
  // Arrowhead at b, pointing uphill.
  const hx = along ? -sign * 0.6 : reach * 0.4;
  const hz = along ? reach * 0.4 : -sign * 0.6;
  const p1 = `${px(bx + (along ? hx : -hx))},${pz(bz + (along ? -hz : hz))}`;
  const p2 = `${px(bx + hx)},${pz(bz + hz)}`;
  return (
    `<line x1="${px(ax)}" y1="${pz(az)}" x2="${px(bx)}" y2="${pz(bz)}" stroke="#141a24" stroke-width="1.5"/>` +
    `<polyline points="${p1} ${px(bx)},${pz(bz)} ${p2}" fill="none" stroke="#141a24" stroke-width="1.5"/>`
  );
}

function legend(map: MapDef, height: number): string {
  const y = height - LEGEND_HEIGHT + 18;
  const items: [string, string][] = [
    [COLORS.floor, 'floor'],
    [COLORS.step, `≤ ${fmt(STEP)} m: walk up`],
    [COLORS.jump, `≤ ${fmt(JUMP)} m: jump`],
    [COLORS.crouchJump, `≤ ${fmt(CROUCH_JUMP)} m: crouch-jump`],
    [COLORS.block, 'taller: blocks'],
    [COLORS.wall, 'wall'],
  ];
  const parts: string[] = [];
  let x = MARGIN;
  for (const [color, label] of items) {
    parts.push(
      `<rect x="${x}" y="${y}" width="14" height="14" fill="${color}" stroke="#edf0f4" stroke-opacity="0.4"/>`,
    );
    parts.push(
      `<text x="${x + 20}" y="${y + 11}" font-size="11" fill="${COLORS.text}">${escapeXml(label)}</text>`,
    );
    x += 30 + label.length * 6.2;
  }
  const y2 = y + 30;
  const bar = 10 * SCALE;
  const size = `${fmt(map.bounds.max[0] - map.bounds.min[0])} × ${fmt(map.bounds.max[2] - map.bounds.min[2])} m`;
  parts.push(
    `<line x1="${MARGIN}" y1="${y2}" x2="${MARGIN + bar}" y2="${y2}" stroke="${COLORS.text}" stroke-width="2"/>`,
    `<text x="${MARGIN + bar + 8}" y="${y2 + 4}" font-size="11" fill="${COLORS.text}">10 m · grid 5 m · numbers: top height (m) · arrows point up ramps · dashed: overhead</text>`,
    `<text x="${MARGIN}" y="${y2 + 22}" font-size="11" fill="${COLORS.text}">dots: spawns with facing (orange attackers, cyan defenders)</text>`,
    `<text x="${MARGIN}" y="${y2 + 44}" font-size="12" font-weight="700" fill="${COLORS.text}">${escapeXml(map.name)} · ${size} · north is up</text>`,
  );
  return `<g>${parts.join('')}</g>`;
}
