// English Ninja — a 2D cousin of English Sonic: walk a winding path through five lands; at
// every gate a voice names a thing in English and the hero steps on the stone with its
// picture. Storytellers on the way say simple things in English (Polish captions). No timer;
// monsters only if chosen (and always avoidable).

import { loadAudioBuffer } from './audio.js?v=126';
// own version for this game's audio: the number clips once had the same names with another voice,
// and browsers keep audio for weeks
const AUDIO_VER = 'en20261120a';
import { buildWorld, BIOMES, DECOR, HOUSES, C, H } from './world.js?v=126';
import * as W from './words.js?v=126';

const TS = 16, SC = 3, T = TS * SC;                 // tiles: 16 px drawn at 3x
const TILES_PER_S = 5.2;                          // walking speed, tiles per second
const R = T * 0.32;                                 // the hero's collision radius
const STAND_S = 0.5;                                // standing on a stone this long = an answer
const el = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);

// --- images ---------------------------------------------------------------
const IMG = {};
const loadImg = (k, src) => new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => res(); i.src = src; });
async function loadImages() {
  const A = new URL('./assets/', import.meta.url).href;
  const list = [['floor', 'TilesetFloor.png'], ['nature', 'TilesetNature.png'], ['water', 'TilesetWater.png'],
    ['leaf', 'fx/Leaf.png'], ['leafPink', 'fx/LeafPink.png'], ['snow', 'fx/Snow.png'], ['spark', 'fx/Spark.png'],
    ['fog', 'fx/Fog.png'], ['ray', 'fx/Raylight.png'], ['ripples', 'fx/ripples.png'], ['flowers', 'fx/flower_anim.png']];
  for (const c of ['NinjaGreen', 'Princess', 'OldMan', 'OldWoman', 'Villager3', 'Villager4', 'Monk', 'Eskimo', 'Boy', 'Hunter', 'EggGirl', 'Noble', 'Inspector'])
    list.push(['c_' + c, `chars/${c}.png`]);
  for (const a of ['Cat', 'Dog', 'Frog', 'Hamster', 'Racoon', 'Chicken', 'Pig', 'Cow', 'Parrot', 'Fish']) list.push(['a_' + a, `animals/${a}.png`]);
  for (const m of ['Slime', 'Bamboo', 'Octopus', 'Spirit2', 'Mushroom']) list.push(['m_' + m, `monsters/${m}.png`]);
  list.push(['coin', 'items/coin.png'], ['house', 'deco/house.png'], ['flag', 'deco/flag.png']);
  await Promise.all(list.map(([k, f]) => loadImg(k, A + f)));
}

// --- audio: one voice at a time, with pauses (same rules as Liczbowy Sonic) -----------------
let actx = null, master = null, musicGain = null, musicSrc = null, muted = false;
const clips = new Map(), music = new Map();
function ctx() {
  if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); master = actx.createGain(); master.connect(actx.destination); musicGain = actx.createGain(); musicGain.gain.value = 0.18; musicGain.connect(master); }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
async function loadClip(name, base) {
  if (clips.has(name)) return true;
  const r = await loadAudioBuffer(ctx(), base + name, AUDIO_VER);
  if (r.buffer) clips.set(name, r.buffer);
  return !!r.buffer;
}
let playing = [];
function speak(names, gap = 0.12) {
  const c = ctx(); if (!c || muted) return 0;
  for (const s of playing) try { s.stop(); } catch (_) {}
  playing = [];
  let t = c.currentTime + 0.05; const t0 = t;
  for (const n of names) { const b = clips.get(n); if (!b) continue; const s = c.createBufferSource(); s.buffer = b; s.connect(master); s.start(t); playing.push(s); t += b.duration + gap; }
  return (t - t0) * 1000;
}
function sfx(name, vol = 0.5) {
  const c = ctx(), b = clips.get(name); if (!c || !b || muted) return;
  const g = c.createGain(); g.gain.value = vol; g.connect(master);
  const s = c.createBufferSource(); s.buffer = b; s.connect(g); s.start();
}
function playMusic(name) {
  const c = ctx(), b = music.get(name); if (!c || !b) return;
  if (musicSrc && musicSrc._name === name) return;
  const old = musicSrc;
  if (old) { try { old._g.gain.linearRampToValueAtTime(0, c.currentTime + 1.5); old.stop(c.currentTime + 1.6); } catch (_) {} }
  const g = c.createGain(); g.gain.value = 0; g.connect(musicGain); g.gain.linearRampToValueAtTime(1, c.currentTime + 2);
  const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(g); s.start(); s._g = g; s._name = name; musicSrc = s;
}
const queue = [];
let speakingUntil = 0, qTimer = null;
function pump() {
  if (qTimer || !queue.length) return;
  qTimer = setTimeout(() => {
    qTimer = null; if (!running) { queue.length = 0; return; }
    const it = queue.shift(), ms = speak(it.clips);
    speakingUntil = performance.now() + ms + it.gap;
    if (it.onStart) it.onStart(ms);
    pump();
  }, Math.max(0, speakingUntil - performance.now()));
}
const enqueue = (it) => { queue.push(it); pump(); };
const dropLow = () => { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].low) queue.splice(i, 1); };
const voiceFree = () => !qTimer && !queue.length && performance.now() > speakingUntil;

// --- state -------------------------------------------------------------------
let canvas, g, world, cfg, qs, running = false, paused = false, lastT = 0, onEnd = null;
let hero, cam = { x: 0, y: 0 }, qi = 0, activeGate = -1, mistakes = 0, firstTry = 0, qMistakes = 0, finishT = -1, clock = 0;
let cooldown = 0, gemsTaken = 0;
// monsters (optional) & power-ups: a coin makes the monsters edible for a while, a magnet pulls the
// crystals out of the side spurs
const POWER_S = 12, MAGNET_S = 20, MON_TPS = 1.5;
let mons = [], poweredLeft = 0, magnetLeft = 0, invuln = 0, trail = [], eaten = 0, hits = 0;
let birds = [], fish = [], birdT = 6;
// five kinds of crystal; the counter keeps one tally per colour
const GEMS = [{ h: 350, l: 58 }, { h: 42, l: 58 }, { h: 140, l: 48 }, { h: 205, l: 55 }, { h: 280, l: 60 }];
let gemCounts = [0, 0, 0, 0, 0];
let chunks = new Map(), npcs = [], animals = [], parts = [], pads = [], facts = [], heard = [];
const keys = {}, stick = { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0 };

export async function initGame({ levelEnd }) {
  onEnd = levelEnd;
  canvas = el('canvas'); g = canvas.getContext('2d');
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; g.imageSmoothingEnabled = false; };
  resize(); window.addEventListener('resize', resize);
  const map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  window.addEventListener('keydown', e => { if (map[e.code]) { keys[map[e.code]] = true; e.preventDefault(); } if (e.code === 'Space') { repeatQuestion(); e.preventDefault(); } if (e.code === 'KeyP') togglePause(); });
  window.addEventListener('keyup', e => { if (map[e.code]) keys[map[e.code]] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // touch: drag anywhere = joystick
  canvas.addEventListener('pointerdown', e => { stick.active = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; });
  canvas.addEventListener('pointermove', e => { if (!stick.active || e.pointerId !== stick.id) return; const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy); const k = Math.min(1, l / 50) / (l || 1); stick.x = dx * k; stick.y = dy * k; });
  const up = (e) => { if (e.pointerId === stick.id) { stick.active = false; stick.x = stick.y = 0; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  el('say-btn').addEventListener('click', repeatQuestion);
  el('pause-btn').addEventListener('click', togglePause);
  el('mute-btn').addEventListener('click', () => { muted = !muted; if (master) master.gain.value = muted ? 0 : 1; el('mute-btn').textContent = muted ? '🔇' : '🔊'; });
}

function togglePause() { if (!running) return; paused = !paused; el('pause-box').classList.toggle('hidden', !paused); }
export function stopGame() { running = false; queue.length = 0; clearTimeout(qTimer); qTimer = null; speak([]); if (musicSrc) { try { musicSrc.stop(); } catch (_) {} musicSrc = null; } }

export async function startGame(c) {
  cfg = c;
  const overlay = el('loading-overlay'), fill = el('loading-fill'), text = el('loading-text');
  overlay.classList.remove('hidden'); el('loading-play-btn').classList.add('hidden');
  ctx();
  text.textContent = 'Ładowanie głosów i muzyki…'; fill.style.width = '0%';
  const AU = new URL('./audio/', import.meta.url).href, SFX = new URL('./assets/sfx/', import.meta.url).href, MU = new URL('./assets/music/', import.meta.url).href;
  if (!facts.length) facts = (await (await fetch(new URL('./facts.json?v=' + AUDIO_VER, import.meta.url))).json());
  await W.loadVocab();
  const cat = c.cat === 'mix' ? { opts: 4 } : W.catById(c.cat);
  qs = W.pickRound(c.cat, 10).map(id => ({ id, options: [id, ...W.distractors(id, 3)].sort(() => Math.random() - 0.5), variant: Math.random() < 0.6 ? 1 : 2 }));
  const all = [...new Set(qs.flatMap(q => q.options))];
  const names = [...W.COMMON_CLIPS, ...W.roundClips(qs)];
  let done = 0; const total = names.length + 10;
  const tick = () => { fill.style.width = Math.round(++done / total * 70) + '%'; };
  await Promise.all([
    loadImages(),
    W.preloadPictures(all),
    ...names.map(n => loadClip(n, AU).then(tick)),
    ...['bonus2', 'coin', 'impact', 'levelup1', 'eat', 'power_diamond', 'power_freeze', 'power_end'].map(n => loadClip(n, SFX).then(tick)),
  ]);
  text.textContent = 'Budowanie krainy…'; fill.style.width = '75%';
  pics = new Map();
  for (const id of all) pics.set(id, await W.pictureCanvas(id, 128));
  world = buildWorld(qs, { monsters: !!c.monsters });
  chunks = new Map();
  // the stones of every gate: right answer + three plausible wrong ones, in random order
  pads = world.gates.map((gt, i) => {
    const q = qs[i];
    return gt.pads.map((p, k) => ({ ...p, val: q.options[k], correct: q.options[k] === q.id, state: 'idle', charge: 0, sink: 0, gate: i }));
  });
  // storytellers: facts at the level of the range, never twice in a level
  const lvl = 9;
  let seen = []; try { seen = JSON.parse(localStorage.getItem('english_facts_seen') || '[]'); } catch (_) {}
  const okF = facts.facts.filter(f => f.lvl <= lvl);
  const fresh = okF.filter(f => !seen.includes(f.id)).sort(() => Math.random() - 0.5), old = okF.filter(f => seen.includes(f.id)).sort(() => Math.random() - 0.5);
  const chosen = [...fresh, ...old];
  const female = ['Princess', 'OldWoman', 'EggGirl'], male = ['OldMan', 'Villager3', 'Villager4', 'Monk', 'Boy', 'Hunter', 'Noble', 'Inspector'];
  npcs = world.npcs.map((p, i) => {
    const f = chosen[i % chosen.length], biome = BIOMES[world.biomeOf(p.x)];
    const who = biome.id === 'snow' && f.voice === 'm' ? 'Eskimo' : (f.voice === 'f' ? female : male)[i % (f.voice === 'f' ? 3 : 8)];
    return { x: (p.x + 0.5) * T, y: (p.y + 0.5) * T, fact: f, who, armed: true, awayT: 0, spoken: false, bob: Math.random() * 6 };
  });
  text.textContent = 'Zapraszanie postaci z ciekawostkami…'; fill.style.width = '85%';
  await Promise.all(npcs.map(n => loadClip('npc_' + n.fact.id, AU)));
  await Promise.all(BIOMES.map(async b => {
    if (music.has(b.music)) return;
    const r = await loadAudioBuffer(ctx(), MU + b.music, AUDIO_VER); if (r.buffer) music.set(b.music, r.buffer);
  }));
  // animals wandering in the plazas (a couple each) and the storytellers' clearings
  animals = [];
  const homes = [...world.gates.map(gt => gt.plaza), ...world.npcs.map(p => ({ x0: p.x - 2, y0: p.y - 1, x1: p.x + 2, y1: p.y + 1 }))];
  for (const h of homes) for (let k = 0; k < 2; k++) if (Math.random() < 0.6) {
    const b = BIOMES[world.biomeOf(h.x0)], kind = b.animals[Math.floor(Math.random() * b.animals.length)];
    animals.push({ kind, x: rnd(h.x0 + 0.5, h.x1 + 0.5) * T, y: rnd(h.y0 + 0.5, h.y1 + 0.5) * T, vx: 0, vy: 0, t: 0, home: h });
  }
  mons = world.monsters.map(m => ({ ...m, t: Math.random(), dirSign: 1, x: (m.a.x + 0.5) * T, y: (m.a.y + 0.5) * T, dir: 0, pause: 0, gone: 0 }));
  poweredLeft = magnetLeft = invuln = 0; trail = []; eaten = hits = 0; birds = []; fish = []; birdT = 4;
  hero = { x: (world.start.x + 0.5) * T, y: (world.start.y + 0.5) * T, tx: world.start.x, ty: world.start.y, fx: world.start.x, fy: world.start.y, moveT: 1, dir: 0, frame: 0, moving: false };
  cam.x = hero.x; cam.y = hero.y;
  finish.done = false; landShown = -1; cooldown = 0; gemsTaken = 0; gemCounts = [0, 0, 0, 0, 0];
  el('gem-box').classList.add('hidden');
  el('gem-box').innerHTML = GEMS.map((c, i) => `<span class="gc hidden" id="gc${i}" style="--h:${c.h};--l:${c.l}%"><i></i><b>0</b></span>`).join('');
  world.gems.forEach((gm, i) => { gm.c = (i * 3 + Math.floor(Math.random() * 5)) % 5; gm.ph = Math.random() * 6.28; });
  qi = 0; activeGate = -1; mistakes = 0; firstTry = 0; qMistakes = 0; finishT = -1; parts = []; heard = []; clock = 0;
  queue.length = 0; speakingUntil = 0;
  updateHud();
  fill.style.width = '100%'; text.textContent = 'Gotowe! Ruszaj w drogę.';
  await new Promise(res => { const b = el('loading-play-btn'); b.classList.remove('hidden'); b.onclick = () => { b.classList.add('hidden'); ctx(); res(); }; });
  overlay.classList.add('hidden');
  playMusic(BIOMES[0].music);
  showLand(0);
  running = true; paused = false; lastT = performance.now();
  requestAnimationFrame(loop);
}

let landShown = -1;
function showLand(b) {
  if (b === landShown) return; landShown = b;
}

function updateHud() {
  // the current question in English, or the last word learned with its Polish meaning, an arrow at the very start
  const f = qs[qi], prev = qs[qi - 1];
  const box = el('q-box');
  if (f && activeGate === qi) { el('q-text').textContent = W.item(f.id).say['q' + f.variant]; box.classList.remove('solved'); }
  else if (prev) { const it = W.item(prev.id); el('q-text').textContent = `${it.en} = ${it.pl}`; box.classList.add('solved'); }
  else { el('q-text').textContent = '➜'; box.classList.remove('solved'); }
  el('dots').innerHTML = qs.map((_, i) => `<i class="${i < qi ? 'done' : i === qi ? 'now' : ''}"></i>`).join('');
}
function repeatQuestion() { if (qs && qs[qi] && activeGate === qi) { queue.length = 0; clearTimeout(qTimer); qTimer = null; const ms = speak([W.clipQ(qs[qi].id, qs[qi].variant)]); speakingUntil = performance.now() + ms + 400; } }
function caption(name, textS, ms, pl = '') {
  el('npc-name').textContent = name; el('npc-text').textContent = textS; el('npc-pl').textContent = pl; el('npc-bubble').classList.remove('hidden');
  clearTimeout(caption.t); caption.t = setTimeout(() => el('npc-bubble').classList.add('hidden'), ms + 800);
}

// --- movement & collision against the tile grid ------------------------------------
const walkable = (tx, ty) => { const v = world.at(tx, ty); return v === C.PATH || v === C.PLAZA || v === C.LANE || v === C.CLEAR || v === C.PAD || v === C.BRIDGE; };
function blocked(x, y) {
  const d = R * 0.72;                                   // a round body: corners do not snag
  for (const [ox, oy] of [[-d, -d], [d, -d], [-d, d], [d, d], [0, R], [0, -R], [R, 0], [-R, 0]]) {
    const tx = Math.floor((x + ox) / T), ty = Math.floor((y + oy) / T);
    if (!walkable(tx, ty)) return true;
    const p = padAt(tx, ty); if (p && p.state !== 'ok') return true;       // stones are solid until the right one opens the way
  }
  return false;
}
// Put the hero on the nearest free spot (centre of a walkable tile) if it is caught in anything solid.
function unstick() {
  if (!blocked(hero.x, hero.y)) return;
  const tx0 = Math.floor(hero.x / T), ty0 = Math.floor(hero.y / T);
  for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = (tx0 + dx + 0.5) * T, y = (ty0 + dy + 0.5) * T;
    if (!blocked(x, y)) { hero.x = x; hero.y = y; return; }
  }
}
const canEnter = (tx, ty) => { if (!walkable(tx, ty)) return false; const p = padAt(tx, ty); return !p || p.state === 'ok'; };
function padAt(tx, ty) { const ps = pads[world.gates.findIndex(gt => gt.pads.some(p => p.x === tx && p.y === ty))]; return ps ? ps.find(p => p.x === tx && p.y === ty) : null; }

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  clock += dt;
  // input
  let ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) + stick.x, iy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0) + stick.y;
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  if (finishT >= 0) { ix = iy = 0; }
  // tile-by-tile movement (like Sylabowy Ninja): glide from the centre of one tile to the next,
  // keep going while a direction is held; nothing to snag on
  if (cooldown > 0) cooldown -= dt;
  if (hero.moveT >= 1) {
    let dx = 0, dy = 0;
    if (Math.abs(ix) > 0.3 || Math.abs(iy) > 0.3) {
      if (Math.abs(ix) >= Math.abs(iy)) dx = Math.sign(ix); else dy = Math.sign(iy);
      hero.dir = dx > 0 ? 3 : dx < 0 ? 2 : dy > 0 ? 0 : 1;
      const nx = hero.tx + dx, ny = hero.ty + dy, p = padAt(nx, ny);
      if (p && p.state === 'idle' && p.gate === qi && activeGate === qi && cooldown <= 0 && finishT < 0) choose(p);   // stepping onto a stone = the answer
      else if (canEnter(nx, ny)) { hero.fx = hero.tx; hero.fy = hero.ty; hero.tx = nx; hero.ty = ny; hero.moveT = 0; trail.push([hero.fx, hero.fy]); if (trail.length > 30) trail.shift(); }
      else if (dx && !dy) {                                    // walking along a wall: a free tile diagonally ahead turns the corner
        for (const sy of [1, -1]) if (Math.abs(iy) > 0.15 && Math.sign(iy) === sy && canEnter(hero.tx, hero.ty + sy)) { hero.fx = hero.tx; hero.fy = hero.ty; hero.ty += sy; hero.moveT = 0; break; }
      } else if (dy && !dx) {
        for (const sx of [1, -1]) if (Math.abs(ix) > 0.15 && Math.sign(ix) === sx && canEnter(hero.tx + sx, hero.ty)) { hero.fx = hero.tx; hero.fy = hero.ty; hero.tx += sx; hero.moveT = 0; break; }
      }
    }
  }
  hero.moving = hero.moveT < 1;
  if (hero.moving) {
    hero.moveT = Math.min(1, hero.moveT + dt * TILES_PER_S);
    hero.frame += dt * 8;
  }
  hero.x = (hero.fx + (hero.tx - hero.fx) * hero.moveT + 0.5) * T;
  hero.y = (hero.fy + (hero.ty - hero.fy) * hero.moveT + 0.5) * T;
  cam.x += (hero.x - cam.x) * Math.min(1, 6 * dt); cam.y += (hero.y - cam.y) * Math.min(1, 6 * dt);
  { const vw = canvas.width, vh = canvas.height;                   // never show the void beyond the world
    cam.x = Math.max(vw / 2, Math.min(world.W * T - vw / 2, cam.x)); cam.y = Math.max(vh / 2, Math.min(H * T - vh / 2, cam.y)); }
  const tx = Math.floor(hero.x / T), ty = Math.floor(hero.y / T);
  // land & music follow the hero
  const b = world.biomeOf(tx); if (b !== landShown) { showLand(b); playMusic(BIOMES[b].music); }
  // entering a plaza: the question
  const gt = world.gates[qi];
  if (gt && activeGate !== qi && tx >= gt.plaza.x0 && tx <= gt.plaza.x1 + 1 && ty >= gt.plaza.y0 && ty <= gt.plaza.y1) {
    activeGate = qi; qMistakes = 0; updateHud(); dropLow();
    enqueue({ clips: [W.clipQ(qs[qi].id, qs[qi].variant)], gap: 600 });
  }
  // the stones
  for (const ps of pads) for (const p of ps) if (p.state === 'sinking') { p.sink += dt; if (p.sink > 0.6) p.state = 'gone'; }
  // storytellers
  for (const n of npcs) {
    const d = Math.hypot(hero.x - n.x, hero.y - n.y);
    if (d > T * 6) { n.awayT += dt; if (n.awayT > 3) n.armed = true; } else if (!n.armed) n.awayT = 0;
    if (n.armed && d < T * 2.4 && voiceFree() && finishT < 0) {
      n.armed = false; n.awayT = 0;
      if (!n.spoken) { heard.push(n.fact); n.spoken = true; try { const s = JSON.parse(localStorage.getItem('english_facts_seen') || '[]'); s.push(n.fact.id); localStorage.setItem('english_facts_seen', JSON.stringify(s.slice(-400))); } catch (_) {} }
      enqueue({ clips: ['npc_' + n.fact.id], gap: 900, low: true, onStart: (ms) => caption(nameOf(n.who), n.fact.text, ms, n.fact.pl) });
    }
  }
  // animals amble around their plaza
  for (const a of animals) {
    a.t -= dt;
    if (a.t <= 0) { a.t = rnd(1, 3); const s = Math.random() < 0.35 ? 0 : T * 1.2; const an = rnd(0, 6.28); a.vx = Math.cos(an) * s; a.vy = Math.sin(an) * s; }
    const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
    if (nx > a.home.x0 * T + 8 && nx < (a.home.x1 + 1) * T - 8) a.x = nx; else a.vx = -a.vx;
    if (ny > a.home.y0 * T + 8 && ny < (a.home.y1 + 1) * T - 8) a.y = ny; else a.vy = -a.vy;
  }
  // crystals: walk over to collect
  for (const gm of world.gems) if (!gm.taken && Math.hypot(hero.x - (gm.x + 0.5) * T, hero.y - (gm.y + 0.5) * T) < T * 0.8) {
    gm.taken = true; gemsTaken++; gemCounts[gm.c]++; sfx('coin', 0.5);
    const gb = el('gem-box'), sp = el('gc' + gm.c); gb.classList.remove('hidden'); sp.classList.remove('hidden', 'pop'); sp.querySelector('b').textContent = String(gemCounts[gm.c]); void sp.offsetWidth; sp.classList.add('pop');
    for (let k = 0; k < 28; k++) burst((gm.x + 0.5) * T, (gm.y + 0.5) * T, `hsl(${GEMS[gm.c].h},95%,${k % 3 ? 70 : 92}%)`, 1, 170);
  }
  // the end: treasure clearing
  if (finishT < 0 && qi >= qs.length && Math.hypot(hero.x - (world.chest.x + 0.5) * T, hero.y - (world.chest.y + 0.5) * T) < T * 1.5) {
    finishT = 0; sfx('levelup1', 0.6);
    for (let k = 0; k < 120; k++) burst(world.chest.x * T + T / 2, world.chest.y * T, `hsl(${rnd(0, 360)},90%,65%)`, 1, 260);
  }
  if (finishT >= 0) { finishT += dt; if (finishT > 3 && voiceFree() && !finish.done) { finish.done = true; setTimeout(finish, 600); } }
  updateMonsters(dt);
  updateLife(dt);
  updateParticles(dt);
}

// --- monsters and power-ups ---------------------------------------------------------
function updateMonsters(dt) {
  if (invuln > 0) invuln -= dt;
  const wasP = poweredLeft > 0, wasF = magnetLeft > 0;
  if (poweredLeft > 0) poweredLeft = Math.max(0, poweredLeft - dt);
  if (magnetLeft > 0) magnetLeft = Math.max(0, magnetLeft - dt);
  if ((wasP && !poweredLeft) || (wasF && !magnetLeft)) sfx('power_end', 0.5);
  if (magnetLeft > 0) for (const gm of world.gems) {             // crystals in reach fly to the hero
    if (gm.taken) continue;
    const gx = (gm.x + 0.5) * T, gy = (gm.y + 0.5) * T, d = Math.hypot(hero.x - gx, hero.y - gy);
    if (d > T * 10) continue;
    const v = Math.min(d, T * 9 * dt); gm.x += (hero.x - gx) / d * v / T; gm.y += (hero.y - gy) / d * v / T; gm.pulled = true;
  }
  for (const it of world.items) if (!it.taken && Math.hypot(hero.x - (it.x + 0.5) * T, hero.y - (it.y + 0.5) * T) < T * 0.7) {
    it.taken = true;
    if (it.kind === 'power') { poweredLeft = POWER_S; sfx('power_diamond', 0.6); } else { magnetLeft = MAGNET_S; sfx('power_freeze', 0.6); }
    for (let k = 0; k < 30; k++) burst((it.x + 0.5) * T, (it.y + 0.5) * T, it.kind === 'power' ? `hsl(${rnd(40, 60)},95%,65%)` : `hsl(${rnd(180, 210)},90%,80%)`, 1, 160);
  }
  for (const m of mons) {
    if (m.gone > 0) { m.gone -= dt; if (m.gone <= 0) { m.t = 0; m.dirSign = 1; } continue; }
    m.anim = (m.anim || 0) + dt * 6;
    {
      if (m.pause > 0) m.pause -= dt;
      else {
        const len = Math.abs(m.b.x - m.a.x) + Math.abs(m.b.y - m.a.y) || 1;
        m.t += m.dirSign * dt * MON_TPS / len;
        if (m.t >= 1) { m.t = 1; m.dirSign = -1; m.pause = 0.8; } else if (m.t <= 0) { m.t = 0; m.dirSign = 1; m.pause = 0.8; }
      }
      const dx = (m.b.x - m.a.x) * m.dirSign, dy = (m.b.y - m.a.y) * m.dirSign;
      m.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1);
    }
    m.x = (m.a.x + (m.b.x - m.a.x) * m.t + 0.5) * T; m.y = (m.a.y + (m.b.y - m.a.y) * m.t + 0.5) * T;
    // the hit area is under a tile across, so the middle of the path is always safe
    if (Math.abs(hero.x - m.x) < T * 0.7 && Math.abs(hero.y - m.y) < T * 0.7 && finishT < 0) {
      if (poweredLeft > 0) {
        m.gone = 8; eaten++; sfx('eat', 0.6);
        for (let k = 0; k < 26; k++) burst(m.x, m.y, `hsl(${rnd(90, 150)},90%,65%)`, 1, 170);
      } else if (invuln <= 0) hurt(m);
    }
  }
}
// touched by a monster: a bump, back a few steps along the way you came, a moment of safety
function hurt(m) {
  hits++; invuln = 2; m.pause = 1.2; sfx('impact', 0.5);
  for (let k = 0; k < 16; k++) burst(hero.x, hero.y, '#ff8a5c', 1, 130);
  let back = null;
  for (let i = trail.length - 1; i >= 0; i--) {
    const [x, y] = trail[i];
    if (mons.every(o => o.gone > 0 || Math.hypot((x + 0.5) * T - o.x, (y + 0.5) * T - o.y) > T * 2.2) && trail.length - i >= 3) { back = trail[i]; trail.length = i; break; }
  }
  if (back) { hero.tx = hero.fx = back[0]; hero.ty = hero.fy = back[1]; hero.moveT = 1; }
  for (const k in keys) keys[k] = false; stick.x = stick.y = 0;
}

// --- life around: birds flying over, fish jumping out of the rivers -----------------
function updateLife(dt) {
  const vw = canvas.width, vh = canvas.height, b = BIOMES[landShown] || BIOMES[0];
  birdT -= dt;
  if (birdT <= 0 && b.id !== 'autumn') {                // a little flock in a V, crossing the screen
    birdT = rnd(14, 26);
    const dir = Math.random() < 0.5 ? 1 : -1, n = 3 + Math.floor(rnd(0, 5)), y0 = cam.y + rnd(-vh * 0.4, vh * 0.1);
    for (let i = 0; i < n; i++) { const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1); birds.push({ x: cam.x - dir * (vw / 2 + 60 + Math.abs(k) * 26), y: y0 + Math.abs(k) * 16, vx: dir * rnd(95, 105), ph: rnd(0, 6), life: 0 }); }
  }
  for (let i = birds.length - 1; i >= 0; i--) { const o = birds[i]; o.life += dt; o.x += o.vx * dt; o.y += Math.sin(o.life * 1.3 + o.ph) * 6 * dt; if (o.life > 30) birds.splice(i, 1); }
  if (world.rivers.length && Math.random() < dt * 0.5) {     // a fish leaps out of a river in view
    const r = world.rivers.find(rv => Math.abs((rv.x + rv.w / 2) * T - cam.x) < vw / 2);
    if (r) { const y = Math.floor((cam.y + rnd(-vh / 2, vh / 2)) / T); if (world.at(r.x + 1, y) === C.RIVER) fish.push({ x: (r.x + rnd(0.5, r.w - 0.5)) * T, y: (y + 0.5) * T, t: 0, dir: Math.random() < 0.5 ? 1 : -1 }); }
  }
  for (let i = fish.length - 1; i >= 0; i--) { fish[i].t += dt; if (fish[i].t > 1.1) { const f = fish[i]; for (let k = 0; k < 8; k++) burst(f.x + f.dir * 20, f.y, 'rgba(220,240,255,0.9)', 1, 60); fish.splice(i, 1); } }
}

function choose(p) {
  const f = qs[qi];
  if (p.correct) {
    p.state = 'ok'; sfx('bonus2', 0.55);
    if (qMistakes === 0) firstTry++;
    for (const o of pads[qi]) if (o !== p && o.state === 'idle') { o.state = 'sinking'; }
    const bar = world.gates[qi].bars[world.gates[qi].pads.findIndex(q => q.x === p.x && q.y === p.y)];
    world.set(bar.x, bar.y, C.LANE); chunks.clear();                    // the way opens
    for (let k = 0; k < 40; k++) burst(p.x * T + T / 2, p.y * T + T / 2, `hsl(${rnd(40, 140)},90%,60%)`, 1, 180);
    W.recordWord(f.id, qMistakes === 0);
    dropLow();
    enqueue({ clips: ['e_yes' + (1 + Math.floor(Math.random() * 5)), `w_${f.id}_a`], gap: cfg.polish ? 700 : 1400 });
    if (cfg.polish) enqueue({ clips: [`w_${f.id}_pl`], gap: 1400 });
    qi++;
    updateHud();
  } else {
    p.state = 'sinking'; mistakes++; qMistakes++; sfx('impact', 0.5);
    W.recordWord(f.id, false);
    for (let k = 0; k < 18; k++) burst(p.x * T + T / 2, p.y * T + T / 2, '#ff8a5c', 1, 120);
    for (const k in keys) keys[k] = false; stick.x = stick.y = 0;         // let go, so it does not walk straight into the next stone
    cooldown = 0.7;
    dropLow();
    enqueue({ clips: ['e_oops', `w_${p.val}_t`], gap: 700 });          // what was on that stone, then the word once more
    enqueue({ clips: [W.clipQ(f.id, f.variant)], gap: 600 });
  }
}

function finish() {
  running = false;
  if (musicSrc) { try { musicSrc.stop(); } catch (_) {} musicSrc = null; }
  const stars = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
  onEnd && onEnd({ stars, mistakes, firstTry, total: qs.length, heard, gems: gemsTaken, gemsTotal: world.gems.length, monsters: mons.length, eaten });
}

const NAMES = { Princess: 'Princess', OldMan: 'Old Wise Man', OldWoman: 'Old Herbalist', Villager3: 'Farmer', Villager4: 'Blacksmith', Monk: 'Monk',
  Eskimo: 'Inuk', Boy: 'Boy', Hunter: 'Hunter', EggGirl: 'Egg Girl', Noble: 'Noble', Inspector: 'Inspector' };
const nameOf = (w) => NAMES[w] || w;

// --- particles (generative decoration) ----------------------------------------------
function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(0.3, 1) * speed; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rnd(0.6, 1.2), t: 0, color, kind: 'dot', g: 220 }); }
}
function updateParticles(dt) {
  const b = BIOMES[landShown] || BIOMES[0], vw = canvas.width, vh = canvas.height;
  const want = { butterflies: 10, petals: 40, sun: 14, snow: 90, fireflies: 45 }[b.fx] || 0;
  const amb = parts.filter(p => p.kind !== 'dot').length;
  for (let i = amb; i < want; i++) {
    const x = cam.x + rnd(-vw / 2, vw / 2), y = cam.y + rnd(-vh / 2, vh / 2);
    if (b.fx === 'snow') parts.push({ kind: 'snow', x, y: cam.y - vh / 2 - rnd(0, 40), vx: rnd(-15, 15), vy: rnd(40, 80), life: 20, t: 0, f: Math.floor(rnd(0, 7)), ph: rnd(0, 6) });
    else if (b.fx === 'petals') parts.push({ kind: 'petal', x: cam.x + rnd(-vw / 2, vw / 2), y: cam.y - vh / 2 - rnd(0, 60), vx: rnd(10, 40), vy: rnd(30, 60), life: 20, t: 0, f: Math.floor(rnd(0, 6)), ph: rnd(0, 6) });
    else if (b.fx === 'fireflies') parts.push({ kind: 'firefly', x, y, vx: 0, vy: 0, life: rnd(5, 10), t: 0, ph: rnd(0, 6) });
    else if (b.fx === 'butterflies') parts.push({ kind: 'butterfly', x, y, vx: rnd(-30, 30), vy: rnd(-20, 20), life: rnd(8, 14), t: 0, ph: rnd(0, 6), hue: rnd(0, 360) });
    else if (b.fx === 'sun') parts.push({ kind: 'mote', x, y, vx: rnd(5, 20), vy: rnd(-8, 8), life: rnd(4, 8), t: 0, ph: rnd(0, 6) });
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.kind === 'dot') { p.vy += p.g * dt; }
    else if (p.kind === 'firefly') { p.vx += rnd(-60, 60) * dt; p.vy += rnd(-60, 60) * dt; p.vx *= 0.97; p.vy *= 0.97; }
    else if (p.kind === 'butterfly') { p.vx += Math.sin(p.t * 2 + p.ph) * 30 * dt; p.vy += Math.cos(p.t * 3 + p.ph) * 30 * dt; }
    else if (p.kind === 'snow' || p.kind === 'petal') p.x += Math.sin(p.t * 1.5 + p.ph) * 20 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const off = Math.abs(p.x - cam.x) > vw || Math.abs(p.y - cam.y) > vh;
    if (p.t > p.life || (p.kind !== 'dot' && off)) parts.splice(i, 1);
  }
}

// --- drawing --------------------------------------------------------------------------
const CH = 16;                                         // chunk = 16x16 tiles, pre-rendered
function tileVariant(x, y, list) { const h = (x * 73856093 ^ y * 19349663) >>> 0; return list[h % list.length]; }
function drawTile(c, img, sx, sy, dx, dy) { c.drawImage(img, sx * TS, sy * TS, TS, TS, dx, dy, T, T); }
function chunk(cx, cy) {
  const key = cx + ',' + cy;
  if (chunks.has(key)) return chunks.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = CH * T;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const wx = cx * CH + x, wy = cy * CH + y, v = world.at(wx, wy), b = BIOMES[world.biomeOf(wx)];
    const ground = (v === C.BLOCK || v === C.WATER || v === C.BAR || v === C.RIVER || v === C.BRIDGE) ? b.bg : b.path;
    const [sx, sy] = tileVariant(wx, wy, ground);
    drawTile(c, IMG.floor, sx, sy, x * T, y * T);
    if (v === C.WATER || v === C.RIVER || v === C.BRIDGE) {   // ponds and rivers (icy in the snow), banks darker
      const icy = b.id === 'snow';
      c.fillStyle = icy ? '#9fd3ea' : v === C.WATER ? '#3d8fd1' : '#3f9ad8'; c.fillRect(x * T, y * T, T, T);
      const wet = (q) => q === C.WATER || q === C.RIVER || q === C.BRIDGE;
      c.fillStyle = 'rgba(20,40,60,0.28)';
      if (!wet(world.at(wx - 1, wy))) c.fillRect(x * T, y * T, 5, T);
      if (!wet(world.at(wx + 1, wy))) c.fillRect(x * T + T - 5, y * T, 5, T);
      if (!wet(world.at(wx, wy - 1))) c.fillRect(x * T, y * T, T, 5);
    }
    if (v === C.BRIDGE) {                                        // wooden planks with rails
      c.fillStyle = '#9a6a3c'; c.fillRect(x * T, y * T, T, T);
      c.fillStyle = '#7a4f2a'; for (let k = 0; k < 4; k++) c.fillRect(x * T + k * 12, y * T, 2, T);
      c.fillStyle = '#5a3a1e';
      if (world.at(wx, wy - 1) !== C.BRIDGE) c.fillRect(x * T, y * T, T, 6);
      if (world.at(wx, wy + 1) !== C.BRIDGE) c.fillRect(x * T, y * T + T - 6, T, 6);
    }
    // soft edge of the path: a little shadow where it meets the land
    if (ground === b.path) {
      c.fillStyle = 'rgba(0,0,0,0.13)';
      if ([C.BLOCK, C.WATER, C.BAR].includes(world.at(wx, wy - 1))) c.fillRect(x * T, y * T, T, 5);
      if ([C.BLOCK, C.WATER, C.BAR].includes(world.at(wx - 1, wy))) c.fillRect(x * T, y * T, 4, T);
      if ([C.BLOCK, C.WATER, C.BAR].includes(world.at(wx + 1, wy))) c.fillRect(x * T + T - 4, y * T, 4, T);
    }
  }
  for (const a of world.art) {
    if (a.x < cx * CH - 1 || a.x > (cx + 1) * CH || a.y < cy * CH - 1 || a.y > (cy + 1) * CH) continue;
    drawArt(c, a, (a.x - cx * CH + 0.5) * T, (a.y - cy * CH + 0.5) * T);
  }
  // decorations whose top-left falls in this chunk (they may overhang into the next: drawn there too)
  for (const d of world.decor) {
    if (d.x + d.w < cx * CH - 1 || d.x > (cx + 1) * CH || d.y + d.h < cy * CH - 1 || d.y > (cy + 1) * CH) continue;
    if (d.house) {                                       // a building, standing on the bottom of its tiles
      const [sx, sy, pw, ph] = HOUSES[d.house];
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse((d.x - cx * CH) * T + d.w * T / 2, (d.y - cy * CH + d.h) * T - 6, pw * SC * 0.46, 10, 0, 0, 7); c.fill();
      c.drawImage(IMG.house, sx, sy, pw, ph, (d.x - cx * CH) * T + (d.w * T - pw * SC) / 2, (d.y - cy * CH + d.h) * T - ph * SC, pw * SC, ph * SC);
      continue;
    }
    const [sx, sy, w, h] = DECOR[d.name];
    c.drawImage(IMG.nature, sx * TS, sy * TS, w * TS, h * TS, (d.x - cx * CH) * T, (d.y - cy * CH) * T, w * T, h * T);
  }
  // closed bars: a little fence
  for (const gt of world.gates) for (const bar of gt.bars) {
    if (world.at(bar.x, bar.y) !== C.BAR) continue;
    const bx = (bar.x - cx * CH) * T, by = (bar.y - cy * CH) * T;
    if (bx < -T || by < -T || bx > CH * T || by > CH * T) continue;
    c.fillStyle = '#7a4a26'; for (let k = 0; k < 3; k++) c.fillRect(bx + 6 + k * 15, by + 4, 7, T - 8);
    c.fillStyle = '#a8683a'; c.fillRect(bx + 2, by + 12, T - 4, 6); c.fillRect(bx + 2, by + T - 18, T - 4, 6);
  }
  chunks.set(key, cv);
  return cv;
}

function render() {
  const vw = canvas.width, vh = canvas.height;
  const ox = Math.round(cam.x - vw / 2), oy = Math.round(cam.y - vh / 2);
  g.fillStyle = '#2a4a2a'; g.fillRect(0, 0, vw, vh);
  const c0x = Math.floor(ox / (CH * T)), c1x = Math.floor((ox + vw) / (CH * T)), c0y = Math.floor(oy / (CH * T)), c1y = Math.floor((oy + vh) / (CH * T));
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    if (cx < 0 || cy < 0 || cx * CH >= world.W || cy * CH >= H) continue;
    g.drawImage(chunk(cx, cy), cx * CH * T - ox, cy * CH * T - oy);
  }
  // water: shimmer on ponds, current lines flowing down the rivers
  for (let ty = Math.floor(oy / T); ty <= (oy + vh) / T; ty++) for (let tx = Math.floor(ox / T); tx <= (ox + vw) / T; tx++) {
    const v = world.at(tx, ty);
    if (v === C.WATER) {
      const s = Math.sin(clock * 2 + tx * 1.7 + ty * 2.3);
      if (s > 0.6) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(tx * T - ox + 10 + s * 8, ty * T - oy + 18, 12, 3); }
    } else if (v === C.RIVER) {
      g.fillStyle = 'rgba(255,255,255,0.28)';
      for (let k = 0; k < 2; k++) {
        const yy = ((clock * 46 + k * 24 + tx * 17) % T);
        g.fillRect(tx * T - ox + 8 + ((tx * 13 + k * 19) % 26), ty * T - oy + yy, 3, 10);
      }
    }
  }
  // crystals at the end of the side spurs: faceted, glassy, with a glow and twinkles
  for (const gm of world.gems) {
    if (gm.taken) continue;
    const bx = (gm.x + 0.5) * T - ox, by = (gm.y + 0.5) * T - oy;
    if (bx < -T || by < -T || bx > vw + T || by > vh + T) continue;
    g.save(); g.translate(bx, by + Math.sin(clock * 2.4 + gm.ph) * 4); g.scale(1.55, 1.55);   // a big, tempting gem
    drawGem(0, 0, GEMS[gm.c], gm.ph, 14);
    g.restore();
  }
  // picture stones
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let gi = 0; gi < pads.length; gi++) for (const p of pads[gi]) {
    if (p.state === 'gone') continue;
    const x = p.x * T - ox, y = p.y * T - oy, sink = p.state === 'sinking' ? p.sink / 0.6 : 0;
    if (x < -T || y < -T || x > vw || y > vh) continue;
    g.save(); g.globalAlpha = 1 - sink; g.translate(x + T / 2, y + T / 2 + sink * 10); g.scale(1 - sink * 0.6, 1 - sink * 0.6);
    const glow = p.state === 'ok' ? 1 : 0;
    g.fillStyle = p.state === 'ok' ? '#7dff9a' : `rgb(${200 + 55 * glow},${200 + 30 * glow},${190 - 80 * glow})`;
    g.strokeStyle = '#3a3a48'; g.lineWidth = 4;
    const pw = T * 1.62, hint = p.correct && gi === qi && qMistakes >= 2 && p.state === 'idle';   // after two misses the right stone glows
    if (hint) { g.fillStyle = `rgba(255,220,80,${0.35 + 0.3 * Math.sin(clock * 6)})`; g.beginPath(); g.roundRect(-pw / 2 - 8, -pw / 2 - 8, pw + 16, pw + 16, 18); g.fill(); }
    g.beginPath(); g.roundRect(-pw / 2, -pw / 2, pw, pw, 12); g.fill(); g.stroke();
    if ((gi === qi && activeGate === qi) || p.state === 'ok') { const pc = pics.get(p.val); if (pc) g.drawImage(pc, -pw / 2 + 5, -pw / 2 + 5, pw - 10, pw - 10); }
    g.restore();
  }
  // treasure chest
  { const x = (world.chest.x + 0.5) * T - ox, y = (world.chest.y + 0.5) * T - oy;
    g.fillStyle = '#8a5a2b'; g.fillRect(x - 22, y - 14, 44, 28); g.fillStyle = '#d4a017'; g.fillRect(x - 22, y - 4, 44, 6); g.fillRect(x - 4, y - 14, 8, 28);
    if (qi >= qs.length) { g.fillStyle = `rgba(255,230,120,${0.3 + 0.2 * Math.sin(clock * 4)})`; g.beginPath(); g.arc(x, y, 40, 0, 7); g.fill(); } }
  // night glow of the mushroom rings
  if ((BIOMES[landShown] || {}).id === 'autumn') for (const a of world.art) {
    if (a.kind !== 'shroom') continue;
    const x = (a.x + 0.5) * T - ox, y = (a.y + 0.5) * T - oy;
    if (x < -T * 2 || y < -T * 2 || x > vw + T * 2 || y > vh + T * 2) continue;
    const gr = g.createRadialGradient(x, y, 4, x, y, 60); gr.addColorStop(0, `rgba(170,255,210,${0.22 + 0.1 * Math.sin(clock * 2 + a.seed)})`); gr.addColorStop(1, 'rgba(170,255,210,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 60, 0, 7); g.fill();
  }
  // little flags on the plazas
  if (IMG.flag) for (const gt of world.gates) for (const [fx, fy] of [[gt.plaza.x0, gt.plaza.y0], [gt.plaza.x0, gt.plaza.y1]]) {
    const x = fx * T - ox, y = fy * T - oy;
    if (x < -T || y < -T || x > vw || y > vh) continue;
    g.drawImage(IMG.flag, (Math.floor(clock * 6 + fx) % 4) * 16, 0, 16, 16, x, y - T * 0.4, T, T);
  }
  drawHint(ox, oy);
  // power-ups
  for (const it of world.items) {
    if (it.taken) continue;
    const x = (it.x + 0.5) * T - ox, y = (it.y + 0.5) * T - oy + Math.sin(clock * 3 + it.x) * 4;
    if (x < -T || y < -T || x > vw + T || y > vh + T) continue;
    const gr = g.createRadialGradient(x, y, 2, x, y, 34); gr.addColorStop(0, it.kind === 'power' ? 'rgba(255,230,120,0.6)' : 'rgba(170,230,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill();
    if (it.kind === 'power' && IMG.coin) g.drawImage(IMG.coin, (Math.floor(clock * 8) % 4) * 10, 0, 10, 10, x - 20, y - 20, 40, 40);
    else if (it.kind === 'magnet') drawMagnet(x, y, 1);
  }
  // fish leaping out of the rivers
  for (const f of fish) {
    const k = f.t / 1.1, x = f.x + f.dir * (k - 0.5) * 50 - ox, y = f.y - Math.sin(k * Math.PI) * 46 - oy;
    if (!IMG.a_Fish) break;
    g.save(); g.translate(x, y); g.rotate(f.dir * (k - 0.5) * 2.2); if (f.dir < 0) g.scale(-1, 1);
    g.drawImage(IMG.a_Fish, (Math.floor(clock * 8) % 2) * 16, 0, 16, 16, -24, -24, 48, 48); g.restore();
  }
  // a trail of sparks behind the hero while a power-up works; lines to the crystals a magnet pulls
  if ((poweredLeft > 0 || magnetLeft > 0) && hero.moving && Math.random() < 0.6) parts.push({ kind: 'dot', x: hero.x + rnd(-10, 10), y: hero.y + rnd(0, 14), vx: rnd(-20, 20), vy: rnd(-40, -10), life: 0.7, t: 0, color: poweredLeft > 0 ? `hsl(${rnd(40, 60)},95%,70%)` : `hsl(${rnd(0, 360)},90%,75%)`, g: 30 });
  if (magnetLeft > 0) for (const gm of world.gems) if (!gm.taken && gm.pulled) {
    g.strokeStyle = `hsla(${GEMS[gm.c].h},90%,75%,0.45)`; g.lineWidth = 2; g.setLineDash([6, 8]); g.lineDashOffset = -clock * 40;
    g.beginPath(); g.moveTo((gm.x + 0.5) * T - ox, (gm.y + 0.5) * T - oy); g.lineTo(hero.x - ox, hero.y - oy); g.stroke(); g.setLineDash([]);
  }
  // sprites sorted by y: storytellers, animals, monsters, the hero
  const sprites = [];
  for (const m of mons) if (m.gone <= 0) sprites.push({ y: m.y, draw: () => drawMonster(m, m.x - ox, m.y - oy) });
  for (const n of npcs) sprites.push({ y: n.y, draw: () => drawChar(IMG['c_' + n.who], n.x - ox, n.y - oy, 0, 0, n) });
  for (const a of animals) sprites.push({ y: a.y, draw: () => drawAnimal(a, a.x - ox, a.y - oy) });
  if (invuln <= 0 || Math.floor(clock * 10) % 2) sprites.push({ y: hero.y, draw: () => drawChar(IMG.c_NinjaGreen, hero.x - ox, hero.y - oy, hero.dir, hero.moving ? Math.floor(hero.frame) % 4 : 0) });
  sprites.sort((a, b) => a.y - b.y).forEach(s => s.draw());
  // particles
  for (const p of parts) {
    const x = p.x - ox, y = p.y - oy;
    if (p.kind === 'dot') { g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.color; g.fillRect(x - 3, y - 3, 6, 6); }
    else if (p.kind === 'snow' && IMG.snow) { g.globalAlpha = 0.9; g.drawImage(IMG.snow, (p.f % 7) * 8, 0, 8, 8, x, y, 16, 16); }
    else if (p.kind === 'petal' && IMG.leafPink) { g.globalAlpha = 0.95; g.drawImage(IMG.leafPink, (Math.floor(p.t * 8) % 6) * 12, 0, 12, 7, x, y, 24, 14); }
    else if (p.kind === 'firefly') { const a = 0.5 + 0.5 * Math.sin(p.t * 4 + p.ph); g.globalAlpha = a; const gr = g.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, 'rgba(255,255,170,0.95)'); gr.addColorStop(1, 'rgba(255,255,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
    else if (p.kind === 'butterfly') { const w = Math.abs(Math.sin(p.t * 14)) * 7 + 2; g.globalAlpha = 0.95; g.fillStyle = `hsl(${p.hue},85%,65%)`; g.fillRect(x - w, y - 4, w, 8); g.fillRect(x, y - 4, w, 8); g.fillStyle = '#333'; g.fillRect(x - 1, y - 4, 2, 8); }
    else if (p.kind === 'mote') { g.globalAlpha = 0.5 + 0.4 * Math.sin(p.t * 3 + p.ph); g.fillStyle = '#fff6c8'; g.fillRect(x, y, 3, 3); }
    g.globalAlpha = 1;
  }
  // birds high above
  g.strokeStyle = 'rgba(30,30,45,0.85)'; g.lineWidth = 2.5;
  for (const o of birds) {
    const x = o.x - ox, y = o.y - oy, f = Math.sin(o.life * 9 + o.ph) * 6;
    if (x < -20 || x > vw + 20) continue;
    g.beginPath(); g.moveTo(x - 9, y - f); g.quadraticCurveTo(x - 4, y - 3, x, y); g.quadraticCurveTo(x + 4, y - 3, x + 9, y - f); g.stroke();
  }
  // land tint, sun rays / fog
  const b = BIOMES[landShown] || BIOMES[0];
  if (b.tint) { g.fillStyle = b.tint; g.fillRect(0, 0, vw, vh); }
  if (b.fx === 'sun' && IMG.ray) { g.globalAlpha = 0.35 + 0.1 * Math.sin(clock); g.drawImage(IMG.ray, vw - 700, -40, 700, 330); g.globalAlpha = 1; }
  if (b.fx === 'fireflies' && IMG.fog) { g.globalAlpha = 0.1; const fx = (clock * 10) % vw; g.drawImage(IMG.fog, -fx, 0, vw, vh); g.drawImage(IMG.fog, vw - fx, 0, vw, vh); g.globalAlpha = 1; }
  // vignette
  const vg = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, vw, vh);
  // how long the power-up still lasts: its icon and a shrinking bar
  const left = poweredLeft > 0 ? poweredLeft / POWER_S : magnetLeft > 0 ? magnetLeft / MAGNET_S : 0;
  if (left > 0) {
    const bw = Math.min(260, vw * 0.4), bx = vw / 2 - bw / 2, by = vh - 46;
    const blink = (poweredLeft || magnetLeft) < 3 && Math.floor(clock * 6) % 2;
    g.fillStyle = 'rgba(10,20,40,0.55)'; g.beginPath(); g.roundRect(bx - 50, by - 8, bw + 62, 36, 18); g.fill();
    g.fillStyle = poweredLeft > 0 ? (blink ? '#fff6c0' : '#ffd23f') : (blink ? '#ffffff' : '#ff6b6b');
    g.beginPath(); g.roundRect(bx, by + 2, bw * left, 16, 8); g.fill();
    if (poweredLeft > 0 && IMG.coin) g.drawImage(IMG.coin, (Math.floor(clock * 8) % 4) * 10, 0, 10, 10, bx - 42, by - 4, 28, 28);
    else drawMagnet(bx - 28, by + 10, 0.6);
  }
  if (finishT >= 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.8, Math.max(0, finishT - 2.5) / 1.5)})`; g.fillRect(0, 0, vw, vh); }
}

function drawMonster(m, x, y) {
  const img = IMG['m_' + m.kind]; if (!img) return;
  const s = SC * 1.15, w = 16 * s, h = 16 * s, scared = poweredLeft > 0;
  const hop = scared ? Math.abs(Math.sin(clock * 9 + m.a.x)) * 6 : 0;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + h * 0.42, w * 0.32, h * 0.12, 0, 0, 7); g.fill();
  g.save();
  if (scared) g.globalAlpha = poweredLeft < 3 && Math.floor(clock * 8) % 2 ? 0.95 : 0.6;
  g.drawImage(img, m.dir * 16, (Math.floor(m.anim || 0) % 4) * 16, 16, 16, x - w / 2, y - h * 0.6 - hop, w, h);
  g.restore();
  if (scared) {                                         // edible now: a ring of little green sparks around it
    g.strokeStyle = `hsla(120,90%,60%,${0.5 + 0.3 * Math.sin(clock * 8)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 4, w * 0.55, 0, 7); g.stroke();
  }

}

// a horseshoe magnet: red with silver tips, faint field lines
function drawMagnet(x, y, k) {
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(Math.sin(clock * 2) * 0.15);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
  for (let i = 1; i <= 2; i++) { g.beginPath(); g.arc(0, 8, 14 + i * 7 + Math.sin(clock * 4) * 2, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  g.lineCap = 'butt'; g.strokeStyle = '#e8343c'; g.lineWidth = 9; g.beginPath(); g.arc(0, -2, 11, Math.PI, 0); g.lineTo(11, 12); g.moveTo(-11, -2); g.lineTo(-11, 12); g.stroke();
  g.strokeStyle = '#d9dde6'; g.beginPath(); g.moveTo(-11, 9); g.lineTo(-11, 17); g.moveTo(11, 9); g.lineTo(11, 17); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(0, -2, 8, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
  g.restore();
}

// --- generative nature: patterns found in living things ---------------------------------
function drawArt(c, a, x, y) {
  let seed = a.seed; const r01 = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  if (a.kind === 'sunflower') {                         // seeds packed by the golden angle, like a real sunflower
    c.strokeStyle = '#3f7d2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y + 22); c.lineTo(x + 2, y - 6); c.stroke();
    c.fillStyle = '#4f9a33'; c.beginPath(); c.ellipse(x - 7, y + 10, 7, 3, -0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + 9, y + 4, 7, 3, 0.5, 0, 7); c.fill();
    const hx = x + 2, hy = y - 10;
    c.fillStyle = '#ffc81e'; for (let i = 0; i < 14; i++) { const an = i / 14 * 6.283; c.beginPath(); c.ellipse(hx + Math.cos(an) * 13, hy + Math.sin(an) * 13, 6, 3, an, 0, 7); c.fill(); }
    c.fillStyle = '#5a3412'; c.beginPath(); c.arc(hx, hy, 11, 0, 7); c.fill();
    c.fillStyle = '#c98a2c'; for (let i = 0; i < 70; i++) { const an = i * 2.39996, rr = 1.25 * Math.sqrt(i); c.fillRect(hx + Math.cos(an) * rr - 0.8, hy + Math.sin(an) * rr - 0.8, 1.6, 1.6); }
  } else if (a.kind === 'blossom') {                    // five petals each, a little cluster
    for (let k = 0; k < 3; k++) {
      const fx = x + (r01() - 0.5) * 30, fy = y + (r01() - 0.5) * 26, rot = r01() * 6.28, sz = 4 + r01() * 2.5;
      c.fillStyle = k % 2 ? '#ffb7d5' : '#ffd1e3';
      for (let i = 0; i < 5; i++) { const an = rot + i / 5 * 6.283; c.beginPath(); c.arc(fx + Math.cos(an) * sz, fy + Math.sin(an) * sz, sz * 0.85, 0, 7); c.fill(); }
      c.fillStyle = '#ffef7a'; c.beginPath(); c.arc(fx, fy, sz * 0.5, 0, 7); c.fill();
    }
  } else if (a.kind === 'shell') {                      // a snail-shell spiral, or a five-armed starfish
    if (r01() < 0.55) {
      c.fillStyle = '#f6e3c4'; c.strokeStyle = '#a0704a'; c.lineWidth = 2;
      c.beginPath(); for (let th = 0; th < 12.5; th += 0.15) { const rr = 1.2 * Math.exp(0.19 * th); c.lineTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr * 0.8); } c.fill(); c.stroke();
    } else {
      c.fillStyle = '#ff8a5c'; c.beginPath();
      for (let i = 0; i < 10; i++) { const an = -1.571 + i / 10 * 6.283, rr = i % 2 ? 6 : 15; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      c.closePath(); c.fill(); c.fillStyle = '#ffd0a8'; for (let i = 0; i < 5; i++) { const an = -1.571 + i / 5 * 6.283; c.fillRect(x + Math.cos(an) * 8 - 1, y + Math.sin(an) * 8 - 1, 2, 2); }
    }
  } else if (a.kind === 'flake') {                      // an ice crystal: six arms, each with side branches
    c.strokeStyle = 'rgba(235,248,255,0.95)'; c.lineWidth = 2; const rot = r01();
    for (let i = 0; i < 6; i++) {
      const an = rot + i / 6 * 6.283, ex = Math.cos(an), ey = Math.sin(an);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + ex * 16, y + ey * 16); c.stroke();
      for (const d of [7, 11]) for (const sgn of [-1, 1]) { const b2 = an + sgn * 0.9, l = d === 7 ? 6 : 4; c.beginPath(); c.moveTo(x + ex * d, y + ey * d); c.lineTo(x + ex * d + Math.cos(b2) * l, y + ey * d + Math.sin(b2) * l); c.stroke(); }
    }
  } else if (a.kind === 'shroom') {                     // a fairy ring of little mushrooms
    const n = 5 + Math.floor(r01() * 3);
    for (let i = 0; i < n; i++) {
      const an = i / n * 6.283 + r01() * 0.3, mx = x + Math.cos(an) * 16, my = y + Math.sin(an) * 11;
      c.fillStyle = '#efe6d2'; c.fillRect(mx - 2, my - 2, 4, 7);
      c.fillStyle = i % 2 ? '#7dd9b0' : '#c25bd6'; c.beginPath(); c.ellipse(mx, my - 3, 6, 4, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#fff'; c.fillRect(mx - 2, my - 5, 2, 2);
    }
  }
}

// --- a picture of the question after a mistake: flowers in rows -----------------------------
let hintGate = -1, hintT = 0, pics = new Map();
function drawHint(ox, oy) {
  return;                                                // (no counting flowers in the English game)
  if (hintGate !== qi || activeGate !== qi || !qs[qi]) return;
  const f = qs[qi], gt = world.gates[qi]; hintT += 1 / 60;
  let rows = [];                                         // each row: list of colours ('' = a gap, '-' = taken away)
  const col = ['#ff6b8b', '#ffd23f', '#7ad9ff', '#9dff7a', '#d49bff', '#ffa25c', '#ff6b8b', '#ffd23f', '#7ad9ff', '#9dff7a'];
  if (f.op === '*' && f.a <= 10 && f.b <= 10) for (let r = 0; r < f.a; r++) rows.push(Array(f.b).fill(col[r]));
  else if (f.op === '/' && f.ans <= 10 && f.b <= 10) for (let r = 0; r < f.b; r++) rows.push(Array(f.ans).fill(col[r]));
  else if ((f.op === '+' && f.ans <= 20) || (f.op === '-' && f.a <= 20)) {
    const list = f.op === '+' ? [...Array(f.a).fill(col[0]), ...Array(f.b).fill(col[1])] : [...Array(f.a - f.b).fill(col[2]), ...Array(f.b).fill('-')];
    for (let i = 0; i < list.length; i += 10) rows.push(list.slice(i, i + 10));
  } else return;
  const sp = 28, x0 = (gt.plaza.x0 + 0.7) * T - ox, y0 = (gt.center.y + 0.5) * T - oy - (rows.length - 1) * sp / 2;
  let i = 0;
  rows.forEach((row, r) => row.forEach((c, k) => {
    const grow = Math.min(1, Math.max(0, hintT * 3 - i++ * 0.08)); if (!grow) return;
    const x = x0 + k * sp + (k >= 5 ? 8 : 0), y = y0 + r * sp, rr = 10 * grow;
    if (c === '-') { g.strokeStyle = 'rgba(80,60,40,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr * 0.8, 0, 7); g.stroke(); return; }
    g.fillStyle = c; for (let p = 0; p < 5; p++) { const an = p / 5 * 6.283 + clock * 0.3; g.beginPath(); g.arc(x + Math.cos(an) * rr * 0.55, y + Math.sin(an) * rr * 0.55, rr * 0.5, 0, 7); g.fill(); }
    g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(x, y, rr * 0.35, 0, 7); g.fill();
  }));
}

function drawGem(x, y, c, ph, groundY) {
  const H0 = c.h, L = c.l, t = clock;
  // shadow and a soft pulsing glow
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, groundY, 13, 4, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(x, y, 2, x, y, 30);
  gr.addColorStop(0, `hsla(${H0},100%,75%,${0.45 + 0.15 * Math.sin(t * 3 + ph)})`); gr.addColorStop(1, `hsla(${H0},100%,70%,0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill();
  // a brilliant cut: table and crown on top, pavilion below
  const w = 15, top = y - 12, gird = y - 4, tip = y + 15, tw = 7;
  const facet = (pts, light, alpha = 0.92) => { g.fillStyle = `hsla(${H0},85%,${light}%,${alpha})`; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const sh = Math.sin(t * 1.6 + ph) * 8;                       // light sweeping across the facets
  facet([x - tw, top, x + tw, top, x + w, gird, x - w, gird], L + 18 + sh);           // crown
  facet([x - tw, top, x, top, x - 5, gird], L + 30 - sh);
  facet([x, top, x + tw, top, x + 5, gird], L + 8 + sh);
  facet([x - w, gird, x - 5, gird, x, tip], L - 6 + sh);                               // pavilion
  facet([x - 5, gird, x + 5, gird, x, tip], L + 6 - sh);
  facet([x + 5, gird, x + w, gird, x, tip], L - 16 - sh);
  g.strokeStyle = `hsla(${H0},60%,22%,0.85)`; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x - tw, top); g.lineTo(x + tw, top); g.lineTo(x + w, gird); g.lineTo(x, tip); g.lineTo(x - w, gird); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(x - w + 2, gird); g.lineTo(x + w - 2, gird); g.stroke();
  // glassy highlight and twinkles
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(x - 5, top + 2); g.lineTo(x - 1, top + 2); g.lineTo(x - 7, gird - 1); g.lineTo(x - 10, gird - 1); g.closePath(); g.fill();
  for (let k = 0; k < 2; k++) {
    const p = (t * 0.9 + ph + k * 1.7) % 3;
    if (p > 0.6) continue;
    const a = Math.sin(p / 0.6 * Math.PI), sx = x + (k ? 9 : -6), sy = y + (k ? 4 : -12), r = 7 * a;
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + r * 0.25, sy - r * 0.25); g.lineTo(sx + r, sy); g.lineTo(sx + r * 0.25, sy + r * 0.25);
    g.lineTo(sx, sy + r); g.lineTo(sx - r * 0.25, sy + r * 0.25); g.lineTo(sx - r, sy); g.lineTo(sx - r * 0.25, sy - r * 0.25); g.closePath(); g.fill();
  }
}

function drawChar(img, x, y, dir, frame, npc) {
  if (!img) return;
  const s = SC * 1.15, w = 16 * s, h = 16 * s;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + h * 0.42, w * 0.32, h * 0.12, 0, 0, 7); g.fill();
  g.drawImage(img, dir * 16, frame * 16, 16, 16, x - w / 2, y - h * 0.6, w, h);
  if (npc) {                                            // a speech bubble: full until heard, then faint
    const by = y - h * 0.8 + Math.sin(clock * 3 + npc.bob) * 3;
    g.globalAlpha = npc.spoken ? 0.45 : 1;
    g.fillStyle = '#fff'; g.strokeStyle = '#1a2a4a'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(x - 20, by - 26, 40, 24, 8); g.fill(); g.stroke();
    g.fillStyle = '#1a2a4a'; for (const k of [-10, 0, 10]) { g.beginPath(); g.arc(x + k, by - 14, 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
}
function drawAnimal(a, x, y) {
  const img = IMG['a_' + a.kind]; if (!img) return;
  const s = SC, frames = Math.max(1, Math.floor(img.width / 16)), f = Math.hypot(a.vx, a.vy) > 1 ? Math.floor(clock * 6) % frames : 0;
  g.save(); g.translate(x, y); if (a.vx < 0) g.scale(-1, 1);
  g.drawImage(img, f * 16, 0, 16, 16, -8 * s, -10 * s, 16 * s, 16 * s);
  g.restore();
}

// test hook
window.__ln = { mons: () => mons.map(m => ({ x: m.x / T, y: m.y / T, a: m.a, b: m.b, kind: m.kind })), items: () => world.items, hits: () => hits,
  get: () => ({ running, qi, activeGate, hero: hero && { x: hero.x / T, y: hero.y / T }, pads: pads[qi] ? pads[qi].map(p => ({ x: p.x, y: p.y, val: p.val, correct: p.correct, state: p.state })) : [], q: qs && qs[qi] ? qs[qi].id : null, gate: world && world.gates[qi] ? world.gates[qi].plaza : null, chest: world && world.chest, finishT, vf: voiceFree(), q: queue.length, timer: !!qTimer, until: Math.round(speakingUntil - performance.now()), done: !!finish.done }),
  tp: (x, y) => { hero.tx = hero.fx = x; hero.ty = hero.fy = y; hero.moveT = 1; hero.x = (x + 0.5) * T; hero.y = (y + 0.5) * T; },
  map: () => ({ rivers: world.rivers, gems: world.gems.map(g => [g.x, g.y]), npcs: world.npcs, gates: world.gates.map(g => g.plaza), W: world.W, start: world.start }) };
