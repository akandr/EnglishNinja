// The world of English Ninja: a winding road through five lands (a desert oasis, a jungle
// temple, a dungeon, a village at night, islands in the sky). Every stretch ends in an arena
// where creatures float with pictures; a magic barrier closes the way on. Pure data.

export const C = { BLOCK: 0, PATH: 1, PLAZA: 2, CLEAR: 4, WATER: 5, BAR: 7, BRIDGE: 8, RIVER: 9 };
export const H = 56;

// tile = [sheet, x, y] in 16 px tiles. Sheets: floor (TilesetFloor), ifloor (interior floors),
// kd / kt (Kenney Tiny Dungeon / Tiny Town), desert, village, towers, clouds.
export const BIOMES = [
  { id: 'oasis', name: 'Desert Oasis', bg: [['floor', 0, 5], ['floor', 1, 5], ['floor', 0, 5], ['floor', 2, 5]],
    path: [['ifloor', 1, 13], ['ifloor', 6, 13], ['ifloor', 7, 13]], river: 'water', water: true,
    wall: ['palm', 'palm', 'palm2', 'cactusBush'], small: ['tuft', 'shrub', 'bone', 'pots', 'skull'], houses: ['dome', 'tower', 'sandHouse', 'well', 'stall'],
    fx: 'sun', music: 'oasis', tint: 'rgba(255,170,60,0.08)', ground: '#e9a560',
    creatures: ['Flam', 'Lizard', 'Mollusc', 'Flam'], monster: 'Snake', animals: ['Cat', 'Parrot'],
    people: { m: ['Sultan', 'Sultan2'], f: ['Woman'] }, barrier: 38 },
  { id: 'temple', name: 'Jungle Temple', bg: [['floor', 11, 12], ['floor', 12, 12], ['floor', 13, 12], ['floor', 11, 12]],
    path: [['ifloor', 20, 6], ['ifloor', 20, 6], ['ifloor', 11, 11]], river: 'water',
    wall: ['bigTree', 'bigTree2', 'tree', 'tree'], small: ['bush', 'bush2', 'stones'], houses: ['statue', 'ruin', 'ruin2', 'greenTower', 'pillar'],
    fx: 'leaves', music: 'temple', tint: 'rgba(40,120,60,0.10)', ground: '#4f7a2e',
    creatures: ['Butterfly', 'Larva', 'Axolot', 'Butterfly'], monster: 'Mole', animals: ['Frog', 'Racoon'],
    people: { m: ['Shaman', 'Monk2'], f: ['Cavegirl'] }, barrier: 130 },
  { id: 'dungeon', name: 'The Dungeon', bg: 'dungeon', path: [['kd', 0, 4], ['kd', 1, 4], ['kd', 0, 4], ['kd', 2, 4]], river: 'chasm',
    wall: [], small: ['rubble', 'rubble2'], houses: ['gargoyle', 'fountain', 'tombs', 'barrel', 'pillarD', 'chests'],
    fx: 'dust', music: 'dungeon', tint: null, dark: 0.6, ground: '#5a2e24',
    creatures: ['Spirit', 'Eye', 'Skull', 'Spirit'], monster: 'Skull', animals: [],
    people: { m: ['Knight', 'KnightGold'], f: ['Princess'] }, barrier: 280 },
  { id: 'village', name: 'Village at Night', bg: [['kt', 0, 0], ['kt', 1, 0], ['kt', 0, 0], ['kt', 2, 0]],
    path: [['ifloor', 12, 12], ['ifloor', 16, 13], ['ifloor', 12, 12]], river: 'water', water: true,
    wall: ['pine', 'pine', 'pineY', 'grove'], small: ['shroom', 'bushT', 'flowers'], houses: ['houseBlue', 'houseRed', 'houseBlue', 'fence', 'well2'],
    fx: 'fireflies', music: 'village', tint: 'rgba(30,40,110,0.22)', dark: 0.5, ground: '#5c9c3a', lamps: true,
    creatures: ['LanternRed', 'LanternGreen', 'Owl', 'LanternRed'], monster: 'Eye', animals: ['Cat', 'Dog'],
    people: { m: ['Villager5', 'OldMan3'], f: ['OldWoman'] }, barrier: 55 },
  { id: 'sky', name: 'Sky Islands', bg: 'sky', path: [['ifloor', 20, 0], ['ifloor', 20, 0], ['ifloor', 11, 4]], river: 'gap',
    wall: ['cloudBig', 'cloudBig', 'cloudLong'], small: ['cloudDot'], houses: ['skyTower', 'crystal', 'crystal2', 'skyTower2'],
    fx: 'clouds', music: 'sky', tint: null, ground: '#8fd3ff',
    creatures: ['BlueBat', 'HeartRed', 'YellowsBat', 'BlueBat'], monster: 'YellowsBat', animals: [],
    people: { m: ['Master', 'SamuraiBlue'], f: ['EggGirl'] }, barrier: 200 },
];

// Decorations: s = sheet, r = [x, y, w, h] in tiles (fractions allowed); or parts of 16 px tiles.
const house = (rx, wall) => ({ s: 'kt', w: 3, h: 3, parts: [[rx, 4, 0, 0], [rx + 1, 4, 1, 0], [rx + 2, 4, 2, 0], [rx, 5, 0, 1], [rx + 1, 5, 1, 1], [rx + 2, 5, 2, 1], [wall, 7, 0, 2], [wall + 1, 7, 1, 2], [wall, 7, 2, 2]], lit: true });
export const DECOR = {
  // desert
  palm: { s: 'desert', r: [10, 10, 2, 2] }, palm2: { s: 'desert', r: [12, 10, 2, 2] }, cactusBush: { s: 'desert', r: [8, 10, 2, 2] },
  tuft: { s: 'desert', r: [8, 9, 1, 1] }, shrub: { s: 'desert', r: [9, 9, 1, 1] }, bone: { s: 'desert', r: [18.9, 11, 1.1, 1] },
  skull: { s: 'desert', r: [16, 10, 1, 1] }, pots: { s: 'desert', r: [6, 11, 2, 1] },
  dome: { s: 'desert', r: [0, 0, 2, 3] }, tower: { s: 'desert', r: [3.1, 0, 2.8, 4.3] }, sandHouse: { s: 'desert', r: [6, 0, 4, 3] },
  well: { s: 'desert', r: [0, 3, 2, 2] }, stall: { s: 'desert', r: [2, 10, 2, 2] },
  // jungle temple
  bigTree: { s: 'village', r: [0, 6.4, 3, 2.6] }, bigTree2: { s: 'village', r: [0, 9.3, 3, 2.6] }, tree: { s: 'village', r: [4, 6.3, 2, 1.8] },
  bush: { s: 'village', r: [4, 5, 1, 1] }, bush2: { s: 'village', r: [5, 5, 1, 1] }, stones: { s: 'village', r: [7.3, 3.3, 3.5, 1.6] },
  statue: { s: 'village', r: [0.3, 3.3, 1.6, 2.6] }, ruin: { s: 'village', r: [0, 0.5, 3.4, 2.5] }, ruin2: { s: 'village', r: [8.5, 0.6, 3, 2.4] },
  pillar: { s: 'village', r: [2.4, 3.6, 1.2, 2.4] }, greenTower: { s: 'towers', r: [12, 2, 2, 2] },
  // dungeon (Kenney Tiny Dungeon)
  rubble: { s: 'kd', r: [0, 1, 1, 1] }, rubble2: { s: 'kd', r: [0, 2, 1, 1] },
  gargoyle: { s: 'kd', r: [7, 1, 1, 2] }, fountain: { s: 'kd', r: [8, 1, 1, 2] }, tombs: { s: 'kd', r: [4, 5, 2, 1] },
  barrel: { s: 'kd', r: [6, 5, 1, 1] }, pillarD: { s: 'kd', r: [6, 1, 1, 2] }, chests: { s: 'kd', r: [5, 7, 2, 1] },
  // village at night (Kenney Tiny Town)
  pine: { s: 'kt', r: [4, 0, 1, 2] }, pineY: { s: 'kt', r: [3, 0, 1, 2] }, grove: { s: 'kt', r: [6, 0, 3, 3] },
  shroom: { s: 'kt', r: [5, 2, 1, 1] }, bushT: { s: 'kt', r: [5, 0, 1, 1] }, flowers: { s: 'kt', r: [2, 0, 1, 1] },
  houseBlue: house(0, 0), houseRed: house(4, 4), fence: { s: 'kt', r: [8, 6, 3, 1] }, well2: { s: 'kt', r: [11, 6, 1, 1] },
  // sky
  cloudBig: { s: 'clouds', r: [0, 0, 3, 3] }, cloudLong: { s: 'clouds', r: [0, 3, 3, 1] }, cloudDot: { s: 'clouds', r: [3, 3, 1, 1] },
  skyTower: { s: 'towers', r: [12, 0, 2, 2] }, skyTower2: { s: 'towers', r: [12, 4, 2, 2] },
  crystal: { s: 'towers', r: [18, 4, 2, 2] }, crystal2: { s: 'towers', r: [20, 4, 2, 2] },
};

const rnd = (a, b) => a + Math.random() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cellsOf = (d) => d.parts ? [d.w, d.h] : [Math.ceil(d.r[2] - 0.05), Math.ceil(d.r[3] - 0.05)];

export function buildWorld(questions, { monsters: withMonsters = false } = {}) {
  const n = questions.length;
  const W = 60 + n * 160;
  const cells = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? C.BLOCK : cells[y * W + x];
  const set = (x, y, v) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) cells[y * W + x] = v; };
  const carve = (x, y, v = C.PATH) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === C.BLOCK) set(x + dx, y + dy, v); };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };

  let cx = 9, cy = Math.floor(H / 2);
  rect(3, cy - 3, 9, cy + 3, C.CLEAR);                       // the start clearing
  const start = { x: 6, y: cy };
  const gates = [], npcs = [], biomeX = [0];
  const gems = [], rivers = [], runs = [];
  for (let q = 0; q < n; q++) {
    let steps = 0, horiz = true, npcDone = false, river = false;
    while (steps < 95 || !npcDone) {
      if (horiz) {
        const len = ri(8, 15), x0 = cx;
        for (let i = 0; i < len; i++) carve(++cx, cy);
        runs.push({ h: true, x0, x1: cx, y: cy, q, s: steps });
        if (!river && steps > 12 && len >= 11 && Math.random() < 0.7) {        // a river (or a chasm) across this run, with a bridge
          river = true;
          const xr = ri(x0 + 3, cx - 6), wr = ri(3, 4);
          for (let y = 1; y < H - 1; y++) {
            const wig = Math.abs(y - cy) <= 2 ? 0 : Math.round(Math.sin(y * 0.35 + q) * 1.6);
            for (let k = 0; k < wr; k++) {
              const x = xr + k + wig, v = at(x, y);
              if (v === C.PATH) set(x, y, C.BRIDGE); else if (v === C.BLOCK) set(x, y, C.RIVER);
            }
          }
          rivers.push({ x: xr, w: wr });
        } else if (Math.random() < 0.55 && cx - x0 >= 9) {                       // a side spur with a crystal at the end
          const sx = ri(x0 + 2, cx - 3), dir = cy < H / 2 ? 1 : -1, len2 = ri(4, 7);
          let ok = true;
          for (let i = 2; i <= len2 + 1; i++) for (let dx = -1; dx <= 1; dx++) if (at(sx + dx, cy + dir * i) !== C.BLOCK) ok = false;
          if (ok && cy + dir * (len2 + 2) > 2 && cy + dir * (len2 + 2) < H - 3) {
            for (let i = 1; i <= len2; i++) carve(sx, cy + dir * i);
            gems.push({ x: sx, y: cy + dir * len2, taken: false, q });
          }
        }
        steps += len;
      } else {
        let dir = Math.random() < 0.5 ? -1 : 1; const len = ri(5, 10);
        if (cy + dir * len < 9 || cy + dir * len > H - 10) dir = -dir;
        const y0 = cy;
        for (let i = 0; i < len; i++) { cy += dir; carve(cx, cy); }
        runs.push({ h: false, x: cx, y0: Math.min(y0, cy), y1: Math.max(y0, cy), q, s: steps });
        steps += len;
      }
      horiz = !horiz;
      if (!npcDone && steps >= 40 && horiz) {                                  // the storyteller's clearing, beside the path
        const side = cy < H / 2 ? 1 : -1, ox = cx, oy = cy + side * 3;
        rect(ox - 2, Math.min(oy, oy + side * 2) - 1, ox + 2, Math.max(oy, oy + side * 2) + 1, C.CLEAR);
        npcs.push({ x: ox, y: oy + side * 1, q });
        npcDone = true;
      }
    }
    for (let i = 0; i < 4; i++) carve(++cx, cy);
    // the arena: a wide open floor, creatures float in its far half; a barrier closes the way out
    const px = cx + 1;
    rect(px, cy - 5, px + 12, cy + 5, C.PLAZA);
    const bars = [];
    for (let y = cy - 1; y <= cy + 1; y++) { set(px + 13, y, C.BAR); bars.push({ x: px + 13, y }); }
    const spots = [[px + 7.5, cy - 3.2], [px + 10.3, cy - 1.1], [px + 10.3, cy + 1.9], [px + 7.5, cy + 4.0]].map(([x, y]) => ({ x, y }));
    gates.push({ q, plaza: { x0: px, y0: cy - 5, x1: px + 12, y1: cy + 5 }, bars, spots, center: { x: px + 6, y: cy } });
    cx = px + 13;
    if (q % 2 === 1) biomeX.push(cx + 1);                       // a new land every two arenas
  }
  // the treasure clearing at the end
  for (let i = 0; i < 6; i++) carve(++cx, cy);
  rect(cx + 1, cy - 4, cx + 9, cy + 4, C.CLEAR);
  const chest = { x: cx + 5, y: cy };

  const near = (x, y, d) => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const v = at(x + dx, y + dy); if (v !== C.BLOCK && v !== C.WATER && v !== C.RIVER) return true; } return false; };
  const biomeOf = (x) => { let b = 0; for (let i = 0; i < biomeX.length; i++) if (x >= biomeX[i]) b = i; return b % BIOMES.length; };
  // oasis ponds (and village ponds), kept away from the path
  for (let k = 0; k < W / 6; k++) {
    const x = ri(4, W - 5), y = ri(3, H - 4);
    if (!BIOMES[biomeOf(x)].water || near(x, y, 4)) continue;
    const r = ri(2, 4);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) if (dx * dx / ((r + 1) * (r + 1)) + dy * dy / (r * r) <= 1 && !near(x + dx, y + dy, 2)) set(x + dx, y + dy, C.WATER);
  }

  // decorations: the land's trees/clouds hugging the path, buildings near arenas and storytellers
  const decor = [], taken = new Uint8Array(W * H);
  const free = (x, y, w, h) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { if (at(x + dx, y + dy) !== C.BLOCK || taken[(y + dy) * W + x + dx]) return false; } return true; };
  const place = (name, x, y, margin = 0) => {
    const d = DECOR[name]; if (!d) return false;
    const [w, h] = cellsOf(d);
    if (!free(x - margin, y - margin, w + 2 * margin, h + 2 * margin)) return false;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) taken[(y + dy) * W + x + dx] = 1;
    decor.push({ name, x, y, w, h }); return true;
  };
  const spots = [...gates.map(g => ({ x: g.center.x, y: g.center.y, r: 8 })), ...npcs.map(p => ({ x: p.x, y: p.y, r: 5 }))];
  for (const sp of spots) {
    const b = BIOMES[biomeOf(sp.x)];
    let m = ri(2, 4);
    for (let k = 0; k < 60 && m > 0; k++) {
      const x = sp.x + ri(-sp.r - 4, sp.r), y = sp.y + ri(-sp.r - 3, sp.r);
      if (near(x, y, 0) || !near(x, y, 3)) continue;
      if (place(pick(b.houses), x, y, 1)) m--;
    }
  }
  const lamps = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (at(x, y) !== C.BLOCK) continue;
    const b = BIOMES[biomeOf(x)];
    if (near(x, y, 2)) { if (b.wall.length && Math.random() < 0.5) place(pick(b.wall), x, y); else if (b.id === 'dungeon' && Math.random() < 0.04) place(pick(b.houses), x, y); }
    else if (Math.random() < 0.05) place(pick(b.small), x, y);
    else if (b.wall.length && Math.random() < 0.012) place(pick(b.wall), x, y);
  }
  // lamp posts along the village road, torches on the dungeon walls
  for (let x = 2; x < W - 2; x += 1) for (let y = 2; y < H - 2; y++) {
    const b = BIOMES[biomeOf(x)];
    if (!(b.lamps || b.id === 'dungeon') || at(x, y) !== C.BLOCK || taken[y * W + x]) continue;
    const below = at(x, y + 1);
    if ((below === C.PATH || below === C.PLAZA) && Math.random() < (b.lamps ? 0.09 : 0.12) && !lamps.some(l => Math.abs(l.x - x) + Math.abs(l.y - y) < 6)) {
      lamps.push({ x, y, kind: b.lamps ? 'lamp' : 'torch' }); taken[y * W + x] = 1;
    }
  }

  // monsters (optional): each walks to and fro along one edge of the three-wide path, never the middle
  const monsters = [], items = [];
  const clearOf = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const v = at(x + dx, y + dy); if (v === C.CLEAR || v === C.PLAZA || v === C.BRIDGE || v === C.RIVER) return false; } return true; };
  if (withMonsters) {
    for (let q = 0; q < n; q++) {
      const mine = runs.filter(r => r.q === q && r.s > 6 && (r.h ? r.x1 - r.x0 >= 10 : r.y1 - r.y0 >= 7));
      let count = 0;
      for (const r of mine.sort(() => Math.random() - 0.5)) {
        if (count >= (q === 0 ? 1 : 2)) break;
        let a, b2;
        if (r.h) { const side = r.y < H / 2 ? -1 : 1; a = { x: r.x0 + 3, y: r.y + side }; b2 = { x: r.x1 - 3, y: r.y + side }; }
        else { const side = Math.random() < 0.5 ? -1 : 1; a = { x: r.x + side, y: r.y0 + 2 }; b2 = { x: r.x + side, y: r.y1 - 2 }; }
        let ok = true;
        for (let t = 0; t <= 1; t += 0.1) { const x = Math.round(a.x + (b2.x - a.x) * t), y = Math.round(a.y + (b2.y - a.y) * t); if (at(x, y) !== C.PATH || !clearOf(x, y)) ok = false; }
        if (!ok || gems.some(gm => Math.abs(gm.x - a.x) + Math.abs(gm.y - a.y) < 4 || Math.abs(gm.x - b2.x) + Math.abs(gm.y - b2.y) < 4)) continue;
        count++;
        monsters.push({ a, b: b2, kind: BIOMES[biomeOf(a.x)].monster, q, s: r.s });
      }
    }
  }
  // a magnet now and then: pulls the crystals out of the side spurs for a while
  for (let q = 1; q < n; q += 3) {
    const r = runs.find(o => o.q === q && o.h && o.s > 4 && o.x1 - o.x0 >= 8);
    if (!r) continue;
    const x = r.x0 + 2, y = r.y;
    if (at(x, y) === C.PATH) items.push({ x, y, kind: 'magnet', taken: false });
  }

  return { W, H, cells, at, set, start, gates, npcs, chest, decor, biomeOf, biomeX, gems, rivers, monsters, items, lamps };
}
