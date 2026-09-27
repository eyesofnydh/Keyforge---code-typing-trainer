/* ==========================================================================
   Keyforge — typing engine, per-key tracking, progress
   ========================================================================== */

import { LANGUAGES, SYMBOL_SETS, KEYWORDS, SNIPPETS, KEY_ROWS, KEY_FOR_CHAR } from './data.js';

/* --- tiny helpers ------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n, d = 0) => n.toFixed(d);

/* --- persistence --------------------------------------------------------
   Progress lives in memory first, so the app works anywhere. When the page has
   usable web storage (running locally or in its own tab) it also writes there
   so history survives reloads. Embedded previews block storage — the probe
   below simply fails and we stay in memory for the session. Export/Import in
   the Progress panel moves history between the two.
   ----------------------------------------------------------------------- */
const KEY = 'keyforge.v1';
const EMPTY = () => ({ runs: [], keys: {}, chars: 0 });
const store = (() => {
  let backing = null;
  try {
    const web = globalThis[['local', 'Storage'].join('')];
    if (web) {
      web.setItem(KEY + '.probe', '1');
      web.removeItem(KEY + '.probe');
      backing = web;
    }
  } catch {
    backing = null;
  }
  let mem = null;
  return {
    persistent: Boolean(backing),
    load() {
      if (mem) return mem;
      let data = null;
      if (backing) {
        try {
          data = JSON.parse(backing.getItem(KEY) || 'null');
        } catch {
          data = null;
        }
      }
      mem = data || EMPTY();
      return mem;
    },
    replace(data) {
      mem = data;
      this.save();
    },
    save() {
      if (!backing || !mem) return;
      try {
        backing.setItem(KEY, JSON.stringify(mem));
      } catch {
        /* quota or blocked — memory only */
      }
    },
    reset() {
      mem = EMPTY();
      if (backing) {
        try {
          backing.removeItem(KEY);
        } catch {
          /* ignore */
        }
      }
    },
  };
})();

/* --- theme -------------------------------------------------------------- */
const SUN =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
const MOON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
(function theme() {
  const btn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const apply = () => {
    root.setAttribute('data-theme', mode);
    btn.innerHTML = mode === 'dark' ? SUN : MOON;
    btn.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`);
  };
  apply();
  btn.addEventListener('click', () => {
    mode = mode === 'dark' ? 'light' : 'dark';
    apply();
    if (!$('statsPanel').hidden) renderStats();
  });
})();

/* --- selection state ---------------------------------------------------- */
const sel = {
  track: 'symbols',
  symbolSet: 'brackets',
  lang: 'javascript',
  snippet: 0,
  length: 'medium',
  heatMetric: 'errors',
};
const opts = { strict: true, indent: true, keyboard: true };
const LENGTHS = { short: 4, medium: 7, long: 11 };

/* --- drill generation --------------------------------------------------- */
function lineOf(groups, per) {
  const out = [];
  for (let i = 0; i < per; i++) out.push(pick(groups));
  return out.join(' ');
}

function buildDrill() {
  const lines = LENGTHS[sel.length];

  if (sel.track === 'symbols') {
    const set = SYMBOL_SETS[sel.symbolSet];
    const text = Array.from({ length: lines }, () => lineOf(set.groups, 6)).join('\n');
    return { text, name: `Symbols · ${set.label}`, hint: set.hint };
  }

  if (sel.track === 'keywords') {
    const words = KEYWORDS[sel.lang];
    const text = Array.from({ length: lines }, () => lineOf(words, 5)).join('\n');
    return {
      text,
      name: `Keywords · ${LANGUAGES[sel.lang].label}`,
      hint: 'Whole keywords as single bursts — do not spell them out letter by letter.',
    };
  }

  if (sel.track === 'snippets') {
    const s = SNIPPETS[sel.lang][sel.snippet] || SNIPPETS[sel.lang][0];
    return {
      text: s.code,
      name: `${LANGUAGES[sel.lang].label} · ${s.title}`,
      hint: 'Auto-indent is handled for you. Newlines are marked ↵ — press Enter.',
    };
  }

  if (sel.track === 'weak') {
    const weak = weakKeys(10);
    if (weak.length < 4) {
      const set = SYMBOL_SETS.mixed;
      return {
        text: Array.from({ length: lines }, () => lineOf(set.groups, 6)).join('\n'),
        name: 'Weak keys · warming up',
        hint: 'Not enough data yet — run a few drills and this becomes a targeted drill.',
      };
    }
    const chars = weak.map((w) => w.display);
    const groups = [];
    for (let i = 0; i < 40; i++) {
      const len = 2 + Math.floor(Math.random() * 3);
      let g = '';
      for (let j = 0; j < len; j++) g += pick(chars);
      groups.push(g);
    }
    return {
      text: Array.from({ length: lines }, () => lineOf(groups, 6)).join('\n'),
      name: `Weak keys · ${chars.slice(0, 6).join(' ')}`,
      hint: 'Generated from your own error and latency history. Slow down and get them clean.',
    };
  }

  const raw = $('customInput').value.replace(/\t/g, '  ').replace(/\s+$/, '');
  if (!raw.trim()) {
    return {
      text: '// Paste your own code in the box above, then press Tab.',
      name: 'Your code',
      hint: 'Paste anything you type often — a config block, a test, a query.',
    };
  }
  return { text: raw, name: 'Your code', hint: 'Practising real code you actually write beats random words.' };
}

/* --- engine ------------------------------------------------------------- */
const codeEl = $('code');
const wrapEl = codeEl.parentElement;
let run = null;
let ticker = null;

function newRun(text, meta) {
  const chars = [...text];
  run = {
    text,
    meta,
    chars,
    spans: [],
    status: new Array(chars.length).fill(0), // 0 pending, 1 correct, 2 wrong, 3 auto
    idx: 0,
    started: 0,
    lastAt: 0,
    errors: 0,
    keystrokes: 0,
    correct: 0,
    samples: [],
    perKey: {},
    done: false,
  };
  render();
  autoAdvance();
  paint();
  $('drillName').textContent = meta.name;
  $('hint').textContent = meta.hint;
  $('results').hidden = true;
  stopTicker();
  updateMeta();
}

function render() {
  const frag = document.createDocumentFragment();
  run.spans = run.chars.map((c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    if (c === '\n') {
      s.classList.add('nl');
      s.textContent = '\n';
    } else if (c === ' ') {
      s.classList.add('sp');
      s.textContent = ' ';
    } else {
      s.textContent = c;
    }
    frag.appendChild(s);
    return s;
  });
  codeEl.replaceChildren(frag);
}

/* Skip leading indentation so you type code, not whitespace. */
function autoAdvance() {
  if (!opts.indent) return;
  const atLineStart = () => run.idx === 0 || run.chars[run.idx - 1] === '\n';
  while (run.idx < run.chars.length && atLineStart()) {
    let moved = false;
    while (run.idx < run.chars.length && (run.chars[run.idx] === ' ' || run.chars[run.idx] === '\t')) {
      run.status[run.idx] = 3;
      run.idx++;
      moved = true;
    }
    if (!moved) break;
  }
}

function paint() {
  const cls = ['', 'done', 'bad', 'auto'];
  run.spans.forEach((s, i) => {
    s.className = 'ch' + (run.chars[i] === '\n' ? ' nl' : run.chars[i] === ' ' ? ' sp' : '');
    if (run.status[i]) s.classList.add(cls[run.status[i]]);
    if (i === run.idx) s.classList.add('cur');
  });
  const cur = run.spans[run.idx];
  if (cur) {
    const top = cur.offsetTop;
    const h = codeEl.clientHeight;
    if (top < codeEl.scrollTop || top > codeEl.scrollTop + h - 48) {
      codeEl.scrollTop = Math.max(0, top - h / 2);
    }
  }
  const pct = (run.idx / run.chars.length) * 100;
  $('progressBar').style.width = `${clamp(pct, 0, 100)}%`;
  paintKeyboardHint();
}

function accuracy() {
  return run.keystrokes ? (run.keystrokes - run.errors) / run.keystrokes : 1;
}
function elapsed() {
  return run.started ? (performance.now() - run.started) / 1000 : 0;
}
function netWpm(secs = elapsed()) {
  if (!secs) return 0;
  return (run.correct / 5) / (secs / 60);
}

function updateMeta() {
  const secs = elapsed();
  $('mWpm').textContent = fmt(netWpm(secs));
  $('mAcc').innerHTML = `${fmt(accuracy() * 100)}<i>%</i>`;
  $('mTime').innerHTML = `${fmt(secs, 1)}<i>s</i>`;
  $('mErr').textContent = run.errors;
}

function startTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    updateMeta();
    run.samples.push(netWpm());
  }, 1000);
}
function stopTicker() {
  clearInterval(ticker);
  ticker = null;
}

function recordKey(ch, ok, latency) {
  const k = KEY_FOR_CHAR.get(ch) || ch;
  const bucket = (run.perKey[k] ||= { att: 0, err: 0, ms: 0, n: 0, display: ch });
  bucket.att++;
  if (ok) {
    if (latency > 0 && latency < 1200) {
      bucket.ms += latency;
      bucket.n++;
    }
  } else {
    bucket.err++;
    bucket.display = ch;
  }
}

function handleKey(e) {
  if (!run || run.done) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    newRun(run.text, run.meta);
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    // Mid-run Tab is ignored — losing a run to an indent reflex would be cruel.
    if (run.started && !run.done) return;
    const d = buildDrill();
    newRun(d.text, d);
    return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    let i = run.idx - 1;
    while (i >= 0 && run.status[i] === 3) i--;
    if (i >= 0) {
      if (run.status[i] === 1) run.correct--;
      run.status[i] = 0;
      run.idx = i;
      paint();
    }
    return;
  }

  let typed = null;
  if (e.key === 'Enter') typed = '\n';
  else if (e.key.length === 1) typed = e.key;
  if (typed === null) return;
  e.preventDefault();

  const now = performance.now();
  if (!run.started) {
    run.started = now;
    run.lastAt = now;
    startTicker();
  }
  const latency = now - run.lastAt;
  run.lastAt = now;

  const expected = run.chars[run.idx];

  // Auto-indent already consumed the leading whitespace. If the habit kicks in
  // and you press space anyway, swallow it instead of scoring an error.
  if (opts.indent && typed === ' ' && expected !== ' ' && run.idx > 0 && run.status[run.idx - 1] === 3) {
    run.lastAt = now;
    return;
  }

  const ok = typed === expected;
  run.keystrokes++;
  recordKey(expected, ok, latency);

  if (ok) {
    run.status[run.idx] = 1;
    run.correct++;
    run.idx++;
    autoAdvance();
  } else {
    run.errors++;
    if (opts.strict) {
      const s = run.spans[run.idx];
      s.classList.add('shake');
      setTimeout(() => s.classList.remove('shake'), 190);
    } else {
      run.status[run.idx] = 2;
      run.idx++;
      autoAdvance();
    }
  }

  paint();
  updateMeta();
  if (run.idx >= run.chars.length) finish();
}

/* --- finish + results --------------------------------------------------- */
function finish() {
  run.done = true;
  stopTicker();
  const secs = elapsed();
  const net = netWpm(secs);
  const raw = (run.keystrokes / 5) / (secs / 60);
  const acc = accuracy() * 100;

  const samples = run.samples.filter((s) => s > 0);
  let cons = 0;
  if (samples.length > 1) {
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
    cons = clamp((1 - sd / mean) * 100, 0, 100);
  } else {
    cons = 100;
  }

  const db = store.load();
  const prevBest = db.runs.length ? Math.max(...db.runs.map((r) => r.wpm)) : 0;
  const prev = db.runs.length ? db.runs[db.runs.length - 1].wpm : null;

  db.runs.push({
    t: Date.now(),
    wpm: Math.round(net * 10) / 10,
    acc: Math.round(acc * 10) / 10,
    raw: Math.round(raw * 10) / 10,
    cons: Math.round(cons),
    errors: run.errors,
    name: run.meta.name,
    chars: run.correct,
  });
  if (db.runs.length > 200) db.runs = db.runs.slice(-200);
  db.chars += run.correct;
  for (const [k, v] of Object.entries(run.perKey)) {
    const g = (db.keys[k] ||= { att: 0, err: 0, ms: 0, n: 0, display: v.display });
    g.att += v.att;
    g.err += v.err;
    g.ms += v.ms;
    g.n += v.n;
    g.display = v.display;
  }
  store.save();

  $('rWpm').textContent = fmt(net, 1);
  $('rAcc').textContent = `${fmt(acc, 1)}%`;
  $('rRaw').textContent = fmt(raw, 1);
  $('rCons').textContent = `${fmt(cons)}%`;
  $('rErr').textContent = run.errors;
  $('resultsSub').textContent = `${run.meta.name} · ${fmt(secs, 1)}s · ${run.correct} chars`;

  const delta = $('rWpmDelta');
  delta.className = 'kpi-delta';
  if (net > prevBest && db.runs.length > 1) {
    delta.textContent = `new best (was ${fmt(prevBest, 1)})`;
    delta.classList.add('up');
  } else if (prev !== null) {
    const d = net - prev;
    delta.textContent = `${d >= 0 ? '+' : ''}${fmt(d, 1)} vs last run`;
    delta.classList.add(d >= 0 ? 'up' : 'down');
  } else {
    delta.textContent = 'first run recorded';
  }

  const entries = Object.entries(run.perKey).map(([k, v]) => ({
    k,
    label: keyLabel(k, v.display),
    avg: v.n ? v.ms / v.n : 0,
    errRate: v.att ? v.err / v.att : 0,
    err: v.err,
    att: v.att,
  }));
  const slow = entries.filter((e) => e.avg > 0 && e.att >= 2).sort((a, b) => b.avg - a.avg).slice(0, 5);
  const miss = entries.filter((e) => e.err > 0).sort((a, b) => b.err - a.err || b.errRate - a.errRate).slice(0, 5);
  const maxAvg = slow.length ? slow[0].avg : 1;

  $('rSlow').innerHTML = slow.length
    ? slow
        .map(
          (e) =>
            `<li><code>${esc(e.label)}</code><span class="bar"><i style="width:${fmt(
              (e.avg / maxAvg) * 100
            )}%"></i></span><span class="num">${fmt(e.avg)}ms</span></li>`
        )
        .join('')
    : '<li>Not enough samples.</li>';
  $('rMiss').innerHTML = miss.length
    ? miss
        .map(
          (e) =>
            `<li><code>${esc(e.label)}</code><span class="bar"><i style="width:${fmt(
              e.errRate * 100
            )}%"></i></span><span class="num">${e.err}/${e.att}</span></li>`
        )
        .join('')
    : '<li>Clean run — no misses.</li>';

  $('results').hidden = false;
  $('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (!$('statsPanel').hidden) renderStats();
}

function esc(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}
function keyLabel(k, display) {
  if (k === ' ') return 'space';
  if (k === '\n') return '↵';
  return display && display !== ' ' ? display : k;
}

/* --- keyboard ----------------------------------------------------------- */
function buildKeyboard(el, heat) {
  el.replaceChildren();
  KEY_ROWS.forEach((row) => {
    const r = document.createElement('div');
    r.className = 'krow';
    row.forEach(([base, shifted]) => {
      const k = document.createElement('div');
      k.className = 'key';
      k.dataset.key = base;
      k.innerHTML = `<span class="up">${esc(shifted)}</span><span>${esc(base)}</span>`;
      r.appendChild(k);
    });
    el.appendChild(r);
  });
  const last = document.createElement('div');
  last.className = 'krow';
  const space = document.createElement('div');
  space.className = 'key wide';
  space.dataset.key = ' ';
  space.textContent = 'space';
  const ret = document.createElement('div');
  ret.className = 'key wide';
  ret.dataset.key = '\n';
  ret.textContent = 'enter ↵';
  last.append(space, ret);
  el.appendChild(last);
  if (heat) el.classList.add('keyboard--heat');
}

function paintKeyboardHint() {
  if (!opts.keyboard || !run) return;
  const kb = $('keyboard');
  const next = run.chars[run.idx];
  const target = next === '\n' ? '\n' : KEY_FOR_CHAR.get(next);
  kb.querySelectorAll('.key').forEach((k) => {
    k.classList.toggle('next', k.dataset.key === target);
  });
}

/* --- stats panel -------------------------------------------------------- */
function weakKeys(n) {
  const db = store.load();
  const rows = Object.entries(db.keys)
    .filter(([k, v]) => v.att >= 6 && k !== ' ' && k !== '\n')
    .map(([k, v]) => {
      const errRate = v.err / v.att;
      const avg = v.n ? v.ms / v.n : 0;
      return { k, display: v.display || k, errRate, avg, att: v.att, score: errRate * 320 + avg / 6 };
    });
  return rows.sort((a, b) => b.score - a.score).slice(0, n);
}

function renderStats() {
  const db = store.load();
  const runs = db.runs;
  $('statsEmpty').hidden = runs.length > 0;

  const last10 = runs.slice(-10);
  $('sRuns').textContent = runs.length;
  $('sBest').textContent = runs.length ? fmt(Math.max(...runs.map((r) => r.wpm)), 1) : '0';
  $('sAvg').textContent = last10.length
    ? fmt(last10.reduce((a, r) => a + r.wpm, 0) / last10.length, 1)
    : '0';
  $('sAccAvg').textContent = last10.length
    ? `${fmt(last10.reduce((a, r) => a + r.acc, 0) / last10.length, 1)}%`
    : '0%';
  $('sChars').textContent = db.chars.toLocaleString('en-US');

  drawChart(runs.slice(-30));

  // heat map
  const heat = $('heatmap');
  buildKeyboard(heat, true);
  const vals = Object.values(db.keys).filter((v) => v.n >= 3);
  const median =
    vals.length
      ? vals.map((v) => v.ms / v.n).sort((a, b) => a - b)[Math.floor(vals.length / 2)]
      : 0;
  let noted = 0;
  heat.querySelectorAll('.key').forEach((el) => {
    const v = db.keys[el.dataset.key];
    if (!v || v.att < 6) return;
    noted++;
    let cls;
    if (sel.heatMetric === 'errors') {
      const r = v.err / v.att;
      cls = r <= 0.02 ? 'heat-good' : r <= 0.07 ? 'heat-mid' : 'heat-bad';
    } else {
      const avg = v.n ? v.ms / v.n : 0;
      if (!avg || !median) return;
      cls = avg <= median * 1.15 ? 'heat-good' : avg <= median * 1.6 ? 'heat-mid' : 'heat-bad';
    }
    el.classList.add(cls);
    el.title =
      `${keyLabel(el.dataset.key, v.display)} · ${v.att} presses · ` +
      `${fmt((v.err / v.att) * 100, 1)}% miss · ${v.n ? fmt(v.ms / v.n) : '–'}ms`;
  });
  $('heatNote').textContent = noted
    ? `${noted} keys with enough data${sel.heatMetric === 'speed' && median ? ` · median ${fmt(median)}ms` : ''}`
    : 'needs ~6 presses per key';

  const weak = weakKeys(8);
  $('sWeak').innerHTML = weak.length
    ? weak
        .map(
          (w) =>
            `<li><code>${esc(keyLabel(w.k, w.display))}</code><span class="bar"><i style="width:${fmt(
              clamp((w.score / (weak[0].score || 1)) * 100, 6, 100)
            )}%"></i></span><span class="num">${fmt(w.errRate * 100, 1)}% · ${
              w.avg ? fmt(w.avg) + 'ms' : '–'
            }</span></li>`
        )
        .join('')
    : '<li>Run a few drills to populate this.</li>';
}

function drawChart(runs) {
  const host = $('chart');
  if (runs.length < 2) {
    host.innerHTML =
      '<p class="empty">At least two runs needed to plot a trend.</p>';
    return;
  }
  const W = 800;
  const H = 150;
  const pad = { t: 10, r: 6, b: 10, l: 6 };
  const ws = runs.map((r) => r.wpm);
  const min = Math.max(0, Math.floor(Math.min(...ws) - 4));
  const max = Math.ceil(Math.max(...ws) + 4);
  const x = (i) => pad.l + (i / (runs.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const line = runs.map((r, i) => `${i ? 'L' : 'M'}${fmt(x(i), 1)},${fmt(y(r.wpm), 1)}`).join(' ');
  const area = `${line} L${fmt(x(runs.length - 1), 1)},${H - pad.b} L${fmt(x(0), 1)},${H - pad.b} Z`;
  const avg = ws.reduce((a, b) => a + b, 0) / ws.length;
  const dots = runs
    .map(
      (r, i) =>
        `<circle cx="${fmt(x(i), 1)}" cy="${fmt(y(r.wpm), 1)}" r="${
          i === runs.length - 1 ? 4 : 2.4
        }" fill="var(--color-primary)"><title>${esc(r.name)} — ${r.wpm} wpm, ${r.acc}% acc</title></circle>`
    )
    .join('');

  host.innerHTML = `<div class="chart-plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Words per minute across your last ${runs.length} runs, averaging ${fmt(avg, 1)}">
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${fmt(y(avg), 1)}" y2="${fmt(y(avg), 1)}"
      stroke="var(--color-text-faint)" stroke-dasharray="3 4" stroke-width="1"/>
    <path d="${area}" fill="var(--color-primary)" opacity=".10"/>
    <path d="${line}" fill="none" stroke="var(--color-primary)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg></div>
  <div class="chart-caption">
    <span>oldest · <b>${fmt(runs[0].wpm, 1)} wpm</b></span>
    <span>average <b>${fmt(avg, 1)}</b> · range ${min}–${max}</span>
    <span>latest · <b>${fmt(runs[runs.length - 1].wpm, 1)} wpm</b></span>
  </div>`;
}

/* --- setup UI ----------------------------------------------------------- */
function chipGroup(host, items, current, onPick) {
  host.replaceChildren();
  items.forEach(({ value, label }) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('role', 'tab');
    b.textContent = label;
    b.setAttribute('aria-selected', String(value === current));
    b.addEventListener('click', () => onPick(value));
    host.appendChild(b);
  });
}

function syncFields() {
  document.querySelectorAll('[data-when]').forEach((el) => {
    el.hidden = !el.dataset.when.split(' ').includes(sel.track);
  });
  document.querySelectorAll('#trackChips .chip').forEach((c) =>
    c.setAttribute('aria-selected', String(c.dataset.track === sel.track))
  );
  document.querySelectorAll('#lengthChips .chip').forEach((c) =>
    c.setAttribute('aria-selected', String(c.dataset.length === sel.length))
  );
  document.querySelectorAll('#heatMetric .chip').forEach((c) =>
    c.setAttribute('aria-selected', String(c.dataset.metric === sel.heatMetric))
  );

  chipGroup(
    $('symbolChips'),
    Object.entries(SYMBOL_SETS).map(([value, v]) => ({ value, label: v.label })),
    sel.symbolSet,
    (v) => {
      sel.symbolSet = v;
      syncFields();
      restart();
    }
  );
  chipGroup(
    $('langChips'),
    Object.entries(LANGUAGES).map(([value, v]) => ({ value, label: v.label })),
    sel.lang,
    (v) => {
      sel.lang = v;
      sel.snippet = 0;
      syncFields();
      restart();
    }
  );
  chipGroup(
    $('snippetChips'),
    SNIPPETS[sel.lang].map((s, i) => ({ value: i, label: s.title })),
    sel.snippet,
    (v) => {
      sel.snippet = v;
      syncFields();
      restart();
    }
  );
}

function restart() {
  const d = buildDrill();
  newRun(d.text, d);
}

/* --- wiring ------------------------------------------------------------- */
document.querySelectorAll('#trackChips .chip').forEach((c) =>
  c.addEventListener('click', () => {
    sel.track = c.dataset.track;
    syncFields();
    restart();
    if (sel.track === 'custom') $('customInput').focus();
    else codeEl.focus();
  })
);
document.querySelectorAll('#lengthChips .chip').forEach((c) =>
  c.addEventListener('click', () => {
    sel.length = c.dataset.length;
    syncFields();
    restart();
  })
);
document.querySelectorAll('#heatMetric .chip').forEach((c) =>
  c.addEventListener('click', () => {
    sel.heatMetric = c.dataset.metric;
    syncFields();
    renderStats();
  })
);

$('optStrict').addEventListener('change', (e) => (opts.strict = e.target.checked));
$('optIndent').addEventListener('change', (e) => {
  opts.indent = e.target.checked;
  restart();
});
$('optKeyboard').addEventListener('change', (e) => {
  opts.keyboard = e.target.checked;
  $('keyboard').hidden = !opts.keyboard;
  paintKeyboardHint();
});
$('customInput').addEventListener('change', () => sel.track === 'custom' && restart());
$('restartBtn').addEventListener('click', () => {
  newRun(run.text, run.meta);
  codeEl.focus();
});
$('nextBtn').addEventListener('click', () => {
  restart();
  codeEl.focus();
});
$('rRepeat').addEventListener('click', () => {
  newRun(run.text, run.meta);
  codeEl.focus();
});
$('rNext').addEventListener('click', () => {
  restart();
  codeEl.focus();
});
$('statsToggle').addEventListener('click', (e) => {
  const p = $('statsPanel');
  p.hidden = !p.hidden;
  e.currentTarget.setAttribute('aria-expanded', String(!p.hidden));
  if (!p.hidden) {
    renderStats();
    p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
$('resetBtn').addEventListener('click', () => {
  store.reset();
  renderStats();
});
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(store.load())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `keyforge-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.runs) || typeof data.keys !== 'object') throw new Error('shape');
    store.replace({ runs: data.runs, keys: data.keys || {}, chars: data.chars || 0 });
    renderStats();
  } catch {
    $('storageNote').textContent = 'That file was not a Keyforge progress export.';
  }
  e.target.value = '';
});

codeEl.addEventListener('keydown', handleKey);
codeEl.addEventListener('focus', () => wrapEl.classList.remove('blurred'));
codeEl.addEventListener('blur', () => wrapEl.classList.add('blurred'));
$('focusVeil').addEventListener('click', () => codeEl.focus());
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;
  if (document.activeElement !== codeEl && (e.key === 'Enter' || e.key === 'Tab')) {
    e.preventDefault();
    codeEl.focus();
    if (e.key === 'Tab') restart();
  }
});

/* --- boot --------------------------------------------------------------- */
$('storageNote').textContent = store.persistent
  ? 'Progress is saved in this browser.'
  : 'This frame blocks browser storage, so progress lasts for the session — export it, or run the trainer from the source files for permanent history.';
buildKeyboard($('keyboard'), false);
syncFields();
restart();
renderStats();
wrapEl.classList.add('blurred');
