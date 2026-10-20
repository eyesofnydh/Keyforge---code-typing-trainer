import test from 'node:test';
import assert from 'node:assert/strict';
import { difficultyFor, arcadeWord, WordChallenge } from '../arcade.js';
import { FINGERS, fingerForKey } from '../learn.js';
import { KEY_ROWS } from '../data.js';
import { createStore, validateProfile } from '../storage.js';

test('each word increases falling speed and spawn rate, with explicit tiers',()=>{
  for(let score=0;score<40;score++){
    assert.ok(difficultyFor(score+1).speed>difficultyFor(score).speed);
    assert.ok(difficultyFor(score+1).spawnMs<difficultyFor(score).spawnMs);
  }
  assert.deepEqual([0,5,12,22,35].map(n=>difficultyFor(n).name),['Easy','Normal','Hard','Expert','Extra hard']);
  assert.equal(difficultyFor(500).speed,130);assert.equal(difficultyFor(500).spawnMs,650);
});
test('later levels introduce longer words and punctuation without empty prompts',()=>{
  for(const n of [0,5,12,22,35,99])assert.ok(arcadeWord(n,()=>.5).length>=difficultyFor(n).minLength);
  assert.match(arcadeWord(36,()=>0),/_v2$/);
});
test('survival advances on word completion and times out into a clear loss',()=>{
  const game=new WordChallenge('survival',1000,()=>0);
  let now=1000;const first=game.prompt;
  for(const ch of first)game.type(ch,now+=100);
  assert.equal(game.score,1);assert.equal(game.health,3);assert.equal(game.session.done,false);
  assert.ok(game.windowMs<13000);
  for(let i=0;i<3;i++)game.tick(game.deadline+1);
  assert.equal(game.health,0);assert.equal(game.session.done,true);assert.equal(game.won,false);
  assert.match(game.reason,/heart/);
});
test('survival wrong keys cost hearts once and cannot mutate after game over',()=>{
  const game=new WordChallenge('survival',1000,()=>0);
  game.type('!',1100);game.type('!',1200);game.type('!',1300);
  assert.equal(game.health,0);assert.equal(game.session.errors,3);
  game.type('!',1400);assert.equal(game.health,0);assert.equal(game.session.attempts,3);
});
test('a key arriving after the word deadline does not lose two hearts',()=>{
  const game=new WordChallenge('survival',1000,()=>0);
  game.type('!',game.deadline+1);
  assert.equal(game.health,2);assert.equal(game.session.errors,0);
});
test('dungeon has a sentence boss in each room and a real final victory',()=>{
  const game=new WordChallenge('dungeon',0,()=>0);let now=0,bosses=0;
  for(let i=0;i<16;i++){
    const prompt=game.prompt;if(game.boss){bosses++;assert.match(prompt,/ /);}
    for(const ch of prompt)game.type(ch,now+=50);
  }
  assert.equal(bosses,4);assert.equal(game.score,16);assert.equal(game.session.done,true);assert.equal(game.won,true);assert.equal(game.health,5);
});
test('new games persist in the shared profile and survive import validation',()=>{
  const store=createStore(null);
  for(const mode of ['survival','dungeon']){const game=new WordChallenge(mode,1000,()=>0);game.type(game.prompt[0],1100);store.record(game.session,{mode,id:mode,completed:false,name:mode},1200);}
  assert.equal(store.data.chars,2);assert.deepEqual(validateProfile(store.data).runs.map(r=>r.mode),['survival','dungeon']);
});
test('every physical QWERTY key has one finger and shifted keys use the same finger',()=>{
  for(const row of KEY_ROWS)for(const [base,shifted] of row){assert.equal(FINGERS.filter(f=>f.keys.includes(base)).length,1,base);assert.equal(fingerForKey(base),fingerForKey(shifted));}
  assert.equal(fingerForKey('F').id,'li');assert.equal(fingerForKey('J').id,'ri');assert.equal(fingerForKey(' ').id,'thumb');
  assert.deepEqual(['a','s','d','f','j','k','l',';'].map(k=>fingerForKey(k).home),['A','S','D','F','J','K','L',';']);
});
