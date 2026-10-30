/* ============================================================
   HOUSE — the map, furniture and random objective placement
   ============================================================ */

export const MAP_W = 25;
export const MAP_H = 27;
export const TILE = 1;

const idx = (x, y) => y * MAP_W + x;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* Rooms are interior rectangles, inclusive on both ends. */
const ROOMS = [
  { id: 'garage',   x0: 1,  y0: 21, x1: 9,  y1: 25, floor: 'concrete', wall: 'concrete' },
  { id: 'foyer',    x0: 11, y0: 21, x1: 15, y1: 25, floor: 'wood',     wall: 'wallpaper' },
  { id: 'storage',  x0: 17, y0: 21, x1: 23, y1: 25, floor: 'concrete', wall: 'plaster' },
  { id: 'living',   x0: 1,  y0: 12, x1: 11, y1: 19, floor: 'carpet',   wall: 'wallpaper' },
  { id: 'kitchen',  x0: 13, y0: 12, x1: 23, y1: 19, floor: 'tile',     wall: 'tile' },
  { id: 'hall',     x0: 1,  y0: 9,  x1: 23, y1: 10, floor: 'wood',     wall: 'wallpaper' },
  { id: 'workshop', x0: 1,  y0: 1,  x1: 7,  y1: 7,  floor: 'concrete', wall: 'plaster' },
  { id: 'bathroom', x0: 9,  y0: 1,  x1: 14, y1: 7,  floor: 'tile',     wall: 'tile' },
  { id: 'bedroom',  x0: 16, y0: 1,  x1: 23, y1: 7,  floor: 'carpet',   wall: 'wallpaper' },
];

/* Openings [x, y] carved through walls. */
export const DOORS = [
  [4, 8], [11, 8], [19, 8],          // top rooms -> hall
  [4, 11], [18, 11],                 // hall -> living / kitchen
  [12, 15], [12, 16],                // living <-> kitchen archway
  [4, 20], [14, 20],                 // living -> garage, kitchen -> foyer
  [10, 23], [16, 23],                // garage -> foyer, foyer -> storage
];

export const START = { x: 8.5, y: 24.5, yaw: Math.atan2(-1.2, -3.5) };

export const MILO_START = { x: 5.0, y: 4.4 };

/* ------------------------------------------------------------
   Build the static shell
   ------------------------------------------------------------ */
function buildShell() {
  const solid = new Uint8Array(MAP_W * MAP_H).fill(1);
  const floor = new Array(MAP_W * MAP_H).fill('wood');
  const wall = new Array(MAP_W * MAP_H).fill('wallpaper');

  for (const r of ROOMS) {
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        solid[idx(x, y)] = 0;
        floor[idx(x, y)] = r.floor;
      }
    }
  }
  for (const [x, y] of DOORS) {
    solid[idx(x, y)] = 0;
    floor[idx(x, y)] = 'wood';
  }
  // Style the wall ring around each room.
  for (const r of ROOMS) {
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (solid[idx(x, y)] === 1) wall[idx(x, y)] = r.wall;
      }
    }
  }
  return { solid, floor, wall };
}

export const SHELL = buildShell();
export const solidAt = (x, y) => {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  return SHELL.solid[idx(x, y)] === 1;
};

/* ------------------------------------------------------------
   Furniture
   ------------------------------------------------------------ */
const F = (kind, x, y, w, d, h, extra = {}) => ({
  kind, x, y, w, d, h, solid: true, ...extra,
});

const FURNITURE = [
  // ---- workshop (where Milo was made)
  F('bench', 4.0, 1.85, 3.0, 0.9, 1.0),
  F('shelf', 1.55, 4.5, 1.2, 0.7, 2.15),
  F('crate', 6.7, 6.4, 1.3, 1.0, 1.05),
  F('chair', 6.3, 3.1, 0.8, 0.8, 1.2),
  // ---- bathroom
  F('tub', 10.5, 1.9, 2.6, 0.9, 0.9),
  F('toilet', 13.6, 6.4, 0.9, 1.0, 1.15),
  F('sink', 9.6, 5.7, 1.0, 0.8, 1.05),
  // ---- bedroom
  F('bed', 19.1, 2.5, 2.7, 1.7, 1.1),
  F('wardrobe', 22.45, 2.2, 1.3, 0.7, 2.3),
  F('nightstand', 16.8, 2.5, 0.85, 0.7, 0.8),
  F('desk', 17.4, 6.2, 1.8, 0.9, 1.05),
  F('chair', 20.2, 6.1, 0.8, 0.8, 1.2),
  // ---- living room
  F('sofa', 3.4, 17.9, 2.9, 1.0, 1.05),
  F('coffee', 3.7, 15.8, 1.8, 0.8, 0.55),
  F('tv', 10.3, 13.2, 1.3, 0.6, 1.35),
  F('shelf', 1.55, 13.2, 1.3, 0.7, 2.2),
  F('armchair', 8.5, 18.0, 1.15, 0.95, 1.15),
  F('lamp', 1.7, 18.2, 0.55, 0.55, 1.85),
  // ---- kitchen
  F('counter', 15.6, 18.7, 3.2, 0.9, 1.0),
  F('fridge', 22.4, 18.3, 1.25, 0.9, 2.2),
  F('counter', 14.4, 12.6, 2.2, 0.9, 1.0),
  F('island', 18.0, 15.6, 2.5, 1.0, 0.95),
  F('table', 19.8, 13.1, 2.4, 1.15, 0.8),
  // ---- foyer
  F('coatrack', 11.6, 24.35, 0.7, 0.6, 2.0),
  F('shoebench', 14.4, 24.4, 1.2, 0.6, 0.55),
  // ---- garage
  F('car', 5.0, 23.3, 3.6, 1.65, 1.45, { interact: 'car' }),
  F('shelf', 1.55, 22.0, 1.2, 0.7, 1.9),
  F('crate', 8.4, 21.9, 1.2, 0.9, 1.0),
  // ---- storage
  F('shelf', 18.0, 22.0, 1.4, 0.7, 2.2),
  F('shelf', 22.4, 22.1, 1.2, 0.7, 2.2),
  F('washer', 21.0, 24.4, 1.25, 0.8, 1.15),
  F('crate', 19.0, 24.4, 1.3, 0.9, 1.1),
];

/* ------------------------------------------------------------
   Pickups & notes
   ------------------------------------------------------------ */
const GAS_SPOTS = [
  { x: 18.4, y: 23.3, z: 0.0, room: 'storage', where: 'the storage shelf' },
  { x: 15.4, y: 17.5, z: 0.0, room: 'kitchen', where: 'under the kitchen sink' },
  { x: 2.0,  y: 23.3, z: 0.0, room: 'garage',  where: 'the garage shelf' },
  { x: 2.5,  y: 6.4,  z: 0.0, room: 'workshop', where: 'the workshop corner' },
  { x: 7.2,  y: 5.3,  z: 0.0, room: 'workshop', where: 'beside the crate' },
];

const KEY_SPOTS = [
  { x: 16.8, y: 2.5,  z: 0.75, room: 'bedroom',  where: 'the nightstand' },
  { x: 19.8, y: 13.1, z: 0.75, room: 'kitchen',  where: 'the kitchen table' },
  { x: 2.1,  y: 13.6, z: 1.25, room: 'living',   where: 'the bookshelf' },
  { x: 9.6,  y: 5.7,  z: 0.75, room: 'bathroom', where: 'the bathroom sink' },
  { x: 14.4, y: 24.4, z: 0.5,  room: 'foyer',    where: 'the shoe bench' },
  { x: 4.4,  y: 2.4,  z: 0.8,  room: 'workshop', where: 'the workbench' },
];

const BATTERY_SPOTS = [
  { x: 3.0,  y: 4.6 },
  { x: 12.8, y: 3.4 },
  { x: 21.8, y: 5.2 },
  { x: 6.2,  y: 18.4 },
  { x: 14.2, y: 14.2 },
  { x: 2.8,  y: 24.6 },
  { x: 20.3, y: 22.6 },
  { x: 12.5, y: 21.6 },
];

export const NOTES = [
  {
    id: 'log',
    x: 4.9, y: 2.55, z: 0.8, room: 'workshop', title: 'BUILD LOG — DAY 61',
    text:
`BUILD LOG — DAY 61

Milo v3. Servo response is perfect now.
He follows me to the door when I leave.
I tell myself it's the gyro.

Last night he asked what time the party
starts. I never programmed that.`,
  },
  {
    id: 'sorry',
    x: 17.5, y: 6.2, z: 0.8, room: 'bedroom', title: 'A NOTE, PRESSED HARD',
    text:
`DAY 66.

I pulled his battery at 2:14 a.m.
He kept singing. It wasn't coming from him.
It was coming from inside the walls.

The fair is cancelled.
I'm sorry, Milo. I'm so sorry.`,
  },
  {
    id: 'list',
    x: 2.2, y: 13.6, z: 1.3, room: 'living', title: 'BIRTHDAY LIST',
    text:
`BIRTHDAY LIST

1. Cake (chocolate)
2. Candles (nine)
3. Guests
4. Milo waits in the car.

I crossed out 3.
I crossed out 4.`,
  },
];

/* ------------------------------------------------------------
   RNG helpers
   ------------------------------------------------------------ */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { mulberry32 };

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------
   World generation
   ------------------------------------------------------------ */
export function createWorld(seed = (Math.random() * 1e9) | 0) {
  const rng = mulberry32(seed);
  const solid = new Uint8Array(SHELL.solid);

  const props = FURNITURE.map((p, i) => ({ ...p, id: `f${i}` }));

  // Gas and keys must be in different rooms, never in the starting room.
  let gasSpot = pick(GAS_SPOTS.filter(s => s.room !== 'garage'), rng);
  let keyChoices = KEY_SPOTS.filter(s => s.room !== gasSpot.room && s.room !== 'garage');
  const keySpot = pick(keyChoices, rng);

  const pickups = [];
  pickups.push({
    id: 'gas', kind: 'gas', x: gasSpot.x, y: gasSpot.y, z: gasSpot.z,
    label: 'GAS CAN', where: gasSpot.where, room: gasSpot.room, glow: 1,
  });
  pickups.push({
    id: 'key', kind: 'key', x: keySpot.x, y: keySpot.y, z: keySpot.z,
    label: 'CAR KEYS', where: keySpot.where, room: keySpot.room, glow: 1,
  });

  const batSpots = shuffle(BATTERY_SPOTS, rng).slice(0, 4);
  batSpots.forEach((s, i) => pickups.push({
    id: `bat${i}`, kind: 'battery', x: s.x, y: s.y, z: 0.06,
    label: 'BATTERY', glow: 0.55,
  }));

  const notes = NOTES.map(n => ({ ...n, read: false }));

  // Mark tiles occupied by solid furniture (used by AI navigation).
  for (const p of props) {
    if (!p.solid) continue;
    const x0 = Math.floor(p.x - p.w / 2), x1 = Math.floor(p.x + p.w / 2);
    const y0 = Math.floor(p.y - p.d / 2), y1 = Math.floor(p.y + p.d / 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (SHELL.solid[idx(x, y)] === 1) continue;
        // Only block if the tile centre is inside the footprint.
        const cx = x + 0.5, cy = y + 0.5;
        if (cx > p.x - p.w / 2 && cx < p.x + p.w / 2 &&
            cy > p.y - p.d / 2 && cy < p.y + p.d / 2) {
          solid[idx(x, y)] = 1;
        }
      }
    }
  }

  // Never let furniture seal a doorway or the spawn tile.
  for (const [x, y] of DOORS) solid[idx(x, y)] = 0;
  solid[idx(Math.floor(START.x), Math.floor(START.y))] = 0;

  return {
    seed, rng, props, pickups, notes, solid,
    start: { ...START },
    miloStart: { ...MILO_START },
    gasSpot, keySpot,
  };
}

/* ------------------------------------------------------------
   Navigation / line of sight
   ------------------------------------------------------------ */
export function walkable(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  return world.solid[idx(tx, ty)] === 0;
}

export function lineOfSight(world, ax, ay, bx, by, maxDist = 24) {
  const dx = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist > maxDist) return false;
  const steps = Math.ceil(dist * 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(ax + dx * t);
    const y = Math.floor(ay + dy * t);
    if (!walkable(world, x, y)) return false;
  }
  return true;
}

export function bfsPath(world, sx, sy, tx, ty) {
  const startX = Math.floor(sx), startY = Math.floor(sy);
  const goalX = Math.floor(tx), goalY = Math.floor(ty);
  if (!walkable(world, goalX, goalY)) return [];
  if (startX === goalX && startY === goalY) return [];
  const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
  const seen = new Uint8Array(MAP_W * MAP_H);
  const q = new Int32Array(MAP_W * MAP_H);
  let head = 0, tail = 0;
  const s = idx(startX, startY);
  q[tail++] = s; seen[s] = 1;
  const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
  let found = false;
  while (head < tail) {
    const cur = q[head++];
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    if (cx === goalX && cy === goalY) { found = true; break; }
    for (let d = 0; d < 4; d++) {
      const nx = cx + dirs[d * 2], ny = cy + dirs[d * 2 + 1];
      if (!walkable(world, nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen[ni]) continue;
      seen[ni] = 1; prev[ni] = cur; q[tail++] = ni;
    }
  }
  if (!found) return [];
  const path = [];
  let cur = idx(goalX, goalY);
  while (cur !== s) {
    path.push({ x: (cur % MAP_W) + 0.5, y: ((cur / MAP_W) | 0) + 0.5 });
    cur = prev[cur];
    if (cur < 0) return [];
  }
  path.reverse();
  return path;
}
