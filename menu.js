// Menu of English Ninja: which ninja, which words, then the journey.
import { initGame, startGame, stopGame, HEROES } from './game.js?v=134';
import { loadVocab, cats, catById, MIX_CATS, knownCount } from './words.js?v=134';
import { crystalImage, crystalColour, keepCrystal } from './treasure.js?v=134';

const $ = (id) => document.getElementById(id);
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem('english_' + k)); return v ?? d; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem('english_' + k, JSON.stringify(v)); } catch (_) {} };
let cat = load('cat', 'colors'), hero = load('hero', 'NinjaFire');
if (!HEROES[hero]) hero = 'NinjaFire';
$('opt-polish').checked = load('polish', false);
$('opt-polish').addEventListener('change', () => save('polish', $('opt-polish').checked));
$('opt-monsters').checked = load('monsters2', true);
$('opt-monsters').addEventListener('change', () => save('monsters2', $('opt-monsters').checked));

function buildHeroes() {
  const r = $('hero-list'); r.innerHTML = '';
  for (const [id, h] of Object.entries(HEROES)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hero' + (id === hero ? ' on' : '');
    b.style.setProperty('--hc', h.color);
    b.innerHTML = `<img src="assets/heroes/${id}_face.png" alt=""><span>${h.name}</span>`;
    b.addEventListener('click', () => { hero = id; save('hero', hero); buildHeroes(); });
    r.append(b);
  }
}
const list = () => [...cats(), { id: 'mix', name: 'Everything', en: 'Everything', icon: '🎲', items: MIX_CATS.flatMap(c => catById(c).items) }];
function build() {
  const r = $('cat-list'); r.innerHTML = '';
  for (const c of list()) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip cat' + (c.id === cat ? ' on' : '');
    b.innerHTML = `<span class="ic">${c.icon}</span> ${c.en || c.name} <small>${knownCount(c.id)}/${c.items.length}</small>`;
    b.addEventListener('click', () => { cat = c.id; save('cat', cat); build(); });
    r.append(b);
  }
}

const cfg = () => ({ cat, hero, polish: $('opt-polish').checked, monsters: $('opt-monsters').checked });
function play(c) { $('menu').classList.add('hidden'); $('game').classList.remove('hidden'); $('win-screen').classList.add('hidden'); startGame(c); }
function menu() { stopGame(); $('game').classList.add('hidden'); $('menu').classList.remove('hidden'); build(); }
let last = null;
$('start-btn').addEventListener('click', () => { last = cfg(); play(last); });
$('back-btn').addEventListener('click', menu);
$('win-menu').addEventListener('click', menu);
$('win-again').addEventListener('click', () => play(last));
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
buildHeroes();
loadVocab().then(build);
initGame({ levelEnd({ crystal, stars, mistakes, firstTry, total, heard, gems = 0, gemsTotal = 0, monsters = 0, chased = 0 }) {
  showCrystal(crystal);
  $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('win-stats').innerHTML = `<li>Right the first time: <b>${firstTry} / ${total}</b></li><li>Mistakes: <b>${mistakes}</b></li>` + (gemsTotal ? `<li>💎 <b>${gems} / ${gemsTotal}</b></li>` : '') + (monsters ? `<li>👾 chased away: <b>${chased}</b></li>` : '');
  $('win-facts-body').innerHTML = heard.length ? '<ul>' + heard.map(f => `<li>${esc(f.text)} <i lang="pl">(${esc(f.pl)})</i></li>`).join('') + '</ul>' : '<p>None this time — next time, talk to the characters on the way!</p>';
  $('win-screen').classList.remove('hidden');
} });

// the crystal from the chest, and the whole collection under it (newest first)
function showCrystal(cr) {
  const box = $('win-crystal');
  if (!cr) { box.innerHTML = '<div class="emoji">🏆</div>'; return; }
  const all = keepCrystal(cr);
  const word = `<b style="color:${cr.w === 'white' ? '#ffffff' : crystalColour(cr)}">${esc(cr.w)}</b>`;
  box.innerHTML = `<img class="crystal-big" src="${crystalImage(cr, 220)}" alt="${esc(cr.w)} crystal"><p class="crystal-name">A ${word} crystal!</p>` +
    (all.length > 1 ? `<p class="muted">Your crystals: ${all.length}</p><div class="crystal-row">${all.slice(0, 16).map((c, i) => `<img src="${crystalImage(c, 64)}" alt="${esc(c.w)}"${i ? '' : ' class="new"'}>`).join('')}</div>` : '');
}
