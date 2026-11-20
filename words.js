// English words: the vocabulary (vocab.json from tools/build_vocab.py), the
// choice of the round's words and wrong options, and the pictures painted on
// the gates (Twemoji, colours, shapes, digits, colour+shape, counted things).

let V = null;
export async function loadVocab() {
  if (!V) V = await (await fetch(new URL('./vocab.json?v=' + Date.now().toString(36).slice(0, -5), import.meta.url).href)).json();
  return V;
}
export const cats = () => V.cats;
export const catById = (id) => V.cats.find(c => c.id === id);
export const item = (id) => V.items[id];
// the "everything" round mixes the picture categories (colours and shapes have their own rounds)
export const MIX_CATS = ['farm', 'food', 'things', 'wild', 'nature', 'body'];

// --- what the child knows: right-first-time answers per word ---
const STATS_KEY = 'slowkowy_words_v1';
let stats = {};
try { stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); } catch (_) { stats = {}; }
export function recordWord(id, right) {
  const s = stats[id] || (stats[id] = { ok: 0, bad: 0 });
  if (right) s.ok++; else s.bad++;
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
}
export const knownCount = (catId) => (catId === 'mix' ? MIX_CATS.flatMap(c => catById(c).items) : catById(catId).items).filter(id => stats[id] && stats[id].ok > stats[id].bad).length;

const shuffle = (a, rnd = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The round's target words: new and shaky words first, never the same word twice.
export function pickRound(catId, count) {
  const pool = catId === 'mix' ? MIX_CATS.flatMap(c => catById(c).items) : catById(catId).items.slice();
  const score = (id) => { const s = stats[id]; return !s ? 0 : s.bad > s.ok ? -1 : s.ok; };   // shaky < new < known
  const out = shuffle(pool.slice()).sort((a, b) => score(a) - score(b) + (Math.random() - 0.5) * 1.5);
  return out.slice(0, Math.min(count, pool.length));
}

// Wrong options: from the same category; colour+shape and counting ones differ in
// one part only (same colour or same shape, same thing or same number), so the
// child has to listen to the whole phrase.
export function distractors(id, n) {
  const it = V.items[id], pool = catById(it.cat).items.filter(x => x !== id);
  let out = [];
  if (it.parts) {
    const near = shuffle(pool.filter(x => { const p = V.items[x].parts; return p[0] === it.parts[0] || p[1] === it.parts[1]; }));
    out = near.slice(0, n);
  }
  for (const x of shuffle(pool.slice())) { if (out.length >= n) break; if (!out.includes(x)) out.push(x); }
  return out.slice(0, n);
}

export const clipQ = (id, variant = 1) => `w_${id}_q${variant}`;
// the round's clips: the question (its variant), answer and Polish word of every target, and "that's ..." of every option
export const roundClips = (qs) => [...qs.flatMap(q => [clipQ(q.id, q.variant), `w_${q.id}_a`, `w_${q.id}_pl`]), ...new Set(qs.flatMap(q => q.options).map(id => `w_${id}_t`))];
export const COMMON_CLIPS = ['e_yes1', 'e_yes2', 'e_yes3', 'e_yes4', 'e_yes5', 'e_oops', 'e_win'];

// --- pictures ---
const imgs = new Map();
function loadImg(cp) {
  if (!imgs.has(cp)) imgs.set(cp, new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = new URL(`./img/${cp}.svg`, import.meta.url).href;
  }));
  return imgs.get(cp);
}
export async function preloadPictures(ids) {
  await Promise.all(ids.map(id => V.items[id].img.emoji).filter(Boolean).map(loadImg));
}

function shapePath(g, shape, cx, cy, r) {
  g.beginPath();
  const poly = (k, rot = -Math.PI / 2, rx = r, ry = r) => { for (let i = 0; i < k; i++) { const a = rot + i / k * Math.PI * 2; g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } g.closePath(); };
  switch (shape) {
    case 'circle': g.arc(cx, cy, r, 0, Math.PI * 2); break;
    case 'square': g.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7); break;
    case 'triangle': poly(3, -Math.PI / 2, r * 1.1, r * 1.1); g.translate(0, 0); break;
    case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2, rr = i % 2 ? r * 0.45 : r * 1.05; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); break;
    case 'heart': {
      const s = r / 16;
      g.moveTo(cx, cy + 15 * s);
      g.bezierCurveTo(cx - 26 * s, cy - 2 * s, cx - 14 * s, cy - 22 * s, cx, cy - 9 * s);
      g.bezierCurveTo(cx + 14 * s, cy - 22 * s, cx + 26 * s, cy - 2 * s, cx, cy + 15 * s);
      g.closePath(); break;
    }
    case 'rectangle': g.rect(cx - r * 1.15, cy - r * 0.6, r * 2.3, r * 1.2); break;
    case 'oval': g.ellipse(cx, cy, r * 1.15, r * 0.7, 0, 0, Math.PI * 2); break;
    case 'diamond': poly(4, -Math.PI / 2, r * 0.75, r * 1.1); break;
    case 'hexagon': poly(6, 0); break;
    case 'arrow': {
      const w = r * 1.15, t = r * 0.38;
      g.moveTo(cx - w, cy - t); g.lineTo(cx + w * 0.2, cy - t); g.lineTo(cx + w * 0.2, cy - r * 0.8); g.lineTo(cx + w, cy);
      g.lineTo(cx + w * 0.2, cy + r * 0.8); g.lineTo(cx + w * 0.2, cy + t); g.lineTo(cx - w, cy + t); g.closePath(); break;
    }
  }
}
function fillShape(g, shape, cx, cy, r, color) {
  g.save(); shapePath(g, shape, cx, cy, r);
  g.fillStyle = color; g.fill();
  g.lineWidth = Math.max(3, r * 0.09); g.strokeStyle = 'rgba(10,26,60,0.85)'; g.stroke(); g.restore();
}
function blob(g, cx, cy, r, color) {                 // a splash of paint
  g.save(); g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2, rr = r * (1 + 0.09 * Math.sin(a * 5) + 0.05 * Math.sin(a * 9 + 1));
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = color; g.fill();
  g.lineWidth = 6; g.strokeStyle = 'rgba(10,26,60,0.8)'; g.stroke();
  g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill(); g.restore();
}

// A 256×256 card with the item's picture (no words: the child must listen).
export async function pictureCanvas(id, size = 256) {
  const it = V.items[id], im = it.img;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), s = size / 256;
  g.fillStyle = '#f4f9ff'; g.beginPath(); g.roundRect(6 * s, 6 * s, 244 * s, 244 * s, 34 * s); g.fill();
  g.lineWidth = 8 * s; g.strokeStyle = '#ffd23f'; g.stroke();
  if (im.count) {
    const n = im.count, cols = n <= 2 ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
    const cell = Math.min(200 / cols, 200 / rows) * s, pic = cell * 0.86;
    const img = im.emoji ? await loadImg(im.emoji) : null;
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / cols), inRow = Math.min(cols, n - row * cols), col = k % cols;
      const cx = size / 2 + (col - (inRow - 1) / 2) * cell, cy = size / 2 + (row - (rows - 1) / 2) * cell;
      if (img) g.drawImage(img, cx - pic / 2, cy - pic / 2, pic, pic);
      else fillShape(g, im.shape, cx, cy, pic * 0.45, im.color);
    }
  } else if (im.emoji) {
    const img = await loadImg(im.emoji);
    if (img) g.drawImage(img, 36 * s, 36 * s, 184 * s, 184 * s);
  } else if (im.shape) {
    fillShape(g, im.shape, size / 2, size / 2, 78 * s, im.color || '#20b2aa');
  } else if (im.color) {
    blob(g, size / 2, size / 2, 84 * s, im.color);
  } else if (im.digit) {
    const t = String(im.digit);
    g.font = `900 ${(t.length > 1 ? 150 : 190) * s}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14 * s; g.strokeStyle = '#0a1a3c'; g.strokeText(t, size / 2, size / 2 + 10 * s);
    g.fillStyle = '#ff5a36'; g.fillText(t, size / 2, size / 2 + 10 * s);
  }
  return c;
}
