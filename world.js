// The world of Liczbowy Ninja: a winding path through five lands, with a plaza and a gate of
// four number stones at the end of every stretch, and a rest clearing with a storyteller in the
// middle of it. Pure data: cells, gates, characters, decorations.

export const C = { BLOCK: 0, PATH: 1, PLAZA: 2, LANE: 3, CLEAR: 4, WATER: 5, PAD: 6, BAR: 7, BRIDGE: 8, RIVER: 9 };
export const H = 56;

// Lands: floor tiles (16px coordinates in TilesetFloor), decorations (TilesetNature), effects, music.
export const BIOMES = [
  { id: 'meadow', name: 'Zielona Łąka', bg: [[0, 12], [0, 12], [3, 11], [4, 12]], path: [[12, 8], [14, 11], [12, 8]],
    wall: ['tree', 'round', 'oak', 'bigGreen', 'tree'], small: ['bush', 'bush2', 'tuft', 'tuft2', 'flowerY', 'flowerR', 'flowerW', 'clover'],
    fx: 'butterflies', music: 'peaceful', tint: null, animals: ['Cat', 'Dog', 'Frog', 'Chicken', 'Pig', 'Cow'],
    monster: 'Slime', houses: ['hA', 'hC', 'straw'], art: 'sunflower' },
  { id: 'sakura', name: 'Wiśniowy Ogród', bg: [[11, 12], [11, 12], [15, 12], [13, 12]], path: [[11, 5], [15, 5], [11, 5]],
    wall: ['pink', 'bigPink', 'pink', 'roundY'], small: ['flowerR', 'flowerW', 'tuft', 'bush'],
    fx: 'petals', music: 'sunny', tint: 'rgba(255,190,220,0.08)', animals: ['Cat', 'Hamster', 'Chicken'],
    monster: 'Bamboo', houses: ['hR', 'torii', 'hB'], art: 'blossom' },
  { id: 'beach', name: 'Złota Plaża', bg: [[1, 1], [1, 1], [0, 4], [12, 1]], path: [[11, 19], [13, 19], [11, 19]],
    wall: ['rockB', 'rockB', 'roundY', 'rockG'], small: ['bushO', 'tuft', 'pebble', 'crystal'],
    fx: 'sun', music: 'adventure', tint: 'rgba(255,220,150,0.07)', water: true, animals: ['Frog', 'Racoon', 'Parrot'],
    monster: 'Octopus', houses: ['hut', 'straw'], art: 'shell' },
  { id: 'snow', name: 'Śnieżne Góry', bg: [[1, 15], [1, 15], [1, 15], [3, 18]], path: [[1, 22], [1, 22], [5, 22]],
    wall: ['snowPine', 'snowPine2', 'snowTree', 'bigWhite'], small: ['iceRock', 'iceRock2', 'snowball'],
    fx: 'snow', music: 'chill', tint: 'rgba(200,225,255,0.10)', animals: ['Hamster'],
    monster: 'Spirit2', houses: ['igloo', 'igloo3'], art: 'flake' },
  { id: 'autumn', name: 'Jesienny Las o Zmroku', bg: [[11, 19], [11, 19], [11, 19], [13, 19]], path: [[12, 22], [12, 22], [12, 22]],
    wall: ['dead', 'bigAutumn', 'pine', 'dead'], small: ['stump', 'bushO', 'tuft', 'bushO2'],
    fx: 'fireflies', music: 'mystical', tint: 'rgba(40,20,80,0.28)', animals: ['Racoon', 'Cat'],
    monster: 'Mushroom', houses: ['hut', 'hB'], art: 'shroom' },
];

// Decorations in TilesetNature (x, y, w, h in 16px tiles).
export const DECOR = {
  tree: [0, 0, 2, 2], pine: [2, 0, 2, 2], dead: [4, 0, 2, 2], oak: [6, 0, 2, 2], snowPine: [8, 0, 2, 2], snowPine2: [10, 0, 2, 2],
  snowTree: [12, 0, 2, 2], pink: [14, 0, 2, 2], round: [16, 0, 2, 2], roundY: [18, 0, 2, 2],
  bigPink: [0, 18, 3, 3], bigGreen: [3, 18, 3, 3], bigWhite: [6, 18, 3, 3], bigAutumn: [9, 18, 3, 3],
  rockB: [13, 8, 2, 2], rockG: [17, 8, 2, 2],
  bush: [0, 10, 1, 1], bush2: [1, 10, 1, 1], tuft: [4, 10, 1, 1], tuft2: [5, 10, 1, 1], flowerY: [0, 11, 1, 1], flowerR: [3, 11, 1, 1],
  flowerW: [6, 11, 1, 1], clover: [2, 11, 1, 1], bushO: [9, 8, 1, 1], bushO2: [9, 9, 1, 1], pebble: [15, 9, 1, 1], crystal: [1, 14, 1, 1],
  iceRock: [4, 12, 1, 1], iceRock2: [5, 12, 1, 1], snowball: [10, 12, 1, 1], stump: [8, 8, 1, 1],
};

// Buildings in TilesetHouse (x, y, w, h in pixels).
export const HOUSES = {
  hA: [0, 0, 64, 48], hB: [64, 0, 64, 48], hC: [128, 0, 64, 48], hR: [192, 0, 64, 48], igloo: [0, 176, 48, 46], igloo3: [96, 176, 48, 46],
  torii: [7, 82, 34, 29], hut: [3, 120, 42, 39], straw: [48, 128, 47, 32],
};

const rnd = (a, b) => a + Math.random() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function buildWorld(questions, { monsters: withMonsters = false } = {}) {
  const n = questions.length;
  const W = 60 + n * 175;
  const cells = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? C.BLOCK : cells[y * W + x];
  const set = (x, y, v) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) cells[y * W + x] = v; };
  const carve = (x, y, v = C.PATH) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === C.BLOCK) set(x + dx, y + dy, v); };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };

  let cx = 9, cy = Math.floor(H / 2);
  rect(3, cy - 3, 9, cy + 3, C.PLAZA);                       // the start clearing
  const start = { x: 6, y: cy };
  const gates = [], npcs = [], biomeX = [0];

  const gems = [], rivers = [], runs = [];
  for (let q = 0; q < n; q++) {
    // a long winding stretch (~110 tiles): after the answer has been read (Polish and English)
    // comes a storyteller around tile 50, then a good walk to the next plaza; rivers with bridges
    // cross it and side spurs hide crystals
    let steps = 0, horiz = true, npcDone = false, river = false;
    while (steps < 115 || !npcDone) {
      if (horiz) {
        const len = ri(9, 17), x0 = cx;
        for (let i = 0; i < len; i++) carve(++cx, cy);
        runs.push({ h: true, x0, x1: cx, y: cy, q, s: steps });
        if (!river && steps > 12 && len >= 11 && Math.random() < 0.75) {        // a river across this run, with a bridge
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
          for (let i = 2; i <= len2 + 1; i++) for (let dx = -1; dx <= 1; dx++) if (at(sx + dx, cy + dir * i) !== C.BLOCK && Math.abs(i) > 1) ok = false;
          if (ok && cy + dir * (len2 + 2) > 2 && cy + dir * (len2 + 2) < H - 3) {
            for (let i = 1; i <= len2; i++) carve(sx, cy + dir * i);
            gems.push({ x: sx, y: cy + dir * len2, taken: false, q });
          }
        }
        steps += len;
      } else {
        let dir = Math.random() < 0.5 ? -1 : 1; const len = ri(5, 10);
        if (cy + dir * len < 7 || cy + dir * len > H - 8) dir = -dir;
        const y0 = cy;
        for (let i = 0; i < len; i++) { cy += dir; carve(cx, cy); }
        runs.push({ h: false, x: cx, y0: Math.min(y0, cy), y1: Math.max(y0, cy), q, s: steps });
        steps += len;
      }
      horiz = !horiz;
      if (!npcDone && steps >= 48 && horiz) {                                  // the storyteller's clearing, beside the path
        const side = cy < H / 2 ? 1 : -1, ox = cx, oy = cy + side * 3;
        rect(ox - 2, Math.min(oy, oy + side * 2) - 1, ox + 2, Math.max(oy, oy + side * 2) + 1, C.CLEAR);
        npcs.push({ x: ox, y: oy + side * 1, q });
        npcDone = true;
      }
    }
    for (let i = 0; i < 4; i++) carve(++cx, cy);
    // the plaza and its gate: four lanes, each starting with a number stone and closed by a bar
    const px = cx + 1;
    rect(px, cy - 4, px + 8, cy + 4, C.PLAZA);
    const lanes = [cy - 3, cy - 1, cy + 1, cy + 3];
    const pads = [], bars = [];
    for (const ly of lanes) {
      set(px + 9, ly, C.PAD); set(px + 10, ly, C.LANE); set(px + 11, ly, C.BAR);
      pads.push({ x: px + 9, y: ly }); bars.push({ x: px + 11, y: ly });
    }
    rect(px + 12, cy - 3, px + 12, cy + 3, C.PATH);
    gates.push({ q, plaza: { x0: px, y0: cy - 4, x1: px + 8, y1: cy + 4 }, pads, bars, center: { x: px + 4, y: cy } });
    cx = px + 12;
    if (q % 2 === 1) biomeX.push(cx);                           // a new land every two questions
  }
  // the treasure clearing at the end
  for (let i = 0; i < 6; i++) carve(++cx, cy);
  rect(cx + 1, cy - 4, cx + 9, cy + 4, C.PLAZA);
  const chest = { x: cx + 5, y: cy };

  // water ponds on the beach, kept away from the path
  const near = (x, y, d) => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const v = at(x + dx, y + dy); if (v !== C.BLOCK && v !== C.WATER && v !== C.RIVER) return true; } return false; };
  const biomeOf = (x) => { let b = 0; for (let i = 0; i < biomeX.length; i++) if (x >= biomeX[i]) b = i; return b % BIOMES.length; };
  for (let k = 0; k < W / 6; k++) {
    const x = ri(4, W - 5), y = ri(3, H - 4);
    if ((!BIOMES[biomeOf(x)].water && Math.random() < 0.6) || near(x, y, 4)) continue;
    const r = ri(2, 4);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) if (dx * dx / ((r + 1) * (r + 1)) + dy * dy / (r * r) <= 1 && !near(x + dx, y + dy, 2)) set(x + dx, y + dy, C.WATER);
  }

  // decorations: big trees/rocks hugging the path (they form the walls), small things further out
  const decor = [], taken = new Uint8Array(W * H);
  const free = (x, y, w, h) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { if (at(x + dx, y + dy) !== C.BLOCK || taken[(y + dy) * W + x + dx]) return false; } return true; };
  const place = (name, x, y) => {
    const [, , w, h] = DECOR[name];
    if (!free(x, y, w, h)) return false;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) taken[(y + dy) * W + x + dx] = 1;
    decor.push({ name, x, y, w, h }); return true;
  };
  // little settlements beside the plazas and the storytellers' clearings: houses of the land
  const placeHouse = (name, x, y) => {
    const [, , pw, ph] = HOUSES[name], w = Math.ceil(pw / 16), h = Math.ceil(ph / 16);
    if (!free(x - 1, y - 1, w + 2, h + 2)) return false;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) taken[(y + dy) * W + x + dx] = 1;
    decor.push({ house: name, x, y, w, h }); return true;
  };
  const spots = [...gates.map(g => ({ x: g.center.x, y: g.center.y, r: 7 })), ...npcs.map(p => ({ x: p.x, y: p.y, r: 5 }))];
  for (const sp of spots) {
    const b = BIOMES[biomeOf(sp.x)];
    let n = ri(1, 3);
    for (let k = 0; k < 40 && n > 0; k++) {
      const x = sp.x + ri(-sp.r - 4, sp.r), y = sp.y + ri(-sp.r - 3, sp.r);
      if (near(x, y, 0) || !near(x, y, 3)) continue;               // off the path, but in sight of it
      if (placeHouse(pick(b.houses), x, y)) n--;
    }
  }
  // generative bits of nature with a pattern in them: sunflowers (the golden angle), cherry blossom
  // (five petals), sea shells (a spiral), snowflakes (six arms), glowing mushroom rings
  const art = [];
  for (let k = 0; k < W / 5; k++) {
    const x = ri(3, W - 4), y = ri(2, H - 3);
    if (near(x, y, 0) || !near(x, y, 4) || taken[y * W + x] || at(x, y) !== C.BLOCK) continue;
    taken[y * W + x] = 1;
    art.push({ kind: BIOMES[biomeOf(x)].art, x, y, seed: Math.random() * 1000 });
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (at(x, y) !== C.BLOCK) continue;
    const b = BIOMES[biomeOf(x)];
    if (near(x, y, 2)) { if (Math.random() < 0.55) place(pick(b.wall), x, y); }
    else if (Math.random() < 0.05) place(pick(b.small), x, y);
    else if (Math.random() < 0.012) place(pick(b.wall), x, y);
  }
  // the gaps between the four lanes get rocks so the lanes read as separate
  for (const g of gates) for (const ly of [g.center.y - 2, g.center.y, g.center.y + 2]) for (let x = g.plaza.x1 + 1; x <= g.plaza.x1 + 3; x++) place(BIOMES[biomeOf(x)].id === 'snow' ? 'iceRock' : 'pebble', x, ly);

  // monsters (optional): each walks to and fro along one edge of the three-wide path, never the middle,
  // so there is always a safe way past; a coin lies on the path before them
  const monsters = [], items = [];
  const clearOf = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const v = at(x + dx, y + dy); if (v === C.CLEAR || v === C.PLAZA || v === C.BRIDGE || v === C.RIVER) return false; } return true; };
  if (withMonsters) {
    for (let q = 0; q < n; q++) {
      const mine = runs.filter(r => r.q === q && r.s > 6 && (r.h ? r.x1 - r.x0 >= 10 : r.y1 - r.y0 >= 7));
      const chosen = [];
      for (const r of mine.sort(() => Math.random() - 0.5)) {
        if (chosen.length >= (q === 0 ? 1 : 2)) break;
        let a, b2;
        if (r.h) { const side = r.y < H / 2 ? -1 : 1; a = { x: r.x0 + 3, y: r.y + side }; b2 = { x: r.x1 - 3, y: r.y + side }; }
        else { const side = Math.random() < 0.5 ? -1 : 1; a = { x: r.x + side, y: r.y0 + 2 }; b2 = { x: r.x + side, y: r.y1 - 2 }; }
        let ok = true;
        for (let t = 0; t <= 1; t += 0.1) { const x = Math.round(a.x + (b2.x - a.x) * t), y = Math.round(a.y + (b2.y - a.y) * t); if (at(x, y) !== C.PATH || !clearOf(x, y)) ok = false; }
        if (!ok || gems.some(gm => Math.abs(gm.x - a.x) + Math.abs(gm.y - a.y) < 4 || Math.abs(gm.x - b2.x) + Math.abs(gm.y - b2.y) < 4)) continue;
        chosen.push(r);
        monsters.push({ a, b: b2, kind: BIOMES[biomeOf(a.x)].monster, q, s: r.s });
      }
      // a coin before (almost) every monster, on the middle of the run leading to it
      for (const m of monsters.filter(o => o.q === q)) {
        const prev = runs.filter(r => r.q === q && r.s < m.s).pop();
        if (!prev) continue;
        const x = prev.h ? Math.round((prev.x0 + prev.x1) / 2) : prev.x, y = prev.h ? prev.y : Math.round((prev.y0 + prev.y1) / 2);
        if (at(x, y) === C.PATH && clearOf(x, y) && !items.some(it => Math.abs(it.x - x) + Math.abs(it.y - y) < 6)) items.push({ x, y, kind: 'power', taken: false });
      }
    }
  }
  // a rarer magnet: pulls the crystals out of the side spurs for a while
  for (let q = 1; q < n; q += 3) {
    const r = runs.find(o => o.q === q && o.h && o.s > 4 && o.x1 - o.x0 >= 8);
    if (!r) continue;
    const x = r.x0 + 2, y = r.y;
    if (at(x, y) === C.PATH && !items.some(it => Math.abs(it.x - x) + Math.abs(it.y - y) < 4)) items.push({ x, y, kind: 'magnet', taken: false });
  }

  return { W, H, cells, at, set, start, gates, npcs, chest, decor, biomeOf, biomeX, gems, rivers, monsters, items, art };
}
