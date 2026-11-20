// Pictures that explain a character's English fact (fact_pics.json from
// tools/build_fact_pics.py): "Cows give us milk." = 🐄 cows → 🥛 milk.
// A strip of them pops up word by word in the caption while the fact is spoken,
// and the same pictures hang on a sign over the character at the roadside.

let data = null;
export async function loadFactPics() {
  if (!data) {
    try { data = await (await fetch(new URL('./fact_pics.json?v=' + Date.now().toString(36).slice(0, -5), import.meta.url).href, { cache: 'no-cache' })).json(); }
    catch (_) { data = {}; }
  }
  return data;
}
const imgUrl = (cp) => new URL(`./img/${cp}.svg`, import.meta.url).href;
const NUM = { 2: 'two', 3: 'three', 4: 'four', 6: 'six', 7: 'seven', 8: 'eight', 10: 'ten', 12: 'twelve', 20: 'twenty', 24: 'twenty-four' };
const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SIGN_TXT = { '✗': '✖' };

// where in the sentence (0..1) a token's word is said, so its picture appears with it
function timing(tokens, text) {
  const low = text.toLowerCase(), at = [];
  let from = 0;
  for (const t of tokens) {
    const w = (t.n ? NUM[t.n] || t.n : t.w || '').toLowerCase().split(' ')[0];
    let i = w ? low.indexOf(w, from) : -1;
    if (i < 0 && w) i = low.indexOf(w);
    at.push(i < 0 ? null : i / low.length);
    if (i >= 0) from = i + 1;
  }
  for (let i = at.length - 1; i >= 0; i--) if (at[i] === null) at[i] = i + 1 < at.length ? at[i + 1] : 0.9;   // signs come with the next picture
  for (let i = 1; i < at.length; i++) at[i] = Math.max(at[i], at[i - 1]);
  return at;
}

// HTML of the strip; pictures appear (CSS animation) as the voice reaches their word
export function stripHtml(id, text, ms) {
  const tokens = data && data[id];
  if (!tokens) return '';
  const at = timing(tokens, text);
  return tokens.map((t, i) => {
    const d = `style="animation-delay:${Math.round(Math.min(at[i] * ms * 0.9, ms))}ms"`;
    if (t.s) return `<span class="fp-sign" ${d}>${SIGN_TXT[t.s] || t.s}</span>`;
    if (t.n) return `<span class="fp-num" ${d}>${t.n}</span>`;
    if (!t.img) return `<figure ${d}><span class="fp-word">${esc(t.w)}</span></figure>`;
    return `<figure ${d}><img src="${imgUrl(t.img)}" alt=""><figcaption>${esc(t.w)}</figcaption></figure>`;
  }).join('');
}

// the fact's sentence with the pictured words in bold
export function markWords(id, text) {
  const tokens = (data && data[id]) || [];
  const words = [...new Set(tokens.flatMap(t => [t.w, t.n && NUM[t.n]]).filter(Boolean))].sort((a, b) => b.length - a.length);
  let html = esc(text);
  if (!words.length) return html;
  const re = new RegExp(`\\b(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  return html.replace(re, '<b class="kw">$1</b>');
}

const imgs = new Map();
function loadImg(cp) {
  if (!imgs.has(cp)) imgs.set(cp, new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = imgUrl(cp); }));
  return imgs.get(cp);
}

// A sign for the roadside: the pictures (no words) on a white board. Returns { canvas, aspect } or null.
export async function signCanvas(id) {
  const tokens = data && data[id];
  if (!tokens) return null;
  const P = 112, S = 56, pad = 22;
  const wOf = (t) => (t.img ? P : t.s ? S : t.n ? 76 : 150);
  const W = Math.min(1024, pad * 2 + tokens.reduce((a, t) => a + wOf(t) + 10, -10)), H = P + pad * 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.strokeStyle = '#0a1a3c'; g.lineWidth = 8;
  g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 30); g.fill(); g.stroke();
  let x = pad;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const t of tokens) {
    const w = wOf(t), cx = x + w / 2, cy = H / 2;
    if (t.img) { const im = await loadImg(t.img); if (im) g.drawImage(im, x, pad, P, P); }
    else if (t.s) { g.fillStyle = t.s === '✗' ? '#e03131' : '#0a1a3c'; g.font = '900 54px system-ui, sans-serif'; g.fillText(SIGN_TXT[t.s] || t.s, cx, cy + 2); }
    else if (t.n) { g.fillStyle = '#ff5a36'; g.font = '900 78px system-ui, sans-serif'; g.lineWidth = 8; g.strokeStyle = '#0a1a3c'; g.strokeText(t.n, cx, cy + 4); g.fillText(t.n, cx, cy + 4); }
    else { g.fillStyle = '#0a1a3c'; g.font = '800 38px system-ui, sans-serif'; g.fillText(t.w, cx, cy); }
    x += w + 10;
  }
  return { canvas: c, aspect: W / H };
}
