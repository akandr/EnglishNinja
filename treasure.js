// The treasure in the chest: a crystal grown anew for every game (its shards, colour
// and shine are random). It rises out of the chest in a beam of light, its colour is
// said in English, and it joins a little collection shown on the win screen.

const COLOURS = [
  { w: 'red', h: 352, s: 88, l: 50 }, { w: 'orange', h: 24, s: 95, l: 54 }, { w: 'yellow', h: 48, s: 95, l: 55 },
  { w: 'green', h: 138, s: 70, l: 44 }, { w: 'blue', h: 210, s: 85, l: 52 }, { w: 'purple', h: 274, s: 70, l: 56 },
  { w: 'pink', h: 326, s: 85, l: 64 }, { w: 'white', h: 205, s: 30, l: 84 },
];
const rnd = (a, b) => a + Math.random() * (b - a);
const r2 = (v) => Math.round(v * 100) / 100;

export function makeCrystal() {
  const c = COLOURS[Math.floor(Math.random() * COLOURS.length)];
  const shards = [{ a: rnd(-0.1, 0.1), len: 1, w: rnd(0.19, 0.25), x: 0, dh: 0 }];
  const n = 2 + Math.floor(rnd(0, 5));
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    shards.push({ a: side * (rnd(0.2, 0.45) + k * 0.24), len: rnd(0.45, 0.8) * (1 - k * 0.13), w: rnd(0.12, 0.19), x: side * rnd(0.04, 0.2), dh: rnd(-16, 16) });
  }
  for (let i = 0, m = 2 + Math.floor(rnd(0, 3)); i < m; i++) {          // tiny ones at the foot
    const side = Math.random() < 0.5 ? -1 : 1;
    shards.push({ a: side * rnd(0.75, 1.2), len: rnd(0.17, 0.3), w: rnd(0.07, 0.11), x: side * rnd(0.16, 0.32), dh: rnd(-20, 20) });
  }
  shards.sort((p, q) => q.len - p.len);                                  // the big ones behind
  const rock = Array.from({ length: 9 }, () => r2(rnd(0.8, 1.2)));
  return { w: c.w, h: c.h, s: c.s, l: c.l, rock, rays: 10 + Math.floor(rnd(0, 8)), spin: r2(rnd(0.15, 0.35) * (Math.random() < 0.5 ? -1 : 1)), ph: r2(rnd(0, 6.28)),
    shards: shards.map(o => ({ a: r2(o.a), len: r2(o.len), w: r2(o.w), x: r2(o.x), dh: Math.round(o.dh) })) };
}
export const crystalColour = (cr) => `hsl(${cr.h},${Math.max(cr.s, 60)}%,${Math.min(cr.l + 8, 70)}%)`;

function star(g, x, y, r, color) {
  if (r <= 0.5) return;
  g.fillStyle = color; g.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.2 : r; g.lineTo(x + Math.sin(a) * rr, y - Math.cos(a) * rr); }
  g.closePath(); g.fill();
}

function drawShard(g, cr, sh, x, y, S, t, i) {
  const L = sh.len * S, W = sh.w * S, b = L * 0.74, m = W * 0.36, foot = W * 0.12, white = cr.w === 'white';
  const h = cr.h + sh.dh, col = (dl) => `hsl(${h},${cr.s}%,${Math.max(5, Math.min(97, cr.l + dl))}%)`;
  g.save(); g.translate(x + sh.x * S, y); g.rotate(sh.a);
  const face = (p, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]); g.closePath(); g.fill(); };
  face([-W, 0, -m, foot, -m, -b, -W, -b], col(8));
  face([-m, foot, m, foot, m, -b, -m, -b], col(20));
  face([m, foot, W, 0, W, -b, m, -b], col(-14));
  face([-W, -b, -m, -b, 0, -L], col(26));
  face([-m, -b, m, -b, 0, -L], col(36));
  face([m, -b, W, -b, 0, -L], col(2));
  const path = () => { g.beginPath(); g.moveTo(-W, 0); g.lineTo(-m, foot); g.lineTo(m, foot); g.lineTo(W, 0); g.lineTo(W, -b); g.lineTo(0, -L); g.lineTo(-W, -b); g.closePath(); };
  const deep = g.createLinearGradient(0, foot, 0, -b);                   // darker at the foot, like depth inside
  deep.addColorStop(0, 'rgba(0,0,30,0.38)'); deep.addColorStop(0.6, 'rgba(0,0,30,0)');
  path(); g.fillStyle = deep; g.fill();
  // a bright band sweeping up the shard now and then
  g.save(); path(); g.clip();
  const k = ((t * 0.5 + i * 0.17 + cr.ph) % 2.4) / 2.4 * 1.8 - 0.4, yy = foot - k * (L + W);
  const bc = white ? `hsla(${(t * 90 + i * 60) % 360},100%,85%,` : 'rgba(255,255,255,';
  const band = g.createLinearGradient(-W, yy + W * 0.7, W, yy - W * 0.7);
  band.addColorStop(0, bc + '0)'); band.addColorStop(0.5, bc + '0.8)'); band.addColorStop(1, bc + '0)');
  g.fillStyle = band; g.fillRect(-W, yy - W * 1.4, W * 2, W * 2.8);
  g.restore();
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1, S * 0.012);
  g.beginPath(); g.moveTo(-m, foot); g.lineTo(-m, -b); g.lineTo(0, -L); g.moveTo(m, foot); g.lineTo(m, -b); g.lineTo(0, -L); g.moveTo(-W, -b); g.lineTo(W, -b); g.stroke();
  path(); g.strokeStyle = `hsla(${h},70%,${white ? 38 : 17}%,0.9)`; g.lineWidth = Math.max(1.5, S * 0.02); g.stroke();
  g.restore();
}

// The crystal stands at (x, y) and is `size` px tall; t in seconds moves the shine,
// fx (0..1) the rays, halo and sparkles around it.
export function drawCrystal(g, cr, x, y, size, t, fx = 1) {
  const S = size, cy = y - S * 0.5, white = cr.w === 'white';
  g.save();
  if (fx > 0) {
    g.globalCompositeOperation = 'lighter';
    const R = S * 2.3;
    for (let i = 0; i < cr.rays; i++) {
      const a = cr.ph + t * cr.spin + i / cr.rays * Math.PI * 2, wa = Math.PI / cr.rays * (i % 2 ? 0.3 : 0.55) * (1 + 0.15 * Math.sin(t * 2 + i));
      const h = white ? (i * 360 / cr.rays + t * 30) % 360 : cr.h + (i % 3 - 1) * 14;
      const gr = g.createRadialGradient(x, cy, S * 0.1, x, cy, R);
      gr.addColorStop(0, `hsla(${h},100%,80%,${0.34 * fx})`); gr.addColorStop(1, `hsla(${h},100%,70%,0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, cy); g.arc(x, cy, R, a - wa, a + wa); g.closePath(); g.fill();
    }
    const halo = g.createRadialGradient(x, cy, 0, x, cy, S * 1.05);
    halo.addColorStop(0, `hsla(${cr.h},${cr.s}%,85%,${(0.5 + 0.12 * Math.sin(t * 3)) * fx})`); halo.addColorStop(1, `hsla(${cr.h},100%,70%,0)`);
    g.fillStyle = halo; g.beginPath(); g.arc(x, cy, S * 1.05, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  // the little rock it grew on
  g.fillStyle = '#4a4458'; g.strokeStyle = '#211d2c'; g.lineWidth = Math.max(1.5, S * 0.02); g.beginPath();
  cr.rock.forEach((r, k) => { const a = Math.PI + k / (cr.rock.length - 1) * Math.PI; g.lineTo(x + Math.cos(a) * S * 0.36 * r, y + S * 0.03 + Math.sin(a) * S * 0.1 * r); });
  g.lineTo(x + S * 0.3, y + S * 0.08); g.lineTo(x - S * 0.3, y + S * 0.08); g.closePath(); g.fill(); g.stroke();
  cr.shards.forEach((sh, i) => drawShard(g, cr, sh, x, y, S, t, i));
  if (fx > 0) {
    g.globalCompositeOperation = 'lighter';
    cr.shards.forEach((sh, i) => {                                       // twinkles on the tips
      if (sh.len < 0.4) return;
      const p = (t * 0.7 + i * 0.41 + cr.ph) % 1.7; if (p > 0.55) return;
      const k = Math.sin(p / 0.55 * Math.PI), L = sh.len * S;
      star(g, x + sh.x * S + Math.sin(sh.a) * L, y - Math.cos(sh.a) * L, S * 0.24 * k * fx, 'rgba(255,255,255,0.95)');
    });
    for (let i = 0; i < 9; i++) {                                        // sparkles circling it
      const a = t * (0.7 + (i % 3) * 0.22) + i * 0.7 + cr.ph, px = x + Math.cos(a) * S * 0.85, py = cy + Math.sin(a) * S * 0.32;
      const h = white ? (i * 40 + t * 60) % 360 : cr.h;
      star(g, px, py, S * (0.05 + 0.03 * Math.sin(t * 5 + i)) * fx, `hsla(${h},100%,${Math.sin(a) < 0 ? 70 : 88}%,${Math.sin(a) < 0 ? 0.5 : 0.95})`);
    }
  }
  g.restore();
}

export function crystalImage(cr, px, t = 0.8) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  drawCrystal(c.getContext('2d'), cr, px / 2, px * 0.78, px * 0.55, t, 0.85);
  const g = c.getContext('2d'), m = g.createRadialGradient(px / 2, px / 2, px * 0.3, px / 2, px / 2, px / 2);   // soft round edge, no square
  m.addColorStop(0, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = m; g.fillRect(0, 0, px, px);
  return c.toDataURL();
}

const KEY = 'english_crystals_v1';
export function keepCrystal(cr) {
  let all = [];
  try { all = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) {}
  all.unshift(cr); all = all.slice(0, 60);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (_) {}
  return all;
}
