// Scoring and replay data are shared by practice, tests, and both games.
import { KEY_FOR_CHAR } from './data.js';
export const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export function consistency(intervals) {
  if (intervals.length < 5) return null;
  const mean = average(intervals);
  return mean ? clamp(100 * (1 - Math.sqrt(average(intervals.map(n => (n - mean) ** 2))) / mean), 0, 100) : null;
}
export class TypingSession {
  constructor(text, { strict = false, indent = false, duration = 0 } = {}) {
    this.chars = [...text]; this.status = this.chars.map(() => 0); this.index = 0;
    this.strict = strict; this.indent = indent; this.duration = duration;
    this.started = null; this.ended = null; this.done = false; this.attempts = 0; this.lastWrong = false;
    this.errors = 0; this.correct = 0; this.backspaces = 0; this.lastAt = null;
    this.keys = Object.create(null); this.pairs = Object.create(null); this.intervals = []; this.events = [];
    this.skipIndent();
  }
  skipIndent() {
    if (!this.indent) return;
    if (this.index === 0 || this.chars[this.index - 1] === '\n') {
      while ([' ', '\t'].includes(this.chars[this.index])) { this.status[this.index++] = 3; }
    }
  }
  append(text) { this.chars.push(...text); this.status.push(...[...text].map(() => 0)); }
  elapsed(now) { return this.started === null ? 0 : Math.max(0, ((this.ended ?? now) - this.started) / 1000); }
  expired(now) { return this.started !== null && this.duration > 0 && this.elapsed(now) >= this.duration; }
  finish(now) {
    if (this.done) return;
    this.ended = this.duration && this.started !== null ? Math.min(now, this.started + this.duration * 1000) : now;
    this.done = true;
  }
  type(ch, now) {
    if (this.done) return false;
    if (this.expired(now)) { this.finish(now); return false; }
    if (this.index >= this.chars.length) return false;
    if (this.started === null) this.started = now;
    const expected = this.chars[this.index];
    const latency = this.lastAt === null ? 0 : now - this.lastAt;
    this.lastAt = now;
    const ok = ch === expected;
    this.lastWrong = !ok;
    this.attempts++; if (!ok) this.errors++;
    const physical = KEY_FOR_CHAR.get(expected) || expected;
    const bucket = this.keys[physical] ||= { att: 0, err: 0, ms: 0, n: 0, display: expected, mistakes: Object.create(null) };
    bucket.att++;
    if (!ok) { bucket.err++; bucket.mistakes[ch] = (bucket.mistakes[ch] || 0) + 1; }
    if (ok && latency > 0 && latency < 2000) { bucket.ms += latency; bucket.n++; this.intervals.push(latency); }
    if (this.index > 0 && /[a-z]/i.test(expected) && /[a-z]/i.test(this.chars[this.index - 1])) {
      const pair = (this.chars[this.index - 1] + expected).toLowerCase();
      const p = this.pairs[pair] ||= { att: 0, err: 0 }; p.att++; if (!ok) p.err++;
    }
    if (ok || !this.strict) {
      this.status[this.index++] = ok ? 1 : 2; if (ok) this.correct++;
      this.skipIndent(); this.events.push([Math.round(now - this.started), this.index]);
    }
    if (this.index >= this.chars.length && !this.duration) this.finish(now);
    return ok;
  }
  backspace(now) {
    if (this.done) return;
    if (this.expired(now)) { this.finish(now); return; }
    let index = this.index - 1; while (index >= 0 && this.status[index] === 3) index--;
    if (index < 0) return;
    this.backspaces++;
    this.lastWrong = false;
    if (this.status[index] === 1) this.correct--;
    this.status[index] = 0; this.index = index;
    this.lastAt = now;
    if (this.started !== null) this.events.push([Math.round(now - this.started), this.index]);
  }
  metrics(now) {
    const seconds = this.elapsed(now);
    return {
      seconds, wpm: seconds > 0 ? this.correct / 5 / (seconds / 60) : 0,
      raw: seconds > 0 ? this.attempts / 5 / (seconds / 60) : 0,
      acc: this.attempts ? (1 - this.errors / this.attempts) * 100 : 100,
      cons: consistency(this.intervals), errors: this.errors, chars: this.correct,
      attempts: this.attempts, backspaces: this.backspaces,
    };
  }
}
export function ghostPosition(events, milliseconds) {
  let low = 0, high = events.length;
  while (low < high) { const mid = (low + high) >>> 1; if (events[mid][0] <= milliseconds) low = mid + 1; else high = mid; }
  return low ? events[low - 1][1] : 0;
}
export function localDay(time = Date.now()) {
  const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function streak(runs, now = Date.now()) {
  const days = new Set(runs.map(r => localDay(r.t))); const d = new Date(now);
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (days.has(localDay(d))) { count++; d.setDate(d.getDate() - 1); }
  return count;
}
export function weakKeys(keys, limit = 8) {
  return Object.entries(keys).filter(([k, v]) => v.att >= 6 && k.trim()).map(([key, v]) => ({ key, ...v, rate: v.err / v.att, latency: v.n ? v.ms / v.n : 0, score: v.err / v.att * 320 + (v.n ? v.ms / v.n / 6 : 0) })).sort((a,b) => b.score - a.score).slice(0, limit);
}
export function xpForRun(run) { return Math.min(500, Math.floor(run.chars / 5) + Math.floor(Math.min(run.seconds, 600) / 3) + (run.acc >= 98 && run.chars >= 25 ? 15 : 0)); }
export function comparable(a, b) { return a.mode === b.mode && a.track === b.track && a.duration === b.duration && a.strict === b.strict && a.indent === b.indent; }

// Older exports did not contain attempt counts. Recover their weight where possible.
export function attemptTotals(runs) {
  return runs.reduce((total, run) => {
    const attempts = run.attempts > 0 ? run.attempts : run.errors > 0 && run.acc < 100
      ? run.errors / (1 - run.acc / 100) : run.chars || 0;
    total.attempts += attempts;
    total.correct += attempts * clamp(run.acc, 0, 100) / 100;
    return total;
  }, { attempts: 0, correct: 0 });
}
export function accuracyForRuns(runs) {
  const totals = attemptTotals(runs);
  return totals.attempts ? totals.correct / totals.attempts * 100 : null;
}
export function benchmarkForRuns(runs) {
  const eligible = runs.filter(r => r.completed !== false && r.wpm > 0);
  const tests = eligible.filter(r => r.mode === 'test');
  const standard = tests.filter(r => r.duration === 60 && !r.strict);
  const reference = standard.at(-1) || tests.at(-1) || eligible.filter(r => r.mode === 'practice').at(-1) || eligible.at(-1);
  if (!reference) return { runs: [], best: null, note: 'Finish a practice session or speed test', href: '#test' };
  const matching = eligible.filter(r => comparable(r, reference));
  const kind = reference.mode === 'test' ? `${reference.duration}s test` : reference.mode === 'practice' ? 'Practice' : ({ghost:'Ghost Race',invaders:'Type Invaders',survival:'Type Survival',dungeon:'Typing Dungeon'}[reference.mode] || 'Imported sessions');
  return { runs: matching, best: Math.max(...matching.map(r => r.wpm)), note: `${kind} · ${reference.track === 'legacy' ? 'original drills' : reference.track} · ${reference.strict ? 'accuracy mode' : 'standard mode'}`, href: reference.mode === 'test' ? '#test' : '#practice' };
}
