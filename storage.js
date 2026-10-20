import { xpForRun } from './core.js';
const KEY = 'keyforge.v2';
const LEGACY_KEY = 'keyforge.v1';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const number = (value, max = 1e12) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const text = (value, max = 200) => typeof value === 'string' && value.length <= max;
export const emptyProfile = () => ({ version: 2, runs: [], keys: {}, pairs: {}, chars: 0, xp: 0, ghosts: {}, settings: { theme: 'void' } });

// Validate imports and saved data alike; never merge arbitrary objects into app state.
export function validateProfile(input) {
  if (!object(input) || !Array.isArray(input.runs) || input.runs.length > 1000 || !object(input.keys)) throw new Error('Invalid progress format.');
  const db = emptyProfile();
  db.runs = input.runs.map(r => {
    if (!object(r) || !number(r.t, 9e15) || !number(r.wpm, 100000) || !number(r.acc, 100) || !text(r.name || 'Imported run')) throw new Error('Invalid run in progress file.');
    return { t: r.t, wpm: r.wpm, acc: r.acc, name: r.name || 'Imported run', raw: number(r.raw, 100000) ? r.raw : r.wpm,
      cons: number(r.cons, 100) ? r.cons : null, errors: number(r.errors) ? r.errors : 0, chars: number(r.chars) ? r.chars : 0,
      seconds: number(r.seconds, 86400) ? r.seconds : 0, attempts: number(r.attempts) ? r.attempts : 0,
      mode: ['practice', 'test', 'invaders', 'ghost'].includes(r.mode) ? r.mode : 'legacy',
      track: text(r.track, 30) ? r.track : 'legacy', duration: number(r.duration, 600) ? r.duration : 0,
      strict: Boolean(r.strict), indent: Boolean(r.indent), backspaces: number(r.backspaces) ? r.backspaces : 0,
      xp: number(r.xp, 500) ? r.xp : 0, id: text(r.id, 80) ? r.id : '', completed: r.completed !== false };
  });
  if (Object.keys(input.keys).length > 1000) throw new Error('Too many key records.');
  db.keys = Object.create(null);
  for (const [k, v] of Object.entries(input.keys)) {
    if (!text(k, 8) || !object(v) || !['att','err','ms','n'].every(f => number(v[f])) || v.err > v.att || v.n > v.att) throw new Error('Invalid key statistics.');
    const mistakes = Object.create(null);
    if (object(v.mistakes)) for (const [ch, count] of Object.entries(v.mistakes)) if (text(ch, 8) && number(count)) mistakes[ch] = count;
    db.keys[k] = { att: v.att, err: v.err, ms: v.ms, n: v.n, display: text(v.display,8) ? v.display : k, mistakes };
  }
  db.pairs = Object.create(null);
  if (object(input.pairs)) for (const [k, v] of Object.entries(input.pairs).slice(0, 1000)) {
    if (/^[a-z]{2}$/.test(k) && object(v) && number(v.att) && number(v.err) && v.err <= v.att) db.pairs[k] = { att: v.att, err: v.err };
  }
  db.chars = number(input.chars) ? input.chars : db.runs.reduce((n,r) => n + r.chars, 0);
  db.xp = number(input.xp) ? input.xp : db.runs.reduce((n,r) => n + xpForRun(r), 0);
  db.ghosts = Object.create(null);
  if (object(input.ghosts)) for (const [key, g] of Object.entries(input.ghosts).slice(0, 6)) {
    if (!text(key, 40) || !object(g) || !text(g.text, 12000) || !number(g.wpm, 100000) || !Array.isArray(g.events) || g.events.length > 4000) continue;
    const length = [...g.text].length;
    if (!g.events.every((e,i,a) => Array.isArray(e) && e.length === 2 && number(e[0], 86400000) && Number.isInteger(e[1]) && e[1] >= 0 && e[1] <= length && (i === 0 || e[0] >= a[i-1][0]))) continue;
    db.ghosts[key] = { text: g.text, wpm: g.wpm, events: g.events };
  }
  if (object(input.settings) && ['void','paper','ocean','terminal'].includes(input.settings.theme)) db.settings.theme = input.settings.theme;
  return db;
}

export function createStore(backing) {
  let db = emptyProfile(); let persistent = Boolean(backing); let warning = '';
  try {
    backing?.setItem(KEY + '.probe', '1'); backing?.removeItem(KEY + '.probe');
  } catch { persistent = false; warning = 'Storage is unavailable. Export your progress before leaving.'; }
  try {
    const raw = persistent ? (backing.getItem(KEY) || backing.getItem(LEGACY_KEY)) : null;
    if (raw) db = validateProfile(JSON.parse(raw));
  } catch { warning = 'Saved progress could not be read. You can import a backup from your profile.'; }
  return {
    get data() { return db; }, get persistent() { return persistent; }, get warning() { return warning; },
    save() { if (!persistent) return; try { backing.setItem(KEY, JSON.stringify(db)); } catch { persistent = false; warning = 'Storage is unavailable or full. Export your progress before leaving.'; } },
    replace(value) { db = validateProfile(value); this.save(); },
    reset() { const theme = db.settings.theme; db = emptyProfile(); db.settings.theme = theme; this.save(); try { backing?.removeItem(LEGACY_KEY); } catch {} },
    record(session, meta, now) {
      const run = { ...session.metrics(now), ...meta, t: Date.now() };
      const previous = session.savedProgress || { chars: 0, xp: 0, keys: {}, pairs: {} };
      run.xp = xpForRun(run);
      const index = run.id ? db.runs.findIndex(r => r.id === run.id) : -1;
      if (index < 0) db.runs.push(run); else db.runs[index] = run;
      db.runs = db.runs.slice(-1000); db.chars += run.chars - previous.chars; db.xp += run.xp - previous.xp;
      for (const [k, v] of Object.entries(session.keys)) {
        const b = db.keys[k] ||= { att: 0, err: 0, ms: 0, n: 0, display: v.display, mistakes: Object.create(null) };
        const old = previous.keys[k];
        for (const f of ['att','err','ms','n']) b[f] += v[f] - (old?.[f] || 0);
        for (const [ch,n] of Object.entries(v.mistakes)) b.mistakes[ch] = (b.mistakes[ch] || 0) + n - (old?.mistakes[ch] || 0);
      }
      for (const [pair,v] of Object.entries(session.pairs)) { const p = db.pairs[pair] ||= { att:0, err:0 }; p.att += v.att - (previous.pairs[pair]?.att || 0); p.err += v.err - (previous.pairs[pair]?.err || 0); }
      session.savedProgress = structuredClone({ chars: run.chars, xp: run.xp, keys: session.keys, pairs: session.pairs });
      this.save(); return run;
    }
  };
}
