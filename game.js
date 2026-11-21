// English Ninja: a ninja with shurikens walks through five lands (desert oasis, jungle temple,
// dungeon, village at night, sky islands). In every arena creatures float with pictures; a voice
// names a thing in English and the ninja hits the creature carrying it with a shuriken. A wrong
// creature giggles and runs away, the right one goes poof and the barrier opens. Storytellers on
// the way say simple things in English (Polish captions). No timer, nothing to lose.

import { loadAudioBuffer } from './audio.js?v=131';
// own version for this game's audio: browsers keep audio for weeks
const AUDIO_VER = 'en20261120a';
import { buildWorld, BIOMES, DECOR, C, H } from './world.js?v=131';
import * as W from './words.js?v=131';
import { loadFactPics, stripHtml, markWords } from './factpics.js?v=131';
import { makeCrystal, drawCrystal, crystalColour } from './treasure.js?v=131';

const TS = 16, SC = 3, T = TS * SC;                 // tiles: 16 px drawn at 3x
const TILES_PER_S = 5.4;
const CARD_DY = T * 1.45, AIM_DY = T * 0.8;      // a creature's picture card floats above it                          // walking speed, tiles per second
const el = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
export const HEROES = {
  NinjaFire: { name: 'Fire Ninja', color: '#ff7a3c' }, NinjaWater: { name: 'Water Ninja', color: '#4fc3ff' },
  NinjaThunder: { name: 'Thunder Ninja', color: '#ffe04a' }, NinjaMasked: { name: 'Snow Ninja', color: '#e8ecff' },
};

// --- images ---------------------------------------------------------------
const IMG = {};
const loadImg = (k, src) => new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => res(); i.src = src; });
async function loadImages() {
  const A = new URL('./assets/', import.meta.url).href;
  const list = [['floor', 'TilesetFloor.png'], ['ifloor', 'tiles/TilesetInteriorFloor.png'], ['kd', 'tiles/KenneyTinyDungeon.png'], ['kt', 'tiles/KenneyTinyTown.png'],
    ['desert', 'tiles/TilesetDesert.png'], ['village', 'tiles/TilesetVillageAbandoned.png'], ['towers', 'tiles/TilesetTowers.png'], ['clouds', 'tiles/TilesetClouds.png'],
    ['leaf', 'fx/Leaf.png'], ['spark', 'fx/Spark.png'], ['shuriken', 'fx/Shuriken.png'], ['smoke', 'fx/Smoke.png']];
  for (const p of ['star_07', 'star_04', 'magic_02', 'circle_05', 'light_01', 'twirl_02', 'smoke_04', 'spark_05']) list.push(['k_' + p, `fx/k_${p}.png`]);
  for (const h of Object.keys(HEROES)) list.push(['h_' + h, `heroes/${h}.png`]);
  for (const b of BIOMES) {
    for (const p of [...b.people.m, ...b.people.f]) list.push(['p_' + p, `people/${p}.png`]);
    for (const c of [...b.creatures, b.monster]) list.push(['m_' + c, `creatures/${c}.png`]);
    for (const a of b.animals) list.push(['a_' + a, `animals/${a}.png`]);
  }
  await Promise.all([...new Map(list.map(x => [x[0], x])).values()].map(([k, f]) => loadImg(k, A + f)));
}
// white Kenney particles tinted once per colour
const tints = new Map();
function tinted(key, color) {
  const id = key + color; if (tints.has(id)) return tints.get(id);
  const img = IMG[key]; if (!img) return null;
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d'); c.drawImage(img, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
  tints.set(id, cv); return cv;
}

// --- audio: one voice at a time, with pauses -------------------------------------------
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
  const gn = c.createGain(); gn.gain.value = vol; gn.connect(master);
  const s = c.createBufferSource(); s.buffer = b; s.connect(gn); s.start();
}
function playMusic(name) {
  const c = ctx(), b = music.get(name); if (!c || !b) return;
  if (musicSrc && musicSrc._name === name) return;
  const old = musicSrc;
  if (old) { try { old._g.gain.linearRampToValueAtTime(0, c.currentTime + 1.5); old.stop(c.currentTime + 1.6); } catch (_) {} }
  const gn = c.createGain(); gn.gain.value = 0; gn.connect(musicGain); gn.gain.linearRampToValueAtTime(1, c.currentTime + 2);
  const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(gn); s.start(); s._g = gn; s._name = name; musicSrc = s;
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
let canvas, g, shade, sg, world, cfg, qs, running = false, paused = false, lastT = 0, onEnd = null;
let hero, heroKey = 'NinjaFire', cam = { x: 0, y: 0 }, qi = 0, activeGate = -1, mistakes = 0, firstTry = 0, qMistakes = 0, finishT = -1, clock = 0;
let gemsTaken = 0, lockT = 0, darkNow = 0;
const MAGNET_S = 20, MON_TPS = 1.5;
let mons = [], magnetLeft = 0, invuln = 0, trail = [], chased = 0, hits = 0, thrown = 0;
let birds = [], fish = [], birdT = 6, stars = [], flyCards = [], poofs = [];
const GEMS = [{ h: 350, l: 58 }, { h: 42, l: 58 }, { h: 140, l: 48 }, { h: 205, l: 55 }, { h: 280, l: 60 }];
let gemCounts = [0, 0, 0, 0, 0];
let treasure = null;   // { cr, t }: the crystal in the chest, t < 0 until it is opened
let chunks = new Map(), npcs = [], animals = [], parts = [], crit = [], facts = [], heard = [], pics = new Map(), litDecor = [];
const keys = {}, stick = { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0, t0: 0, moved: 0 };

export async function initGame({ levelEnd }) {
  onEnd = levelEnd;
  canvas = el('canvas'); g = canvas.getContext('2d');
  shade = document.createElement('canvas'); sg = shade.getContext('2d');
  const resize = () => { canvas.width = shade.width = window.innerWidth; canvas.height = shade.height = window.innerHeight; g.imageSmoothingEnabled = false; };
  resize(); window.addEventListener('resize', resize);
  const map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  window.addEventListener('keydown', e => {
    if (map[e.code]) { keys[map[e.code]] = true; e.preventDefault(); }
    if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF' || e.code === 'KeyJ') && !e.repeat) { throwStar(); e.preventDefault(); }
    if (e.code === 'KeyH' || e.code === 'KeyR') repeatQuestion();
    if (e.code === 'KeyP') togglePause();
  });
  window.addEventListener('keyup', e => { if (map[e.code]) keys[map[e.code]] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // touch: drag anywhere = joystick, a quick tap = throw
  canvas.addEventListener('pointerdown', e => { stick.active = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; stick.t0 = performance.now(); stick.moved = 0; });
  canvas.addEventListener('pointermove', e => { if (!stick.active || e.pointerId !== stick.id) return; const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy); stick.moved = Math.max(stick.moved, l); const k = Math.min(1, l / 50) / (l || 1); stick.x = dx * k; stick.y = dy * k; });
  const up = (e) => { if (e.pointerId === stick.id) { if (stick.moved < 12 && performance.now() - stick.t0 < 300) throwStar(); stick.active = false; stick.x = stick.y = 0; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  el('throw-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); throwStar(); });
  el('say-btn').addEventListener('click', repeatQuestion);
  el('pause-btn').addEventListener('click', togglePause);
  el('mute-btn').addEventListener('click', () => { muted = !muted; if (master) master.gain.value = muted ? 0 : 1; el('mute-btn').textContent = muted ? '🔇' : '🔊'; });
}

function togglePause() { if (!running) return; paused = !paused; el('pause-box').classList.toggle('hidden', !paused); }
export function stopGame() { running = false; clearTimeout(caption.t); el('npc-bubble').classList.add('hidden'); queue.length = 0; clearTimeout(qTimer); qTimer = null; speak([]); if (musicSrc) { try { musicSrc.stop(); } catch (_) {} musicSrc = null; } }

export async function startGame(c) {
  cfg = c; heroKey = HEROES[c.hero] ? c.hero : 'NinjaFire';
  const overlay = el('loading-overlay'), fill = el('loading-fill'), text = el('loading-text');
  overlay.classList.remove('hidden'); el('loading-play-btn').classList.add('hidden');
  ctx();
  text.textContent = 'Loading voices and music…'; fill.style.width = '0%';
  const AU = new URL('./audio/', import.meta.url).href, SFX = new URL('./assets/sfx/', import.meta.url).href, MU = new URL('./assets/music/', import.meta.url).href;
  if (!facts.length) facts = (await (await fetch(new URL('./facts.json?v=' + AUDIO_VER, import.meta.url))).json());
  await loadFactPics();
  await W.loadVocab();
  qs = W.pickRound(c.cat, 10).map(id => ({ id, options: [id, ...W.distractors(id, 3)].sort(() => Math.random() - 0.5), variant: Math.random() < 0.6 ? 1 : 2 }));
  const all = [...new Set(qs.flatMap(q => q.options))];
  treasure = { cr: makeCrystal(), t: -1, said: false, popped: false };
  const names = [...W.COMMON_CLIPS, ...W.roundClips(qs), `w_${treasure.cr.w}_t`];
  const SFXN = ['bonus2', 'coin', 'impact', 'levelup1', 'power_freeze', 'power_end', 'throw', 'boing', 'poof', 'open', 'chase'];
  let done = 0; const total = names.length + SFXN.length;
  const tick = () => { fill.style.width = Math.round(++done / total * 70) + '%'; };
  await Promise.all([loadImages(), W.preloadPictures(all), ...names.map(n => loadClip(n, AU).then(tick)), ...SFXN.map(n => loadClip(n, SFX).then(tick))]);
  text.textContent = 'Building the land…'; fill.style.width = '75%';
  pics = new Map();
  for (const id of all) pics.set(id, await W.pictureCanvas(id, 128));
  world = buildWorld(qs, { monsters: !!c.monsters });
  chunks = new Map();
  litDecor = world.decor.filter(d => DECOR[d.name].lit);
  // the creatures of every arena: the right picture + plausible wrong ones, each with a land's creature
  crit = world.gates.map((gt, i) => {
    const q = qs[i], b = BIOMES[world.biomeOf(gt.plaza.x0)], kinds = [...b.creatures].sort(() => Math.random() - 0.5);
    const spots = q.options.length <= 3 ? [gt.spots[0], gt.spots[1], gt.spots[3]].slice(0, q.options.length) : gt.spots;
    return q.options.map((val, k) => ({ gate: i, val, correct: val === q.id, kind: kinds[k % kinds.length], home: spots[k], x: (spots[k].x + 0.5) * T, y: (spots[k].y + 0.5) * T,
      ph: Math.random() * 6.28, state: 'idle', t: 0, dir: 2, alpha: 1, fy: 0 }));
  });
  // storytellers: facts never twice in a row of games
  let seen = []; try { seen = JSON.parse(localStorage.getItem('english_facts_seen') || '[]'); } catch (_) {}
  const okF = facts.facts;
  const fresh = okF.filter(f => !seen.includes(f.id)).sort(() => Math.random() - 0.5), old = okF.filter(f => seen.includes(f.id)).sort(() => Math.random() - 0.5);
  const chosen = [...fresh, ...old];
  npcs = world.npcs.map((p, i) => {
    const f = chosen[i % chosen.length], b = BIOMES[world.biomeOf(p.x)], list = b.people[f.voice === 'f' ? 'f' : 'm'];
    return { x: (p.x + 0.5) * T, y: (p.y + 0.5) * T, fact: f, who: list[i % list.length], armed: true, awayT: 0, spoken: false, bob: Math.random() * 6 };
  });
  text.textContent = 'Inviting the storytellers…'; fill.style.width = '85%';
  await Promise.all(npcs.map(n => loadClip('npc_' + n.fact.id, AU)));
  await Promise.all(BIOMES.map(async b => {
    if (music.has(b.music)) return;
    const r = await loadAudioBuffer(ctx(), MU + b.music, AUDIO_VER); if (r.buffer) music.set(b.music, r.buffer);
  }));
  // a couple of animals in the storytellers' clearings
  animals = [];
  for (const p of world.npcs) {
    const b = BIOMES[world.biomeOf(p.x)], h = { x0: p.x - 2, y0: p.y - 1, x1: p.x + 2, y1: p.y + 1 };
    if (b.animals.length && Math.random() < 0.7) animals.push({ kind: b.animals[Math.floor(Math.random() * b.animals.length)], x: (p.x + 1.5) * T, y: (p.y + 0.5) * T, vx: 0, vy: 0, t: 0, home: h });
  }
  mons = world.monsters.map(m => ({ ...m, t: Math.random(), dirSign: 1, x: (m.a.x + 0.5) * T, y: (m.a.y + 0.5) * T, dir: 0, pause: 0, gone: 0 }));
  magnetLeft = invuln = 0; trail = []; chased = hits = thrown = 0; birds = []; fish = []; birdT = 4; stars = []; flyCards = []; poofs = [];
  hero = { x: (world.start.x + 0.5) * T, y: (world.start.y + 0.5) * T, tx: world.start.x, ty: world.start.y, fx: world.start.x, fy: world.start.y, moveT: 1, dir: 3, frame: 0, moving: false, aim: { x: 1, y: 0 }, throwT: 0 };
  cam.x = hero.x; cam.y = hero.y;
  finish.done = false; landShown = -1; gemsTaken = 0; gemCounts = [0, 0, 0, 0, 0]; lockT = 0; darkNow = 0;
  el('gem-box').classList.add('hidden');
  el('gem-box').innerHTML = GEMS.map((cc, i) => `<span class="gc hidden" id="gc${i}" style="--h:${cc.h};--l:${cc.l}%"><i></i><b>0</b></span>`).join('');
  world.gems.forEach((gm, i) => { gm.c = (i * 3 + Math.floor(Math.random() * 5)) % 5; gm.ph = Math.random() * 6.28; });
  qi = 0; activeGate = -1; mistakes = 0; firstTry = 0; qMistakes = 0; finishT = -1; parts = []; heard = []; clock = 0;
  queue.length = 0; speakingUntil = 0;
  el('throw-btn').style.setProperty('--hc', HEROES[heroKey].color);
  updateHud();
  fill.style.width = '100%'; text.textContent = 'Ready! Off you go.';
  await new Promise(res => { const b = el('loading-play-btn'); b.classList.remove('hidden'); b.onclick = () => { b.classList.add('hidden'); ctx(); res(); }; });
  overlay.classList.add('hidden');
  running = true; paused = false; lastT = performance.now();
  requestAnimationFrame(loop);
}

let landShown = -1;
function showLand(b) {
  if (b === landShown) return; landShown = b;
  playMusic(BIOMES[b].music);
  const ln = el('land-name'); ln.textContent = BIOMES[b].name; ln.classList.add('show'); clearTimeout(showLand.t); showLand.t = setTimeout(() => ln.classList.remove('show'), 2600);
}

function updateHud() {
  const f = qs[qi], prev = qs[qi - 1];
  const box = el('q-box');
  if (f && activeGate === qi) { el('q-text').textContent = W.item(f.id).say['q' + f.variant]; box.classList.remove('solved'); }
  else if (prev) { const it = W.item(prev.id); el('q-text').textContent = `${it.en} = ${it.pl}`; box.classList.add('solved'); }
  else { el('q-text').textContent = '➜'; box.classList.remove('solved'); }
  el('dots').innerHTML = qs.map((_, i) => `<i class="${i < qi ? 'done' : i === qi ? 'now' : ''}"></i>`).join('');
}
function repeatQuestion() { if (running && qs && qs[qi] && finishT < 0) { queue.length = 0; clearTimeout(qTimer); qTimer = null; const ms = speak([W.clipQ(qs[qi].id, qs[qi].variant)]); speakingUntil = performance.now() + ms + 400; } }
function caption(name, textS, ms, pl = '', factId = null) {
  const strip = factId ? stripHtml(factId, textS, ms) : '';
  el('npc-pics').innerHTML = strip; el('npc-pics').classList.toggle('hidden', !strip);
  if (factId) el('npc-text').innerHTML = markWords(factId, textS); else el('npc-text').textContent = textS;
  el('npc-name').textContent = name; el('npc-pl').textContent = pl; el('npc-bubble').classList.remove('hidden');
  clearTimeout(caption.t); caption.t = setTimeout(() => el('npc-bubble').classList.add('hidden'), ms + (strip ? 6000 : 800));   // fact pictures stay a while after the voice
}

// --- movement against the tile grid ------------------------------------
const walkable = (tx, ty) => { const v = world.at(tx, ty); return v === C.PATH || v === C.PLAZA || v === C.CLEAR || v === C.BRIDGE; };
const solid = (tx, ty) => { const v = world.at(tx, ty); return v === C.BLOCK || v === C.BAR; };

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  clock += dt;
  let ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) + stick.x, iy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0) + stick.y;
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  if (finishT >= 0) { ix = iy = 0; }
  if (Math.hypot(ix, iy) > 0.3) { const k = Math.hypot(ix, iy); hero.aim = { x: ix / k, y: iy / k }; }
  if (lockT > 0) lockT -= dt;
  if (hero.throwT > 0) hero.throwT -= dt;
  // tile-by-tile movement: glide from the centre of one tile to the next
  if (hero.moveT >= 1) {
    let dx = 0, dy = 0;
    if (Math.abs(ix) > 0.3 || Math.abs(iy) > 0.3) {
      if (Math.abs(ix) >= Math.abs(iy)) dx = Math.sign(ix); else dy = Math.sign(iy);
      hero.dir = dx > 0 ? 3 : dx < 0 ? 2 : dy > 0 ? 0 : 1;
      const nx = hero.tx + dx, ny = hero.ty + dy;
      const go = (x, y) => { hero.fx = hero.tx; hero.fy = hero.ty; hero.tx = x; hero.ty = y; hero.moveT = 0; trail.push([hero.fx, hero.fy]); if (trail.length > 30) trail.shift(); };
      if (walkable(nx, ny)) go(nx, ny);
      else if (dx && !dy) { for (const sy of [1, -1]) if (Math.abs(iy) > 0.15 && Math.sign(iy) === sy && walkable(hero.tx, hero.ty + sy)) { go(hero.tx, hero.ty + sy); break; } }
      else if (dy && !dx) { for (const sx of [1, -1]) if (Math.abs(ix) > 0.15 && Math.sign(ix) === sx && walkable(hero.tx + sx, hero.ty)) { go(hero.tx + sx, hero.ty); break; } }
    }
  }
  hero.moving = hero.moveT < 1;
  if (hero.moving) { hero.moveT = Math.min(1, hero.moveT + dt * TILES_PER_S); hero.frame += dt * 8; }
  hero.x = (hero.fx + (hero.tx - hero.fx) * hero.moveT + 0.5) * T;
  hero.y = (hero.fy + (hero.ty - hero.fy) * hero.moveT + 0.5) * T;
  cam.x += (hero.x - cam.x) * Math.min(1, 6 * dt); cam.y += (hero.y - cam.y) * Math.min(1, 6 * dt);
  { const vw = canvas.width, vh = canvas.height;
    cam.x = Math.max(vw / 2, Math.min(world.W * T - vw / 2, cam.x)); cam.y = Math.max(vh / 2, Math.min(H * T - vh / 2, cam.y)); }
  const tx = Math.floor(hero.x / T), ty = Math.floor(hero.y / T);
  showLand(world.biomeOf(tx));
  const want = BIOMES[landShown].dark || 0; darkNow += (want - darkNow) * Math.min(1, dt * 1.5);
  // entering an arena: the question
  const gt = world.gates[qi];
  if (gt && activeGate !== qi && tx >= gt.plaza.x0 && tx <= gt.plaza.x1 && ty >= gt.plaza.y0 && ty <= gt.plaza.y1) {
    activeGate = qi; qMistakes = 0; updateHud(); dropLow();
    enqueue({ clips: [W.clipQ(qs[qi].id, qs[qi].variant)], gap: 600 });
  }
  updateCreatures(dt);
  updateStars(dt);
  // storytellers
  for (const n of npcs) {
    const d = Math.hypot(hero.x - n.x, hero.y - n.y);
    if (d > T * 6) { n.awayT += dt; if (n.awayT > 3) n.armed = true; } else if (!n.armed) n.awayT = 0;
    if (n.armed && d < T * 2.4 && voiceFree() && finishT < 0) {
      n.armed = false; n.awayT = 0;
      if (!n.spoken) { heard.push(n.fact); n.spoken = true; try { const s = JSON.parse(localStorage.getItem('english_facts_seen') || '[]'); s.push(n.fact.id); localStorage.setItem('english_facts_seen', JSON.stringify(s.slice(-400))); } catch (_) {} }
      enqueue({ clips: ['npc_' + n.fact.id], gap: 900, low: true, onStart: (ms) => caption(nameOf(n.who), n.fact.text, ms, '', n.fact.id) });
    }
  }
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
    sparkle((gm.x + 0.5) * T, (gm.y + 0.5) * T, `hsl(${GEMS[gm.c].h},95%,75%)`, 14);
  }
  // the end: treasure
  if (finishT < 0 && qi >= qs.length && Math.hypot(hero.x - (world.chest.x + 0.5) * T, hero.y - (world.chest.y + 0.5) * T) < T * 1.5) {
    finishT = 0; treasure.t = 0; sfx('levelup1', 0.6); sfx('open', 0.5);
    for (let k = 0; k < 5; k++) setTimeout(() => sparkle((world.chest.x + 0.5) * T + rnd(-60, 60), world.chest.y * T + rnd(-60, 30), `hsl(${rnd(0, 360)},90%,70%)`, 22, true), k * 220);
  }
  if (finishT >= 0) { finishT += dt; if (finishT > 6.4 && voiceFree() && !finish.done) { finish.done = true; setTimeout(finish, 600); } }
  if (treasure && treasure.t >= 0) {
    treasure.t += dt;
    const cx = (world.chest.x + 0.5) * T, cy = (world.chest.y + 0.5) * T, col = crystalColour(treasure.cr);
    if (!treasure.popped && treasure.t > 1.05) {                          // out it pops
      treasure.popped = true; sfx('bonus2', 0.6); sfx('coin', 0.5);
      for (let k = 0; k < 4; k++) setTimeout(() => sparkle(cx + rnd(-50, 50), cy - T * 2.2 + rnd(-50, 40), treasure.cr.w === 'white' ? `hsl(${rnd(0, 360)},90%,75%)` : col, 18, k === 0), k * 140);
    }
    if (!treasure.said && treasure.t > 1.6) { treasure.said = true; queue.length = 0; enqueue({ clips: [`w_${treasure.cr.w}_t`], gap: 400 }); }   // old leftovers give way to the treasure
  }
  updateMonsters(dt);
  updateLife(dt);
  updateParticles(dt);
}

// --- shurikens -----------------------------------------------------------------------
function throwStar() {
  if (!running || paused || finishT >= 0 || !hero) return;
  if (stars.filter(s => !s.dead).length >= 2) return;
  const dirs = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  let ax = hero.aim.x, ay = hero.aim.y;
  if (!ax && !ay) [ax, ay] = dirs[hero.dir];
  // generous aim: the nearest creature (or path monster) within a wide cone ahead
  let best = null, bestD = 1e9;
  const consider = (o, x, y) => {
    const dx = x - hero.x, dy = y - hero.y, d = Math.hypot(dx, dy);
    if (d > T * 11 || d < 1) return;
    const cos = (dx * ax + dy * ay) / d;
    if (cos < 0.42) return;                                   // ~65° each side
    const score = Math.acos(Math.min(1, cos)) + d / T * 0.02;   // the one most in line with the aim
    if (score < bestD) { bestD = score; best = o; }
  };
  for (const cr of crit[qi] || []) if (cr.state === 'idle' && activeGate === qi) consider(cr, cr.x, cr.y - AIM_DY);
  for (const m of mons) if (m.gone <= 0) consider(m, m.x, m.y);
  thrown++; hero.throwT = 0.28; sfx('throw', 0.45);
  if (best) { const tx = best.x - hero.x, ty = (best.state ? best.y - AIM_DY : best.y) - hero.y, k = Math.hypot(tx, ty); ax = tx / k; ay = ty / k; }
  if (Math.abs(ax) > Math.abs(ay)) hero.dir = ax > 0 ? 3 : 2; else hero.dir = ay > 0 ? 0 : 1;
  const sp = T * 15;
  stars.push({ x: hero.x + ax * 20, y: hero.y - 10 + ay * 20, vx: ax * sp, vy: ay * sp, t: 0, rot: 0, target: best, dead: false });
}
function updateStars(dt) {
  for (const s of stars) {
    if (s.dead) continue;
    s.t += dt; s.rot += dt * 22;
    const tg = s.target;
    if (tg && ((tg.state && tg.state === 'idle') || (!tg.state && tg.gone <= 0))) {      // home in, gently
      const ty = tg.state ? tg.y - AIM_DY : tg.y, dx = tg.x - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(s.vx, s.vy);
      const k = Math.min(1, dt * 9); s.vx += (dx / d * sp - s.vx) * k; s.vy += (dy / d * sp - s.vy) * k;
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (Math.random() < 0.7) parts.push({ kind: 'kp', key: 'k_light_01', color: HEROES[heroKey].color, x: s.x, y: s.y, vx: 0, vy: 0, t: 0, life: 0.35, size: 34, add: true });
    // hits: arena creatures (their picture card or body), path monsters
    for (const cr of crit[qi] || []) {
      if (cr.state !== 'idle' || activeGate !== qi) continue;
      if (s.target && s.target.state && cr !== s.target) continue;           // an aimed star flies past the others
      if (Math.hypot(s.x - cr.x, s.y - (cr.y - CARD_DY)) < T * 0.95 || Math.hypot(s.x - cr.x, s.y - cr.y) < T * 0.7) { s.dead = true; hit(cr, s); break; }
    }
    if (s.dead) continue;
    for (const m of mons) if (m.gone <= 0 && Math.hypot(s.x - m.x, s.y - m.y) < T * 0.7) {
      s.dead = true; m.gone = 8; chased++; sfx('chase', 0.5); puff(m.x, m.y - 10, '#ffffff'); break;
    }
    if (s.dead) continue;
    const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T);
    if (s.t > 1.1 || solid(tx, ty)) { s.dead = true; for (let k = 0; k < 6; k++) parts.push({ kind: 'dot', x: s.x, y: s.y, vx: rnd(-80, 80), vy: rnd(-120, -20), t: 0, life: 0.4, color: '#dfe6ff', g: 400 }); }
  }
  stars = stars.filter(s => !s.dead);
}

// --- the arena creatures ----------------------------------------------------------------
function updateCreatures(dt) {
  for (const list of crit) for (const cr of list) {
    cr.t += dt;
    if (cr.state === 'gone') continue;
    const near = Math.abs(cr.x - hero.x) < canvas.width && Math.abs(cr.y - hero.y) < canvas.height;
    if (!near && cr.state === 'idle') continue;
    if (cr.state === 'idle') {                                // floating about its spot
      cr.x = (cr.home.x + 0.5 + Math.sin(clock * 0.7 + cr.ph) * 0.55) * T;
      cr.y = (cr.home.y + 0.5 + Math.cos(clock * 0.9 + cr.ph * 1.3) * 0.35) * T;
      cr.dir = Math.abs(hero.x - cr.x) > Math.abs(hero.y - cr.y) ? (hero.x < cr.x ? 2 : 3) : (hero.y < cr.y ? 1 : 0);
    } else if (cr.state === 'giggle') {
      if (cr.t > 1.0) { cr.state = 'flee'; cr.t = 0; }
    } else if (cr.state === 'flee') {                        // off it goes, up and away
      cr.fy += dt * T * 7; cr.x += Math.sin(cr.t * 8 + cr.ph) * 2; cr.alpha = Math.max(0, 1 - cr.t / 1.1);
      if (cr.t > 1.1) cr.state = 'gone';
    } else if (cr.state === 'poof') { if (cr.t > 0.05) cr.state = 'gone'; }
  }
  for (const f of flyCards) f.t += dt;
  flyCards = flyCards.filter(f => f.t < 1.1);
  for (const p of poofs) p.t += dt;
  poofs = poofs.filter(p => p.t < 0.6);
}

function hit(cr, s) {
  if (lockT > 0 || finishT >= 0) { sfx('boing', 0.4); return; }
  const f = qs[qi];
  if (cr.correct) {
    cr.state = 'poof'; cr.t = 0; sfx('poof', 0.6); sfx('bonus2', 0.45);
    if (qMistakes === 0) firstTry++;
    poofs.push({ x: cr.x, y: cr.y - 10, t: 0 });
    sparkle(cr.x, cr.y - CARD_DY, HEROES[heroKey].color, 26, true);
    flyCards.push({ val: cr.val, x: cr.x - cam.x + canvas.width / 2, y: cr.y - CARD_DY - cam.y + canvas.height / 2, t: 0 });
    for (const o of crit[qi]) if (o !== cr && o.state === 'idle') { o.state = 'flee'; o.t = -0.4; }
    const gt = world.gates[qi];
    setTimeout(() => {                                       // the barrier dissolves
      if (!running) return;
      for (const b of gt.bars) { world.set(b.x, b.y, C.PATH); sparkle((b.x + 0.5) * T, (b.y + 0.5) * T, `hsl(${BIOMES[world.biomeOf(b.x)].barrier},90%,70%)`, 10, true); }
      sfx('open', 0.5);
    }, 700);
    W.recordWord(f.id, qMistakes === 0);
    dropLow();
    enqueue({ clips: ['e_yes' + (1 + Math.floor(Math.random() * 5)), `w_${f.id}_a`], gap: cfg.polish ? 700 : 1400 });
    if (cfg.polish) enqueue({ clips: [`w_${f.id}_pl`], gap: 1400 });
    qi++;
    updateHud();
  } else {
    cr.state = 'giggle'; cr.t = 0; mistakes++; qMistakes++; sfx('boing', 0.55); lockT = 1.2;
    W.recordWord(f.id, false);
    for (let k = 0; k < 10; k++) parts.push({ kind: 'dot', x: s.x, y: s.y, vx: -s.vx * 0.15 + rnd(-90, 90), vy: -s.vy * 0.15 + rnd(-140, -20), t: 0, life: 0.5, color: '#dfe6ff', g: 500 });
    dropLow();
    enqueue({ clips: ['e_oops', `w_${cr.val}_t`], gap: 700 });           // what that creature had, then the word once more
    enqueue({ clips: [W.clipQ(f.id, f.variant)], gap: 600 });
  }
}

function finish() {
  running = false;
  clearTimeout(caption.t); el('npc-bubble').classList.add('hidden');
  if (musicSrc) { try { musicSrc.stop(); } catch (_) {} musicSrc = null; }
  const st = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
  onEnd && onEnd({ crystal: treasure && treasure.cr, stars: st, mistakes, firstTry, total: qs.length, heard, gems: gemsTaken, gemsTotal: world.gems.length, monsters: mons.length, chased, thrown });
}

// --- path monsters and the magnet ----------------------------------------------------------
function updateMonsters(dt) {
  if (invuln > 0) invuln -= dt;
  const wasF = magnetLeft > 0;
  if (magnetLeft > 0) magnetLeft = Math.max(0, magnetLeft - dt);
  if (wasF && !magnetLeft) sfx('power_end', 0.5);
  if (magnetLeft > 0) for (const gm of world.gems) {
    if (gm.taken) continue;
    const gx = (gm.x + 0.5) * T, gy = (gm.y + 0.5) * T, d = Math.hypot(hero.x - gx, hero.y - gy);
    if (d > T * 10) continue;
    const v = Math.min(d, T * 9 * dt); gm.x += (hero.x - gx) / d * v / T; gm.y += (hero.y - gy) / d * v / T; gm.pulled = true;
  }
  for (const it of world.items) if (!it.taken && Math.hypot(hero.x - (it.x + 0.5) * T, hero.y - (it.y + 0.5) * T) < T * 0.7) {
    it.taken = true; magnetLeft = MAGNET_S; sfx('power_freeze', 0.6);
    sparkle((it.x + 0.5) * T, (it.y + 0.5) * T, '#aee6ff', 14);
  }
  for (const m of mons) {
    if (m.gone > 0) { m.gone -= dt; if (m.gone <= 0) { m.t = 0; m.dirSign = 1; } continue; }
    m.anim = (m.anim || 0) + dt * 6;
    if (m.pause > 0) m.pause -= dt;
    else {
      const len = Math.abs(m.b.x - m.a.x) + Math.abs(m.b.y - m.a.y) || 1;
      m.t += m.dirSign * dt * MON_TPS / len;
      if (m.t >= 1) { m.t = 1; m.dirSign = -1; m.pause = 0.8; } else if (m.t <= 0) { m.t = 0; m.dirSign = 1; m.pause = 0.8; }
    }
    const dx = (m.b.x - m.a.x) * m.dirSign, dy = (m.b.y - m.a.y) * m.dirSign;
    m.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1);
    m.x = (m.a.x + (m.b.x - m.a.x) * m.t + 0.5) * T; m.y = (m.a.y + (m.b.y - m.a.y) * m.t + 0.5) * T;
    if (Math.abs(hero.x - m.x) < T * 0.7 && Math.abs(hero.y - m.y) < T * 0.7 && finishT < 0 && invuln <= 0) hurt(m);
  }
}
// touched by a monster: a bump, back a few steps, a moment of safety
function hurt(m) {
  hits++; invuln = 2; m.pause = 1.2; sfx('impact', 0.5);
  for (let k = 0; k < 12; k++) parts.push({ kind: 'dot', x: hero.x, y: hero.y, vx: rnd(-120, 120), vy: rnd(-160, 0), t: 0, life: 0.6, color: '#ff8a5c', g: 300 });
  let back = null;
  for (let i = trail.length - 1; i >= 0; i--) {
    const [x, y] = trail[i];
    if (mons.every(o => o.gone > 0 || Math.hypot((x + 0.5) * T - o.x, (y + 0.5) * T - o.y) > T * 2.2) && trail.length - i >= 3) { back = trail[i]; trail.length = i; break; }
  }
  if (back) { hero.tx = hero.fx = back[0]; hero.ty = hero.fy = back[1]; hero.moveT = 1; }
  for (const k in keys) keys[k] = false; stick.x = stick.y = 0;
}

// --- life around ---------------------------------------------------------------------
function updateLife(dt) {
  const vw = canvas.width, vh = canvas.height, b = BIOMES[landShown] || BIOMES[0];
  birdT -= dt;
  if (birdT <= 0 && (b.id === 'oasis' || b.id === 'sky' || b.id === 'temple')) {
    birdT = rnd(12, 22);
    const dir = Math.random() < 0.5 ? 1 : -1, n = 3 + Math.floor(rnd(0, 5)), y0 = cam.y + rnd(-vh * 0.4, vh * 0.1);
    for (let i = 0; i < n; i++) { const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1); birds.push({ x: cam.x - dir * (vw / 2 + 60 + Math.abs(k) * 26), y: y0 + Math.abs(k) * 16, vx: dir * rnd(95, 105), ph: rnd(0, 6), life: 0 }); }
  }
  for (let i = birds.length - 1; i >= 0; i--) { const o = birds[i]; o.life += dt; o.x += o.vx * dt; o.y += Math.sin(o.life * 1.3 + o.ph) * 6 * dt; if (o.life > 30) birds.splice(i, 1); }
}

// --- particles ------------------------------------------------------------------------
function sparkle(x, y, color, n, ring = false) {
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(60, 260); parts.push({ kind: 'kp', key: i % 3 ? 'k_star_07' : 'k_star_04', color, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0, life: rnd(0.5, 0.9), size: rnd(22, 46), rot: rnd(0, 6), vr: rnd(-4, 4), add: true, drag: 2.5 }); }
  if (ring) parts.push({ kind: 'ring', key: 'k_circle_05', color, x, y, t: 0, life: 0.6, size: 40, add: true });
}
function puff(x, y, color) {
  poofs.push({ x, y, t: 0 });
  for (let i = 0; i < 6; i++) { const a = rnd(0, 6.28); parts.push({ kind: 'kp', key: 'k_smoke_04', color, x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, t: 0, life: 0.6, size: 50, rot: rnd(0, 6), vr: rnd(-2, 2), alpha: 0.5, drag: 2 }); }
}
function updateParticles(dt) {
  const b = BIOMES[landShown] || BIOMES[0], vw = canvas.width, vh = canvas.height;
  const want = { sun: 16, leaves: 26, dust: 40, fireflies: 45, clouds: 6 }[b.fx] || 0;
  const amb = parts.filter(p => p.amb).length;
  for (let i = amb; i < want; i++) {
    const x = cam.x + rnd(-vw / 2, vw / 2), y = cam.y + rnd(-vh / 2, vh / 2);
    if (b.fx === 'leaves') parts.push({ amb: 1, kind: 'leaf', x, y: cam.y - vh / 2 - rnd(0, 60), vx: rnd(10, 40), vy: rnd(30, 60), life: 20, t: 0, f: Math.floor(rnd(0, 6)), ph: rnd(0, 6) });
    else if (b.fx === 'fireflies') parts.push({ amb: 1, kind: 'firefly', x, y, vx: 0, vy: 0, life: rnd(5, 10), t: 0, ph: rnd(0, 6) });
    else if (b.fx === 'dust') parts.push({ amb: 1, kind: 'mote', x, y, vx: rnd(-6, 6), vy: rnd(-10, -2), life: rnd(4, 9), t: 0, ph: rnd(0, 6), c: '#ffe0b0' });
    else if (b.fx === 'sun') parts.push({ amb: 1, kind: 'mote', x, y, vx: rnd(10, 30), vy: rnd(-6, 6), life: rnd(4, 8), t: 0, ph: rnd(0, 6), c: '#fff1c0' });
    else if (b.fx === 'clouds') parts.push({ amb: 1, kind: 'cloud', x: cam.x - vw / 2 - 300 - rnd(0, vw), y: cam.y + rnd(-vh / 2, vh / 2), vx: rnd(25, 45), vy: 0, life: 60, t: 0, size: rnd(260, 420), rot: rnd(0, 6) });
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.kind === 'dot') p.vy += p.g * dt;
    else if (p.kind === 'firefly') { p.vx += rnd(-60, 60) * dt; p.vy += rnd(-60, 60) * dt; p.vx *= 0.97; p.vy *= 0.97; }
    else if (p.kind === 'leaf') p.x += Math.sin(p.t * 1.5 + p.ph) * 20 * dt;
    if (p.drag) { p.vx *= Math.max(0, 1 - p.drag * dt); p.vy *= Math.max(0, 1 - p.drag * dt); }
    if (p.vr) p.rot += p.vr * dt;
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    const off = Math.abs(p.x - cam.x) > vw * (p.kind === 'cloud' ? 2 : 1) || Math.abs(p.y - cam.y) > vh;
    if (p.t > p.life || (p.amb && off)) parts.splice(i, 1);
  }
}

// --- drawing --------------------------------------------------------------------------
const CH = 16;
function tileVariant(x, y, list) { const h = (x * 73856093 ^ y * 19349663) >>> 0; return list[h % list.length]; }
function drawTile(c, [s, sx, sy], dx, dy) { const img = IMG[s]; if (img) c.drawImage(img, sx * TS, sy * TS, TS, TS, dx, dy, T, T); }
const WATER_COL = { oasis: ['#46c4dc', '#2f9fc0'], temple: ['#3e9c86', '#2c7a68'], village: ['#24427a', '#1b3462'] };
function drawDecor(c, d, x0, y0) {                        // x0, y0 = pixel position of the decor's cell box
  const D = DECOR[d.name]; const img = IMG[D.s]; if (!img) return;
  if (D.parts) { for (const [sx, sy, dx, dy] of D.parts) c.drawImage(img, sx * TS, sy * TS, TS, TS, x0 + dx * T, y0 + dy * T, T, T); return; }
  const [rx, ry, rw, rh] = D.r;
  const w = rw * T, h = rh * T;
  if (D.s !== 'clouds') { c.fillStyle = 'rgba(0,0,0,0.16)'; c.beginPath(); c.ellipse(x0 + d.w * T / 2, y0 + d.h * T - 5, Math.min(w, d.w * T) * 0.42, 8, 0, 0, 7); c.fill(); }
  c.drawImage(img, Math.round(rx * TS), Math.round(ry * TS), Math.round(rw * TS), Math.round(rh * TS), x0 + (d.w * T - w) / 2, y0 + d.h * T - h, w, h);
}
function chunk(cx, cy) {
  const key = cx + ',' + cy;
  if (chunks.has(key)) return chunks.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = CH * T;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const open = (v) => v === C.PATH || v === C.PLAZA || v === C.CLEAR || v === C.BRIDGE || v === C.BAR;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const wx = cx * CH + x, wy = cy * CH + y, v = world.at(wx, wy), b = BIOMES[world.biomeOf(wx)], px = x * T, py = y * T;
    const wet = v === C.WATER || v === C.RIVER || v === C.BRIDGE;
    if (open(v) && v !== C.BRIDGE) drawTile(c, tileVariant(wx, wy, b.path), px, py);
    else if (b.bg === 'dungeon') {                        // dark rock; a brick wall face where the floor starts below
      if (v === C.RIVER || v === C.BRIDGE) { const gr = c.createLinearGradient(px, py, px + T, py); gr.addColorStop(0, '#07060c'); gr.addColorStop(0.5, '#141225'); gr.addColorStop(1, '#07060c'); c.fillStyle = gr; c.fillRect(px, py, T, T); }
      else if (open(world.at(wx, wy + 1))) drawTile(c, ['kd', ((wx * 7 + wy) % 9 === 0) ? 4 : 4, ((wx * 7 + wy) % 9 === 0) ? 2 : 3], px, py);
      else drawTile(c, ['kd', 0, 0], px, py);
    } else if (b.bg === 'sky') {                          // open sky; islands have a rocky underside
      const gr = c.createLinearGradient(0, py, 0, py + T); gr.addColorStop(0, '#8fd3ff'); gr.addColorStop(1, '#a6dcff'); c.fillStyle = gr; c.fillRect(px, py, T, T);
      if ((wx * 13 + wy * 7) % 23 === 0) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(px + 10, py + 20, 3, 3); }
      if (open(world.at(wx, wy - 1)) && world.at(wx, wy - 1) !== C.BRIDGE) {
        c.fillStyle = '#b48a5a'; c.fillRect(px, py, T, T * 0.42); c.fillStyle = '#8a6440'; c.fillRect(px, py + T * 0.3, T, T * 0.2);
        c.fillStyle = 'rgba(40,60,120,0.18)'; c.fillRect(px, py + T * 0.5, T, T * 0.35);
      }
    } else {
      drawTile(c, tileVariant(wx, wy, b.bg), px, py);
      if (wet) {
        const [c1, c2] = WATER_COL[b.id] || WATER_COL.oasis;
        c.fillStyle = v === C.WATER ? c1 : c2; c.fillRect(px, py, T, T);
        const isWet = (q) => q === C.WATER || q === C.RIVER || q === C.BRIDGE;
        c.fillStyle = 'rgba(20,40,60,0.28)';
        if (!isWet(world.at(wx - 1, wy))) c.fillRect(px, py, 5, T);
        if (!isWet(world.at(wx + 1, wy))) c.fillRect(px + T - 5, py, 5, T);
        if (!isWet(world.at(wx, wy - 1))) c.fillRect(px, py, T, 5);
      }
    }
    if (v === C.BRIDGE) {
      c.fillStyle = '#9a6a3c'; c.fillRect(px, py, T, T);
      c.fillStyle = '#7a4f2a'; for (let k = 0; k < 4; k++) c.fillRect(px + k * 12, py, 2, T);
      c.fillStyle = '#5a3a1e';
      if (world.at(wx, wy - 1) !== C.BRIDGE) c.fillRect(px, py, T, 6);
      if (world.at(wx, wy + 1) !== C.BRIDGE) c.fillRect(px, py + T - 6, T, 6);
    }
    if (open(v) && v !== C.BRIDGE) {                      // soft edge where the floor meets the land
      c.fillStyle = 'rgba(0,0,0,0.16)';
      if (!open(world.at(wx, wy - 1))) c.fillRect(px, py, T, 6);
      if (!open(world.at(wx - 1, wy))) c.fillRect(px, py, 4, T);
      if (!open(world.at(wx + 1, wy))) c.fillRect(px + T - 4, py, 4, T);
    }
  }
  for (const d of world.decor) {
    if (d.x + d.w < cx * CH - 1 || d.x > (cx + 1) * CH || d.y + d.h < cy * CH - 3 || d.y > (cy + 1) * CH) continue;
    drawDecor(c, d, (d.x - cx * CH) * T, (d.y - cy * CH) * T);
  }
  chunks.set(key, cv);
  return cv;
}

function render() {
  const vw = canvas.width, vh = canvas.height;
  const ox = Math.round(cam.x - vw / 2), oy = Math.round(cam.y - vh / 2);
  const b = BIOMES[landShown] || BIOMES[0];
  g.fillStyle = b.ground; g.fillRect(0, 0, vw, vh);
  const c0x = Math.floor(ox / (CH * T)), c1x = Math.floor((ox + vw) / (CH * T)), c0y = Math.floor(oy / (CH * T)), c1y = Math.floor((oy + vh) / (CH * T));
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    if (cx < 0 || cy < 0 || cx * CH >= world.W || cy * CH >= H) continue;
    g.drawImage(chunk(cx, cy), cx * CH * T - ox, cy * CH * T - oy);
  }
  const inView = (x, y, m = T) => x > -m && y > -m && x < vw + m && y < vh + m;
  // water shimmer
  for (let ty = Math.floor(oy / T); ty <= (oy + vh) / T; ty++) for (let tx = Math.floor(ox / T); tx <= (ox + vw) / T; tx++) {
    const v = world.at(tx, ty);
    if (v !== C.WATER && v !== C.RIVER) continue;
    const bb = BIOMES[world.biomeOf(tx)]; if (bb.bg === 'dungeon' || bb.bg === 'sky') continue;
    const s = Math.sin(clock * 2 + tx * 1.7 + ty * 2.3);
    if (s > 0.55) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(tx * T - ox + 10 + s * 8, ty * T - oy + 18, 12, 3); }
  }
  // the barriers: a shimmering wall of light between two stone posts
  for (const gt of world.gates) {
    if (world.at(gt.bars[0].x, gt.bars[0].y) !== C.BAR) continue;
    const x = gt.bars[0].x * T - ox, y0 = gt.bars[0].y * T - oy, hgt = gt.bars.length * T;
    if (!inView(x, y0, T * 3)) continue;
    const hue = BIOMES[world.biomeOf(gt.bars[0].x)].barrier;
    const gr = g.createLinearGradient(x, 0, x + T, 0);
    gr.addColorStop(0, `hsla(${hue},90%,60%,0)`); gr.addColorStop(0.5, `hsla(${hue},95%,70%,${0.55 + 0.15 * Math.sin(clock * 5)})`); gr.addColorStop(1, `hsla(${hue},90%,60%,0)`);
    g.fillStyle = gr; g.fillRect(x, y0, T, hgt);
    g.strokeStyle = `hsla(${hue},100%,88%,0.8)`; g.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const yy = y0 + ((clock * 60 + k * hgt / 4) % hgt); g.beginPath(); g.moveTo(x + 8, yy); g.lineTo(x + T - 8, yy - 6); g.stroke(); }
    for (const py of [y0 - T * 0.9, y0 + hgt - T * 0.1]) {
      g.fillStyle = '#6b6f86'; g.fillRect(x + 8, py, T - 16, T); g.fillStyle = '#8f94ad'; g.fillRect(x + 8, py, T - 16, 8);
      g.fillStyle = `hsl(${hue},95%,${65 + 10 * Math.sin(clock * 4)}%)`; g.beginPath(); g.arc(x + T / 2, py - 2, 9, 0, 7); g.fill();
    }
  }
  // lamp posts and wall torches
  for (const lp of world.lamps) {
    const x = (lp.x + 0.5) * T - ox, y = (lp.y + 1) * T - oy;
    if (!inView(x, y, T * 2)) continue;
    if (lp.kind === 'lamp') {
      g.fillStyle = '#2b2b38'; g.fillRect(x - 3, y - T * 1.3, 6, T * 1.3);
      g.fillStyle = '#ffd36b'; g.fillRect(x - 9, y - T * 1.6, 18, 16); g.strokeStyle = '#2b2b38'; g.lineWidth = 3; g.strokeRect(x - 9, y - T * 1.6, 18, 16);
    } else {
      g.fillStyle = '#5a3a1e'; g.fillRect(x - 3, y - T * 0.65, 6, 16);
      const f = 1 + 0.15 * Math.sin(clock * 17 + lp.x);
      g.fillStyle = '#ff9a2e'; g.beginPath(); g.ellipse(x, y - T * 0.75, 7 * f, 11 * f, 0, 0, 7); g.fill();
      g.fillStyle = '#fff1a8'; g.beginPath(); g.ellipse(x, y - T * 0.72, 3, 6, 0, 0, 7); g.fill();
    }
  }
  // crystals at the end of side spurs
  for (const gm of world.gems) {
    if (gm.taken) continue;
    const bx = (gm.x + 0.5) * T - ox, by = (gm.y + 0.5) * T - oy;
    if (!inView(bx, by)) continue;
    g.save(); g.translate(bx, by + Math.sin(clock * 2.4 + gm.ph) * 4); g.scale(1.55, 1.55); drawGem(0, 0, GEMS[gm.c], gm.ph, 14); g.restore();
  }
  // treasure chest (Kenney Tiny Dungeon)
  { const x = (world.chest.x + 0.5) * T - ox, y = (world.chest.y + 0.5) * T - oy;
    if (qi >= qs.length) { const gr = g.createRadialGradient(x, y, 4, x, y, 70); gr.addColorStop(0, `rgba(255,230,120,${0.55 + 0.2 * Math.sin(clock * 4)})`); gr.addColorStop(1, 'rgba(255,230,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 70, 0, 7); g.fill(); }
    if (IMG.kd) g.drawImage(IMG.kd, (finishT >= 0 ? 6 : 5) * TS, 7 * TS, TS, TS, x - T, y - T, T * 2, T * 2); }
  // magnet
  for (const it of world.items) {
    if (it.taken) continue;
    const x = (it.x + 0.5) * T - ox, y = (it.y + 0.5) * T - oy + Math.sin(clock * 3 + it.x) * 4;
    if (!inView(x, y)) continue;
    const gr = g.createRadialGradient(x, y, 2, x, y, 34); gr.addColorStop(0, 'rgba(170,230,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); drawMagnet(x, y, 1);
  }
  if (magnetLeft > 0) for (const gm of world.gems) if (!gm.taken && gm.pulled) {
    g.strokeStyle = `hsla(${GEMS[gm.c].h},90%,75%,0.45)`; g.lineWidth = 2; g.setLineDash([6, 8]); g.lineDashOffset = -clock * 40;
    g.beginPath(); g.moveTo((gm.x + 0.5) * T - ox, (gm.y + 0.5) * T - oy); g.lineTo(hero.x - ox, hero.y - oy); g.stroke(); g.setLineDash([]);
  }
  // sprites sorted by y
  const sprites = [];
  for (const m of mons) if (m.gone <= 0) sprites.push({ y: m.y, draw: () => drawSheet(IMG['m_' + m.kind], m.x - ox, m.y - oy, m.dir, Math.floor(m.anim || 0) % 4, 1.15) });
  for (const n of npcs) sprites.push({ y: n.y, draw: () => drawChar(IMG['p_' + n.who], n.x - ox, n.y - oy, 0, 0, n) });
  for (const a of animals) sprites.push({ y: a.y, draw: () => drawAnimal(a, a.x - ox, a.y - oy) });
  for (const list of crit) for (const cr of list) if (cr.state !== 'gone' && inView(cr.x - ox, cr.y - oy, T * 3)) sprites.push({ y: cr.y, draw: () => drawCreature(cr, cr.x - ox, cr.y - oy) });
  if (invuln <= 0 || Math.floor(clock * 10) % 2) sprites.push({ y: hero.y, draw: () => drawChar(IMG['h_' + heroKey], hero.x - ox, hero.y - oy, hero.dir, hero.throwT > 0 ? 4 : hero.moving ? Math.floor(hero.frame) % 4 : 0) });
  sprites.sort((a, c) => a.y - c.y).forEach(s => s.draw());
  // poofs (smoke sprite), shurikens
  for (const p of poofs) if (IMG.smoke) { const f = Math.min(5, Math.floor(p.t / 0.1)); g.drawImage(IMG.smoke, f * 32, 0, 32, 32, p.x - ox - 48, p.y - oy - 48, 96, 96); }
  for (const s of stars) if (IMG.shuriken) {
    g.save(); g.translate(s.x - ox, s.y - oy); g.rotate(s.rot); g.drawImage(IMG.shuriken, 0, 0, 16, 16, -16, -16, 32, 32); g.restore();
  }
  // particles
  for (const p of parts) {
    const x = p.x - ox, y = p.y - oy;
    if (p.kind === 'dot') { g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.color; g.fillRect(x - 3, y - 3, 6, 6); }
    else if (p.kind === 'kp' || p.kind === 'ring') {
      const img = tinted(p.key, p.color); if (!img) continue;
      const k = p.t / p.life, sz = p.kind === 'ring' ? p.size + k * 220 : p.size * (1 - k * 0.5);
      g.globalAlpha = Math.max(0, (p.alpha || 1) * (1 - k)); if (p.add) g.globalCompositeOperation = 'lighter';
      g.save(); g.translate(x, y); if (p.rot) g.rotate(p.rot); g.drawImage(img, -sz / 2, -sz / 2, sz, sz); g.restore();
      g.globalCompositeOperation = 'source-over';
    } else if (p.kind === 'leaf' && IMG.leaf) { g.globalAlpha = 0.95; g.drawImage(IMG.leaf, (Math.floor(p.t * 8) % 6) * 12, 0, 12, 7, x, y, 24, 14); }
    else if (p.kind === 'firefly') { const a = 0.5 + 0.5 * Math.sin(p.t * 4 + p.ph); g.globalAlpha = a; const gr = g.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, 'rgba(255,255,170,0.95)'); gr.addColorStop(1, 'rgba(255,255,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
    else if (p.kind === 'mote') { g.globalAlpha = 0.45 + 0.35 * Math.sin(p.t * 3 + p.ph); g.fillStyle = p.c; g.fillRect(x, y, 3, 3); }
    g.globalAlpha = 1;
  }
  g.strokeStyle = 'rgba(30,30,45,0.85)'; g.lineWidth = 2.5;
  for (const o of birds) {
    const x = o.x - ox, y = o.y - oy, f = Math.sin(o.life * 9 + o.ph) * 6;
    if (x < -20 || x > vw + 20) continue;
    g.beginPath(); g.moveTo(x - 9, y - f); g.quadraticCurveTo(x - 4, y - 3, x, y); g.quadraticCurveTo(x + 4, y - 3, x + 9, y - f); g.stroke();
  }
  // clouds drifting over the sky islands
  for (const p of parts) if (p.kind === 'cloud') { const img = tinted('k_smoke_04', '#ffffff'); if (img) { g.globalAlpha = 0.35; g.drawImage(img, p.x - ox - p.size / 2, p.y - oy - p.size / 3, p.size, p.size * 0.66); g.globalAlpha = 1; } }
  if (b.tint) { g.fillStyle = b.tint; g.fillRect(0, 0, vw, vh); }
  // darkness (dungeon, village at night): light around the ninja, lamps, creatures and storytellers
  if (darkNow > 0.02) {
    sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, vw, vh);
    sg.fillStyle = `rgba(6,6,22,${darkNow})`; sg.fillRect(0, 0, vw, vh);
    sg.globalCompositeOperation = 'destination-out';
    const light = (x, y, r) => { if (!inView(x, y, r)) return; const gr = sg.createRadialGradient(x, y, r * 0.25, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.beginPath(); sg.arc(x, y, r, 0, 7); sg.fill(); };
    light(hero.x - ox, hero.y - oy, T * 5.5);
    for (const lp of world.lamps) light((lp.x + 0.5) * T - ox, (lp.y + 0.3) * T - oy, T * (3 + 0.15 * Math.sin(clock * 9 + lp.x)));
    for (const d of litDecor) light((d.x + 1.5) * T - ox, (d.y + 2.3) * T - oy, T * 2.6);
    for (const list of crit) for (const cr of list) if (cr.state !== 'gone') light(cr.x - ox, cr.y - T * 0.8 - oy, T * 2.8);
    for (const n of npcs) light(n.x - ox, n.y - oy, T * 2.2);
    for (const gm of world.gems) if (!gm.taken) light((gm.x + 0.5) * T - ox, (gm.y + 0.5) * T - oy, T * 1.4);
    for (const gt of world.gates) light((gt.bars[1].x + 0.5) * T - ox, (gt.bars[1].y + 0.5) * T - oy, T * 2.5);
    for (const s of stars) light(s.x - ox, s.y - oy, T * 1.2);
    light((world.chest.x + 0.5) * T - ox, (world.chest.y + 0.5) * T - oy, T * 3);
    g.drawImage(shade, 0, 0);
    // warm glow of lamps and windows on top
    g.globalCompositeOperation = 'lighter';
    for (const lp of world.lamps) { const x = (lp.x + 0.5) * T - ox, y = (lp.y + 0.4) * T - oy; if (!inView(x, y, T * 3)) continue; const gr = g.createRadialGradient(x, y, 2, x, y, T * 1.8); gr.addColorStop(0, `rgba(255,170,60,${0.35 * darkNow})`); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, T * 1.8, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  }
  // the right picture flying up to the question box
  for (const f of flyCards) {
    const k = Math.min(1, f.t / 0.9), e = 1 - (1 - k) * (1 - k), x = f.x + (90 - f.x) * e, y = f.y + (40 - f.y) * e - Math.sin(k * Math.PI) * 80, s = T * 1.5 * (1 - 0.6 * e);
    g.globalAlpha = 1 - Math.max(0, (f.t - 0.8) / 0.3); drawCard(x, y, s, f.val, true, '#ffe36b'); g.globalAlpha = 1;
  }
  const vg = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = vg; g.fillRect(0, 0, vw, vh);
  if (magnetLeft > 0) {
    const bw = Math.min(260, vw * 0.4), bx = vw / 2 - bw / 2, by = vh - 46, blink = magnetLeft < 3 && Math.floor(clock * 6) % 2;
    g.fillStyle = 'rgba(10,20,40,0.55)'; g.beginPath(); g.roundRect(bx - 50, by - 8, bw + 62, 36, 18); g.fill();
    g.fillStyle = blink ? '#ffffff' : '#ff6b6b'; g.beginPath(); g.roundRect(bx, by + 2, bw * magnetLeft / MAGNET_S, 16, 8); g.fill();
    drawMagnet(bx - 28, by + 10, 0.6);
  }
  if (treasure && treasure.t >= 0) drawTreasure(vw, vh, (world.chest.x + 0.5) * T - ox, (world.chest.y + 0.5) * T - oy);
  if (finishT >= 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.8, Math.max(0, finishT - 5.6) / 1.4)})`; g.fillRect(0, 0, vw, vh); }
}

// The crystal out of the chest: the world dims, a beam shoots up, the crystal rises
// with a little bounce, shines and turns its rays; its colour word appears above it.
function drawTreasure(vw, vh, x, y) {
  const t = treasure.t, cr = treasure.cr;
  const dim = Math.min(1, Math.max(0, (t - 0.3) / 0.8));
  if (dim > 0) { const gr = g.createRadialGradient(x, y - T * 2.5, T * 2.5, x, y - T * 2.5, Math.max(vw, vh) * 0.6); gr.addColorStop(0, 'rgba(8,6,30,0)'); gr.addColorStop(1, `rgba(8,6,30,${0.6 * dim})`); g.fillStyle = gr; g.fillRect(0, 0, vw, vh); }
  if (t < 2.2) {                                                         // the beam of light
    const a = Math.min(1, t / 0.25) * Math.max(0, 1 - Math.max(0, t - 1.1) / 1.1), bw = T * (0.6 + Math.min(1, t * 2) * 0.9);
    const gr = g.createLinearGradient(x - bw, 0, x + bw, 0);
    gr.addColorStop(0, 'rgba(255,250,220,0)'); gr.addColorStop(0.5, `rgba(255,250,220,${0.85 * a})`); gr.addColorStop(1, 'rgba(255,250,220,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - bw, 0, bw * 2, y - T * 0.3); g.globalCompositeOperation = 'source-over';
  }
  const k = Math.min(1, Math.max(0, (t - 0.35) / 0.9));
  if (k <= 0) return;
  const c1 = 1.70158, e = 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);   // ease out with a little overshoot
  const size = T * 3.3 * Math.max(0.05, e), base = y - T * 0.3 - T * 1.3 * e + Math.sin(t * 2.2) * 5 * k;
  drawCrystal(g, cr, x, base, size, t, Math.min(1, k * 1.3));
  if (t > 1.5) {                                                         // the colour word
    const p = Math.min(1, (t - 1.5) / 0.35), sc = 1 + 0.25 * Math.sin(p * Math.PI);
    g.save(); g.translate(x, base - size * 1.25); g.scale(sc, sc); g.globalAlpha = p;
    g.font = `900 ${Math.round(T * 0.95)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = '#1a1030'; g.strokeText(cr.w, 0, 0);
    g.fillStyle = cr.w === 'white' ? '#ffffff' : crystalColour(cr); g.fillText(cr.w, 0, 0);
    g.restore();
  }
}

// a picture card: rounded, framed, the word's picture (or a question mark before the question)
function drawCard(x, y, s, val, show, frame) {
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(x - s / 2 + 3, y - s / 2 + 5, s, s, 12); g.fill();
  g.fillStyle = '#fffdf5'; g.strokeStyle = frame; g.lineWidth = 5; g.beginPath(); g.roundRect(x - s / 2, y - s / 2, s, s, 12); g.fill(); g.stroke();
  const pc = pics.get(val);
  if (show && pc) g.drawImage(pc, x - s / 2 + 6, y - s / 2 + 6, s - 12, s - 12);
  else { g.fillStyle = '#b7b0d0'; g.font = `900 ${Math.round(s * 0.55)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x, y + 2); }
}
function drawCreature(cr, x, y) {
  const active = cr.gate === qi && activeGate === qi, shown = active || cr.gate < qi, hue = BIOMES[world.biomeOf(Math.floor(cr.home.x))].barrier;
  g.save(); g.globalAlpha = cr.alpha;
  let sx = 0; if (cr.state === 'giggle') sx = Math.sin(cr.t * 40) * 5;
  const yy = y - cr.fy, cardY = yy - CARD_DY + Math.sin(clock * 2 + cr.ph) * 3, cs = T * 1.45;
  // shadow, string, the card, the creature under it
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, y + T * 0.45, T * 0.35, T * 0.12, 0, 0, 7); g.fill();
  const hint = cr.correct && active && qMistakes >= 2 && cr.state === 'idle';
  if (hint) { const gr = g.createRadialGradient(x + sx, cardY, cs * 0.3, x + sx, cardY, cs); gr.addColorStop(0, `rgba(255,220,80,${0.55 + 0.3 * Math.sin(clock * 6)})`); gr.addColorStop(1, 'rgba(255,220,80,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x + sx, cardY, cs, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(40,30,30,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + sx, cardY + cs / 2); g.lineTo(x, yy - T * 0.2); g.stroke();
  drawSheet(IMG['m_' + cr.kind], x + sx, yy + Math.sin(clock * 3 + cr.ph) * 3, cr.dir, Math.floor(clock * 6 + cr.ph) % 4, 1.4, true);
  drawCard(x + sx, cardY, cs, cr.val, shown, hint ? '#ffd23f' : `hsl(${hue},70%,45%)`);
  if (cr.state === 'giggle') { g.font = '44px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('😜', x + T * 0.95, yy - CARD_DY - T * 0.6); }
  g.restore();
}
function drawSheet(img, x, y, dir, frame, k = 1.15, noShadow = false) {
  if (!img) return;
  const s = SC * k, w = 16 * s, h = 16 * s;
  if (!noShadow) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + h * 0.42, w * 0.32, h * 0.12, 0, 0, 7); g.fill(); }
  g.drawImage(img, dir * 16, frame * 16, 16, 16, x - w / 2, y - h * 0.6, w, h);
}
function drawMagnet(x, y, k) {
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(Math.sin(clock * 2) * 0.15);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
  for (let i = 1; i <= 2; i++) { g.beginPath(); g.arc(0, 8, 14 + i * 7 + Math.sin(clock * 4) * 2, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  g.lineCap = 'butt'; g.strokeStyle = '#e8343c'; g.lineWidth = 9; g.beginPath(); g.arc(0, -2, 11, Math.PI, 0); g.lineTo(11, 12); g.moveTo(-11, -2); g.lineTo(-11, 12); g.stroke();
  g.strokeStyle = '#d9dde6'; g.beginPath(); g.moveTo(-11, 9); g.lineTo(-11, 17); g.moveTo(11, 9); g.lineTo(11, 17); g.stroke();
  g.restore();
}
function drawGem(x, y, c, ph, groundY) {
  const H0 = c.h, L = c.l, t = clock;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, groundY, 13, 4, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(x, y, 2, x, y, 30);
  gr.addColorStop(0, `hsla(${H0},100%,75%,${0.45 + 0.15 * Math.sin(t * 3 + ph)})`); gr.addColorStop(1, `hsla(${H0},100%,70%,0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill();
  const w = 15, top = y - 12, gird = y - 4, tip = y + 15, tw = 7;
  const facet = (pts, light) => { g.fillStyle = `hsla(${H0},85%,${light}%,0.92)`; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const sh = Math.sin(t * 1.6 + ph) * 8;
  facet([x - tw, top, x + tw, top, x + w, gird, x - w, gird], L + 18 + sh);
  facet([x - w, gird, x - 5, gird, x, tip], L - 6 + sh);
  facet([x - 5, gird, x + 5, gird, x, tip], L + 6 - sh);
  facet([x + 5, gird, x + w, gird, x, tip], L - 16 - sh);
  g.strokeStyle = `hsla(${H0},60%,22%,0.85)`; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x - tw, top); g.lineTo(x + tw, top); g.lineTo(x + w, gird); g.lineTo(x, tip); g.lineTo(x - w, gird); g.closePath(); g.stroke();
}
const NAMES = { Sultan: 'Sultan', Sultan2: 'Merchant', Woman: 'Traveller', Shaman: 'Shaman', Monk2: 'Monk', Cavegirl: 'Jungle Girl', Knight: 'Knight',
  KnightGold: 'Golden Knight', Princess: 'Princess', Villager5: 'Farmer', OldMan3: 'Grandpa', OldWoman: 'Grandma', Master: 'Sky Master', SamuraiBlue: 'Samurai', EggGirl: 'Egg Girl' };
const nameOf = (w) => NAMES[w] || w;
function drawChar(img, x, y, dir, frame, npc) {
  if (!img) return;
  const s = SC * 1.15, w = 16 * s, h = 16 * s;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + h * 0.42, w * 0.32, h * 0.12, 0, 0, 7); g.fill();
  if (frame * 16 >= img.height) frame = 0;
  g.drawImage(img, dir * 16, frame * 16, 16, 16, x - w / 2, y - h * 0.6, w, h);
  if (npc) {
    const by = y - h * 0.8 + Math.sin(clock * 3 + npc.bob) * 3;
    g.globalAlpha = npc.spoken ? 0.45 : 1;
    g.fillStyle = '#fff'; g.strokeStyle = '#2a1f4a'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(x - 20, by - 26, 40, 24, 8); g.fill(); g.stroke();
    g.fillStyle = '#2a1f4a'; for (const k of [-10, 0, 10]) { g.beginPath(); g.arc(x + k, by - 14, 3, 0, 7); g.fill(); }
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
window.__ln = {
  get: () => ({ running, qi, activeGate, hero: hero && { x: hero.x / T, y: hero.y / T, tx: hero.tx, ty: hero.ty }, land: landShown,
    crit: crit[qi] ? crit[qi].map(c => ({ x: c.x / T, y: c.y / T, val: c.val, correct: c.correct, state: c.state })) : [],
    q: qs && qs[qi] ? qs[qi].id : null, gate: world && world.gates[qi] ? world.gates[qi].plaza : null, chest: world && world.chest, finishT,
    vf: voiceFree(), ql: queue.length, timer: !!qTimer, until: Math.round(speakingUntil - performance.now()), done: !!finish.done, mistakes, chased, stars: stars.length }),
  tp: (x, y) => { hero.tx = hero.fx = x; hero.ty = hero.fy = y; hero.moveT = 1; hero.x = (x + 0.5) * T; hero.y = (y + 0.5) * T; },
  aim: (x, y) => { const dx = x * T - hero.x, dy = y * T - hero.y, k = Math.hypot(dx, dy); hero.aim = { x: dx / k, y: dy / k }; throwStar(); },
  map: () => ({ rivers: world.rivers, gems: world.gems.map(o => [o.x, o.y]), npcs: world.npcs, gates: world.gates.map(o => o.plaza), W: world.W, start: world.start, biomeX: world.biomeX }),
  mons: () => mons.map(m => ({ x: m.x / T, y: m.y / T, gone: m.gone, a: m.a, b: m.b })),
  walk: (x, y) => walkable(x, y),
};
