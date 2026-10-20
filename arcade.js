import { TypingSession, clamp } from './core.js';
import { WORDS } from './content.js';

export const GAME_MODES = ['invaders', 'ghost', 'survival', 'dungeon'];
const LONG_WORDS = ['keyboard', 'precision', 'environment', 'development', 'opportunity', 'concentration', 'misunderstanding', 'extraordinary', 'determination'];
const TIERS = [[0,'Easy'],[5,'Normal'],[12,'Hard'],[22,'Expert'],[35,'Extra hard']];
export function difficultyFor(score) {
  const tier = TIERS.filter(([at]) => score >= at).length - 1;
  return { level:score+1, tier, name:TIERS[tier][1], speed:Math.min(130,22+score*1.8),
    spawnMs:Math.max(650,3000/(1+score*.055)), minLength:[3,3,4,5,7][tier],
    maxLength:[5,7,10,14,20][tier], nextAt:TIERS[tier+1]?.[0] ?? null };
}
export function arcadeWord(score, random = Math.random) {
  const difficulty = difficultyFor(score);
  const pool = [...WORDS,...LONG_WORDS].filter(w => w.length >= difficulty.minLength && w.length <= difficulty.maxLength);
  let word = pool[Math.floor(random()*pool.length)];
  if(difficulty.tier>=3&&score%3===0) word += difficulty.tier>=4?'_v2':'!';
  return word;
}

const BOSSES = ['Stay calm and find your rhythm.', 'Accuracy comes before speed.', 'Small steps build lasting progress.', 'Type with confidence, one key at a time.'];
// One shared scoring session spans every word, timeout, and room in the run.
export class WordChallenge {
  constructor(mode, now, random = Math.random) {
    this.mode=mode;this.random=random;this.score=0;this.health=mode==='dungeon'?5:3;
    this.session=new TypingSession('',{strict:true,duration:mode==='dungeon'?180:120});
    this.session.started=now;this.round=0;this.start=0;this.end=0;this.reason='';this.won=false;
    this.next(now);
  }
  next(now) {
    this.start=this.session.chars.length;
    this.boss=this.mode==='dungeon'&&this.score%4===3;
    this.prompt=this.boss?BOSSES[Math.floor(this.score/4)%BOSSES.length]:arcadeWord(this.score,this.random);
    this.session.append(this.prompt+' ');this.end=this.session.chars.length;
    const base=this.mode==='dungeon'?18000:13000;
    this.windowMs=Math.max(this.boss?14000:2600,base-this.score*250)+(this.boss?this.prompt.length*140:0);
    this.deadline=now+this.windowMs;
    this.round++;
  }
  endRun(now, reason, won=false) { if(this.session.done)return;this.reason=reason;this.won=won;this.session.finish(now); }
  tick(now) {
    if(this.session.done)return;
    if(this.session.expired(now)){this.endRun(now,this.mode==='survival'?'You survived the full two minutes!':'The dungeon timer ran out.',this.mode==='survival');return;}
    if(now>=this.deadline){
      this.health--;
      while(this.session.index<this.end)this.session.status[this.session.index++]=3;
      if(this.health<=0)this.endRun(now,'The last heart is gone. Take a breath and try again.');
      else this.next(now);
    }
  }
  type(ch, now) {
    const round=this.round;
    this.tick(now);if(this.session.done||this.round!==round)return false;
    const wasDone=this.session.done;
    const ok=this.session.type(ch,now);
    if(!ok){this.health--;if(this.health<=0)this.endRun(now,'The last heart is gone. Take a breath and try again.');}
    if(ok&&this.session.index>=this.end-1){
      this.session.status[this.session.index++]=3;this.score++;
      if(this.mode==='dungeon'&&this.score>=16)this.endRun(now,'All four rooms cleared. The dungeon is yours!',true);
      else this.next(now);
    }
    return ok&&!wasDone;
  }
  backspace(now) { if(!this.session.done&&this.session.index>this.start)this.session.backspace(now); }
}

const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

export function closeGameDialog() { document.getElementById('gameOverDialog')?.remove(); }
export function showGameDialog({won=false,title=won?'Challenge complete!':'Game over',reason,score=0,scoreLabel='words cleared',level='Easy',onRestart}) {
  closeGameDialog();
  const dialog=document.createElement('dialog');dialog.id='gameOverDialog';dialog.className='game-over-dialog '+(won?'game-won':'game-lost');
  dialog.setAttribute('aria-labelledby','gameOverTitle');dialog.setAttribute('aria-describedby','gameOverReason');
  dialog.innerHTML=`<div class="outcome-symbol" aria-hidden="true"><i></i><b>${won?'✦':'×'}</b><i></i></div><div class="eyebrow">${won?'A NEW SMALL WIN':'TIME FOR ANOTHER TRY'}</div><h2 id="gameOverTitle">${escapeHTML(title)}</h2><p id="gameOverReason">${escapeHTML(reason)}</p><div class="outcome-summary"><span><strong>${score}</strong> ${escapeHTML(scoreLabel)}</span><span>${escapeHTML(level)}</span></div><div class="button-row"><button class="button" id="restartGame">Restart game ↻</button><button class="button secondary" id="viewGameResults">View results</button><a class="text-link" href="#games">Back to arcade →</a></div>`;
  document.body.append(dialog);
  dialog.querySelector('#restartGame').addEventListener('click',()=>{closeGameDialog();onRestart();});
  dialog.querySelector('#viewGameResults').addEventListener('click',()=>{closeGameDialog();document.getElementById('results')?.scrollIntoView({block:'nearest'});});
  dialog.querySelector('a').addEventListener('click',closeGameDialog);
  dialog.addEventListener('cancel',()=>{setTimeout(()=>dialog.remove(),0);});
  dialog.showModal();
}

export function renderWordGame(host, mode, {onStart,onEnd,onRestart,announce}) {
  const dungeon=mode==='dungeon',title=dungeon?'Typing Dungeon':'Type Survival';
  let model=null,roundShown=0,ended=false;
  host.innerHTML=`<div class="page-heading"><div><div class="eyebrow">${dungeon?'FOUR ROOMS · FIVE HEARTS':'TWO MINUTES · THREE HEARTS'}</div><h1>${title}.</h1><p>${dungeon?'Clear three word enemies, then a sentence boss in each room.':'Clear each word before its fuse runs out. Every word raises the challenge.'}</p></div><a href="#games" class="button secondary">← Arcade</a></div><section class="typing-panel"><div class="typing-top"><span id="challengeLevel">Level 1 · Easy</span><div class="live-metrics"><span><b id="challengeScore">0</b> cleared</span><span><b id="challengeHealth">${dungeon?5:3}</b> hearts</span><span><b id="challengeTime">${dungeon?180:120}</b>s</span></div></div><div class="challenge-scene ${dungeon?'dungeon-scene':'survival-scene'}"><div class="dungeon-rooms" ${dungeon?'':'hidden'}>${[1,2,3,4].map(n=>`<span data-room="${n}">Room ${n}</span>`).join('')}</div><div class="challenge-creature" aria-hidden="true">${dungeon?'♜':'◷'}</div><span id="challengeRole" class="eyebrow">${dungeon?'ENTER THE DUNGEON':'KEEP THE FUSE ALIVE'}</span><div id="challengePrompt" class="challenge-prompt">${dungeon?'Your first room awaits.':'Ready for the next word?'}</div><div class="challenge-fuse" role="progressbar" aria-label="Time left for this word" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="challengeFuse"></i></div><p id="challengeHint">${dungeon?'Word enemies clear automatically. Boss sentences include spaces and punctuation.':'Wrong characters and expired words cost a heart. Spaces between words are optional.'}</p><button class="button" id="startChallenge">${dungeon?'Enter dungeon':'Start surviving'} ↗</button><div id="challengeFeedback" role="status"></div></div><div class="invader-input-row"><label class="sr-only" for="challengeInput">Type the current challenge</label><input id="challengeInput" placeholder="Start the game to begin…" spellcheck="false" autocapitalize="off" autocomplete="off" disabled><button class="button secondary" id="challengeRestart">Restart</button></div></section><div id="results"></div>`;
  const input=host.querySelector('#challengeInput'),prompt=host.querySelector('#challengePrompt');
  function paint(now) {
    if(!model)return;
    const difficulty=difficultyFor(model.score),progress=clamp(model.session.index-model.start,0,model.prompt.length);
    prompt.innerHTML=`<b>${escapeHTML(model.prompt.slice(0,progress))}</b>${escapeHTML(model.prompt.slice(progress))}`;
    input.value=model.prompt.slice(0,progress);input.placeholder=model.boss?'Type the whole sentence…':`Type: ${model.prompt}`;
    input.setAttribute('aria-label',`Type ${model.prompt}`);
    host.querySelector('#challengeLevel').textContent=`Level ${difficulty.level} · ${difficulty.name}`;
    host.querySelector('#challengeScore').textContent=model.score;host.querySelector('#challengeHealth').textContent=Math.max(0,model.health);
    host.querySelector('#challengeTime').textContent=Math.max(0,Math.ceil(model.session.duration-model.session.elapsed(now)));
    const remaining=clamp((model.deadline-now)/model.windowMs*100,0,100);
    host.querySelector('#challengeFuse').style.width=remaining+'%';host.querySelector('.challenge-fuse').setAttribute('aria-valuenow',Math.round(remaining));
    if(roundShown!==model.round){
      roundShown=model.round;
      host.querySelector('#challengeRole').textContent=dungeon?`Room ${Math.min(4,Math.floor(model.score/4)+1)} · ${model.boss?'Sentence boss':'Word enemy'}`:'Beat the fuse';
      host.querySelectorAll('[data-room]').forEach(el=>{const n=Number(el.dataset.room);el.classList.toggle('cleared',model.score>=n*4);el.classList.toggle('active',n===Math.min(4,Math.floor(model.score/4)+1));});
      const feedback=host.querySelector('#challengeFeedback');feedback.textContent=`Level ${difficulty.level} · ${difficulty.name}`;
      prompt.classList.remove('prompt-enter');void prompt.offsetWidth;prompt.classList.add('prompt-enter');
    }
  }
  function finish() {
    if(ended||!model?.session.done)return;ended=true;input.disabled=true;paint(performance.now());
    onEnd({won:model.won,reason:model.reason,score:model.score,level:difficultyFor(model.score).name});
  }
  function type(text) {
    if(!model||model.session.done)return;
    for(const ch of [...text]){if(/\s/.test(ch)&&!model.boss)continue;const oldHealth=model.health;model.type(ch,performance.now());if(model.health<oldHealth){input.classList.add('bad');}else input.classList.remove('bad');if(model.session.done)break;}
    paint(performance.now());finish();
  }
  function start(){if(model)return;host.querySelector('#startChallenge')?.remove();model=new WordChallenge(mode,performance.now());onStart(model.session);input.disabled=false;input.focus();paint(performance.now());announce(`${title} started. Type the displayed word.`);}
  host.querySelector('#startChallenge').addEventListener('click',start);
  host.querySelector('#challengeRestart').addEventListener('click',onRestart);
  input.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;if(e.key==='Backspace'){e.preventDefault();model.backspace(performance.now());paint(performance.now());}else if(e.key.length===1){e.preventDefault();type(e.key);}else if(e.key==='Enter'){e.preventDefault();}});
  input.addEventListener('input',e=>{if(e.isComposing||!model)return;if(e.inputType==='deleteContentBackward'){model.backspace(performance.now());paint(performance.now());}else if(!['insertFromPaste','insertFromDrop'].includes(e.inputType))type(e.data||'');});
  input.addEventListener('paste',e=>e.preventDefault());input.addEventListener('drop',e=>e.preventDefault());
  return { tick(now){if(!model||ended)return;model.tick(now);paint(now);finish();}, type, start,
    get started(){return Boolean(model);}, destroy(){ended=true;} };
}
