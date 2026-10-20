import { SYMBOL_SETS, KEYWORDS, SNIPPETS, LANGUAGES } from './data.js';
import { weakKeys } from './core.js';
export const WORDS = 'the a to of and in is it you that for on with as this be have from at we can will your not all one they about more time when make just people good new like know work take into year day use way our first after even most over also back think only come could now how these want look some then two well see much say find here where thing through still learn small great another before every right long place together little world each write feel next between change help build life number different open around keep start bring read give move story word best better clear water home morning light rhythm practice focus paper line hand steady quiet ready begin simple step mind space grow plan green watch music letter answer travel friend window garden keyboard accuracy point speed flow return provide opportunity properly'.split(' ');
export const SENTENCES = [
  'A little practice each day makes a lasting difference.',
  'The morning light moved slowly across the kitchen table.',
  'Take your time and let accuracy lead the way.',
  'We learn something new every time we try again.',
  'She opened the window and listened to the rain.',
  'Good ideas often begin with a simple question.',
  'The best time to start is the moment you are ready.',
  'Put the notebook beside the lamp before you leave.',
  'A steady rhythm is more useful than a hurried start.',
  'Our small team built something we were proud to share.',
];
export const PASSAGES = [
  { title: 'The slow morning', text: 'The city was still quiet when I stepped outside. A small bakery had just opened its doors, and the smell of fresh bread drifted into the street. I took the long way home, passing the park where the trees were beginning to turn green. Sometimes the best part of a busy day is the moment before it begins.' },
  { title: 'Learning to begin', text: 'You do not need a perfect plan to make a useful start. Choose one small thing, give it your attention, and notice what changes. Progress can be difficult to see from one day to the next, but it becomes clear when you look back. The habit of returning matters more than getting everything right on your first attempt.' },
  { title: 'A useful email', text: 'Hi Alex, thanks for sharing your notes from the meeting. I have added a few suggestions to the project plan. Could you review the timeline before Friday? We can discuss any open questions during our next call. Thanks again for your help, and have a great afternoon!' },
  { title: 'The bookshop', text: 'At the end of the street stood a bookshop with a blue door. Inside, narrow shelves reached almost to the ceiling. The owner always kept a chair near the window for anyone who wanted to read. No one seemed to mind the ticking clock or the rain against the glass. It was a place that made you want to stay a little longer.' },
];
const PUNCTUATION = ['"Are you ready?" she asked. "Yes, let\'s begin!"', 'Bring a notebook, a pencil, and your curiosity.', 'It is simple: practise slowly; build speed later.', 'The package (order #204) arrived on Tuesday.', 'Don\'t rush! A good rhythm takes time, doesn\'t it?'];
export const pick = list => list[Math.floor(Math.random() * list.length)];
export function makeText(track, { length = 'medium', lang = 'javascript', codeTrack = 'snippets', symbolSet = 'mixed', snippet = 0, custom = '', targetKey = '' } = {}, keys = {}) {
  const count = { short: 20, medium: 40, long: 80 }[length] || 40;
  if (track === 'custom') return { text: custom.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').trim().slice(0, 12000), name: 'Your own text' };
  if (track === 'words') return { text: Array.from({ length: count }, () => pick(WORDS)).join(' '), name: 'Everyday words' };
  if (track === 'sentences') {
    const pool = [...SENTENCES];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return { text: pool.slice(0, Math.max(2, Math.round(count / 10))).join(' '), name: 'Everyday sentences' };
  }
  if (track === 'paragraphs') { const p = pick(PASSAGES); return { text: p.text, name: p.title }; }
  if (track === 'punctuation') return { text: Array.from({ length: Math.max(2, Math.round(count / 10)) }, () => pick(PUNCTUATION)).join(' '), name: 'Punctuation & capitals' };
  if (track === 'numbers') return { text: Array.from({ length: count }, () => pick([String(Math.floor(Math.random()*9999)), `${Math.floor(Math.random()*24)}:${pick(['00','15','30','45'])}`, `${Math.floor(Math.random()*999)}.${Math.floor(Math.random()*100).toString().padStart(2,'0')}`])).join(' '), name: 'Numbers & data' };
  if (track === 'symbols') { const set = SYMBOL_SETS[symbolSet] || SYMBOL_SETS.mixed; return { text: Array.from({ length: count }, () => pick(set.groups)).join(' '), name: set.label }; }
  if (track === 'weak') {
    const targets = targetKey ? [targetKey] : weakKeys(keys, 4).map(k => k.key);
    if (!targets.length) return { text: Array.from({ length: count }, () => pick(WORDS)).join(' '), name: 'Weak keys · building your baseline' };
    const pool = WORDS.filter(w => targets.some(k => w.includes(k)));
    return { text: Array.from({ length: count }, () => pick(pool.length ? pool : targets)).join(' '), name: `Targeted practice · ${targets.join(' / ')}` };
  }
  if (track === 'code') {
    if (codeTrack === 'keywords') return { text: Array.from({ length: count }, () => pick(KEYWORDS[lang])).join(' '), name: `${LANGUAGES[lang].label} · keywords` };
    const s = SNIPPETS[lang][snippet] || SNIPPETS[lang][0]; return { text: s.code.replace(/\t/g, '  '), name: `${LANGUAGES[lang].label} · ${s.title}` };
  }
  return { text: pick(PASSAGES).text, name: 'Everyday English' };
}
