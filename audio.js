// Fetch + decode a voice/sfx file (URL without extension), .ogg first, .mp3 as fallback
// (Safari has no Vorbis). Resolves to { buffer } or { error }. Self-contained so the game
// can live at its own address.
let order = (() => {
  try { const a = document.createElement('audio'); if (!a.canPlayType('audio/ogg; codecs="vorbis"') && a.canPlayType('audio/mpeg')) return ['mp3', 'ogg']; } catch (_) {}
  return ['ogg', 'mp3'];
})();
const decode = (ctx, bytes) => new Promise((res, rej) => {
  try { const p = ctx.decodeAudioData(bytes.slice(0), res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
});
export async function loadAudioBuffer(ctx, base, version = '') {
  if (!ctx) return { error: 'no Web Audio' };
  const errors = [];
  for (const fmt of order.slice()) {
    try {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 20000);
      const r = await fetch(`${base}.${fmt}${version ? '?v=' + version : ''}`, { signal: ac.signal }).finally(() => clearTimeout(t));
      if (!r.ok) { errors.push(`${fmt}: HTTP ${r.status}`); continue; }
      const buffer = await decode(ctx, await r.arrayBuffer());
      if (fmt !== order[0]) order = [fmt, ...order.filter(f => f !== fmt)];
      return { buffer };
    } catch (e) { errors.push(`${fmt}: ${(e && e.name) || 'error'}`); }
  }
  return { error: errors.join('; ') };
}
