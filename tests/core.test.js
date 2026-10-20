import test from 'node:test';
import assert from 'node:assert/strict';
import { TypingSession, ghostPosition, streak, consistency, comparable, accuracyForRuns, benchmarkForRuns } from '../core.js';
import { createStore, validateProfile, emptyProfile } from '../storage.js';
import { makeText } from '../content.js';
import { LANGUAGES } from '../data.js';

test('a corrected mistake still counts against accuracy, without inflating net speed', () => {
  const s = new TypingSession('cat');
  s.type('c', 1000); s.type('x', 2000); s.backspace(2500); s.type('a', 3000); s.type('t', 4000);
  assert.equal(s.done, true); assert.equal(s.metrics(8000).seconds, 3);
  assert.equal(s.metrics(8000).acc, 75); assert.equal(s.correct, 3);
  assert.ok(Math.abs(s.metrics(8000).wpm - 12) < 1e-9); assert.equal(s.keys.a.mistakes.x, 1);
});
test('accuracy mode blocks advancement but records every incorrect attempt', () => {
  const s = new TypingSession('ab', { strict:true });
  s.type('x', 0); s.type('y', 100); assert.equal(s.index,0);
  s.type('a',200); s.type('b',1000);
  assert.equal(s.metrics(1500).acc,50); assert.equal(s.started,0); assert.equal(s.metrics(1500).seconds,1);
});
test('deadline wins over a late input and time freezes at the requested duration', () => {
  const s = new TypingSession('a long passage', { duration:15 });
  s.type('a',1000); s.type(' ',2000); s.type('l',16000);
  assert.equal(s.index,2); assert.equal(s.done,true); assert.equal(s.metrics(999999).seconds,15);
});
test('backspace at the deadline cannot mutate a completed test', () => {
  const s = new TypingSession('long text', { duration:15 });
  s.type('l',1000); s.backspace(16000);
  assert.equal(s.done,true); assert.equal(s.correct,1);
});
test('auto indentation is excluded from scoring and backspace finds the previous typed character', () => {
  const s = new TypingSession('  a\n    b', { indent:true });
  assert.equal(s.index,2); s.type('a',100); s.type('\n',200);
  assert.equal(s.index,8); s.backspace(300); assert.equal(s.index,3);
  s.type('\n',400); s.type('b',500); assert.equal(s.correct,3); assert.equal(s.done,true);
});
test('timed text can be extended without resetting progress', () => {
  const s = new TypingSession('a', { duration:30 }); s.type('a',100); assert.equal(s.done,false);
  s.append(' b'); s.type(' ',200); s.type('b',300); assert.equal(s.correct,3); assert.equal(s.chars.length,3);
});
test('ghost replay follows actual timestamps including corrections', () => {
  const events = [[0,1],[100,2],[200,1],[400,2],[600,3]];
  assert.equal(ghostPosition(events,-1),0); assert.equal(ghostPosition(events,199),2);
  assert.equal(ghostPosition(events,200),1); assert.equal(ghostPosition(events,1000),3);
});
test('consistency needs enough data and responds to uneven intervals', () => {
  assert.equal(consistency([100,100]),null); assert.equal(consistency([100,100,100,100,100]),100);
  assert.ok(consistency([100,800,100,800,100])<60);
});
test('streak handles local calendar days and allows yesterday’s active streak', () => {
  const day = (date) => new Date(2026,9,date,12).getTime();
  assert.equal(streak([{t:day(18)},{t:day(19)},{t:day(19)}], day(20)),2);
  assert.equal(streak([{t:day(18)}],day(20)),0);
});
test('legacy progress is migrated while preserving the old saved copy', () => {
  const legacy={runs:[{t:Date.now(),wpm:42,acc:95,name:'Symbols',chars:50}],keys:{a:{att:10,err:1,ms:1500,n:9,display:'a'}},chars:50};
  const map=new Map([['keyforge.v1',JSON.stringify(legacy)]]);
  const backing={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const store=createStore(backing);store.save();
  assert.equal(store.data.chars,50);assert.equal(store.data.keys.a.att,10);assert.equal(store.data.runs[0].mode,'legacy');
  assert.ok(map.has('keyforge.v1'));assert.ok(map.has('keyforge.v2'));
  const s=new TypingSession('a');s.type('x',100);store.record(s,{mode:'practice'},200);
  assert.equal(store.data.keys.a.mistakes.x,1);
});
test('malformed imports are rejected atomically', () => {
  const store=createStore(null);const original=store.data;
  assert.throws(()=>store.replace({runs:[{t:1,wpm:Infinity,acc:101}],keys:{}}));assert.equal(store.data,original);
  assert.throws(()=>validateProfile({runs:[],keys:null}));
  assert.throws(()=>validateProfile({runs:[],keys:{a:{att:1,err:2,ms:0,n:0}}}));
});
test('invalid ghost positions cannot enter a replay', () => {
  const db=emptyProfile();db.ghosts.classic={text:'abc',wpm:40,events:[[1,99]]};
  assert.equal(validateProfile(db).ghosts.classic,undefined);
});
test('all modes share character and key totals', () => {
  const store=createStore(null);
  for(const mode of ['practice','test','invaders','ghost']){const s=new TypingSession('cat');s.type('c',100);s.type('a',200);s.type('t',300);store.record(s,{mode},300);}
  assert.equal(store.data.chars,12);assert.equal(store.data.keys.c.att,4);assert.equal(store.data.pairs.ca.att,4);
});
test('personal records separate durations and scoring settings', () => {
  const base={mode:'test',track:'words',duration:60,strict:false,indent:false};
  assert.equal(comparable(base,{...base}),true);assert.equal(comparable(base,{...base,duration:15}),false);
  assert.equal(comparable(base,{...base,strict:true}),false);
});
test('normal content and every existing code language remain available', () => {
  for(const track of ['words','sentences','paragraphs','punctuation','numbers','symbols','weak'])assert.ok(makeText(track).text.length>20);
  for(const lang of Object.keys(LANGUAGES)){assert.ok(makeText('code',{lang}).text.includes('\n'));assert.ok(makeText('code',{lang,codeTrack:'keywords'}).text.length>20);}
  assert.equal(makeText('custom',{custom:'  hello\r\nworld\t!  '}).text,'hello\nworld  !');
});
test('a storage quota failure reports session-only mode without losing in-memory progress', () => {
  const store=createStore({getItem:()=>null,setItem:()=>{throw new Error('quota')},removeItem:()=>{}});
  assert.equal(store.persistent,false);
  store.data.chars=123;store.save();assert.equal(store.persistent,false);assert.equal(store.data.chars,123);
});

test('daily accuracy weights key attempts rather than treating tiny and long sessions equally', () => {
  assert.equal(accuracyForRuns([{attempts:10,acc:0},{attempts:90,acc:100}]),90);
  assert.equal(accuracyForRuns([]),null);
  assert.ok(Math.abs(accuracyForRuns([{chars:90,errors:10,acc:90}])-90)<1e-9);
});
test('benchmarks work for practice and non-60-second tests without mixing different settings', () => {
  const practice={mode:'practice',track:'words',duration:0,strict:false,indent:false,wpm:42};
  const test15={...practice,mode:'test',duration:15,wpm:55};
  const test60={...test15,duration:60,wpm:50};
  assert.equal(benchmarkForRuns([practice]).best,42);
  assert.equal(benchmarkForRuns([practice,test15]).best,55);
  assert.equal(benchmarkForRuns([practice,test15,test60]).best,50);
  assert.equal(benchmarkForRuns([{...test15,completed:false}]).best,null);
});
test('checkpoints update a single session without doubling key counts, XP, or characters', () => {
  const store=createStore(null),s=new TypingSession('cat');
  s.type('c',100);s.type('a',200);
  store.record(s,{id:'same',completed:false},200);
  store.record(s,{id:'same',completed:false},300);
  assert.equal(store.data.runs.length,1);assert.equal(store.data.chars,2);assert.equal(store.data.keys.a.att,1);
  s.backspace(400);store.record(s,{id:'same',completed:false},400);assert.equal(store.data.chars,1);
  s.type('a',500);s.type('t',600);store.record(s,{id:'same',completed:true},600);
  assert.equal(store.data.chars,3);assert.equal(store.data.keys.a.att,2);
  assert.equal(store.data.runs.length,1);assert.equal(store.data.runs[0].completed,true);
  assert.equal(store.data.xp,store.data.runs[0].xp);
  assert.equal(validateProfile(store.data).runs[0].completed,true);
});
