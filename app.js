import { LANGUAGES, SYMBOL_SETS, SNIPPETS, KEY_ROWS, KEY_FOR_CHAR } from './data.js';
import { TypingSession, average, clamp, ghostPosition, localDay, streak, weakKeys, comparable, accuracyForRuns, benchmarkForRuns } from './core.js';
import { makeText, pick, WORDS, PASSAGES } from './content.js';
import { createStore } from './storage.js';
import { difficultyFor, arcadeWord, GAME_MODES, renderWordGame, showGameDialog, closeGameDialog } from './arcade.js';
import { renderHandGuide } from './learn.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
const fmt = (value, decimals = 0) => Number.isFinite(value) ? value.toFixed(decimals) : '—';
const labelKey = key => key === ' ' ? 'Space' : key === '\n' ? 'Enter' : key.toUpperCase();
const date = value => new Date(value).toLocaleDateString(undefined, { month:'short', day:'numeric' });
const notify = text => { $('announcer').textContent = text; };
let backing = null;
try { backing = window.localStorage; } catch {}
const store = createStore(backing);
let route = 'home', params = new URLSearchParams(), frame = null, session = null, current = null, saved = false;
let ghost = null, painted = -1, spans = [], invaders = null, challenge = null;
const options = { track:'words', length:'medium', lang:'javascript', codeTrack:'snippets', snippet:0, symbolSet:'mixed', duration:60, strict:false, keyboard:true, indent:true, focus:false, custom:'', targetKey:'' };
const titles = { home:'Overview', practice:'Practice', test:'Speed test', games:'Arcade', learn:'Hand placement', stats:'Skill map', profile:'Your profile' };
const levelName = xp => xp >= 10000 ? 'Velocity' : xp >= 4000 ? 'Key Runner' : xp >= 1500 ? 'Flow Typist' : 'Key Scout';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'paper' ? '#f6f5ef' : '#101312';
  $('themeToggle').setAttribute('aria-label', theme === 'paper' ? 'Switch to dark theme' : 'Switch to light theme');
}
function updateChrome() {
  const db = store.data;
  $('sidebarLevel').textContent = `Level ${Math.floor(db.xp / 250) + 1} · ${levelName(db.xp)}`;
  const days = streak(db.runs);
  $('streakBadge').textContent = `${days} day streak`;
  $('storageStatus').textContent = store.persistent ? 'Progress saved on this device' : 'Session only · export to keep your progress';
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === route) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  $('breadcrumb').innerHTML = `Workspace <span>/</span> ${titles[route]}`;
  document.title = `${titles[route]} · TypePoise`;
}
function heading(eyebrow, title, subtitle, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function metric(label, value, unit = '', note = '', good = false) {
  return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${value}${unit ? `<small>${unit}</small>` : ''}</div><div class="metric-note${good?' good':''}">${note || '&nbsp;'}</div></div>`;
}
function card(href, icon, title, description, foot) {
  return `<a class="mode-card" href="${href}"><span class="mode-icon" aria-hidden="true">${icon}</span><h3>${title}</h3><p>${description}</p><div class="card-bottom"><span>${foot}</span><span aria-hidden="true">↗</span></div></a>`;
}
function recommendation() {
  const weak = weakKeys(store.data.keys, 3);
  return `<div class="recommendation"><div class="eyebrow">YOUR NEXT SMALL WIN</div><h2>${weak.length ? 'Turn a weak spot into a strength.' : 'Let’s find your starting point.'}</h2><p>${weak.length ? 'These keys take a little more effort. Give them a focused practice session.' : 'Finish a few sessions to discover your problem keys and get a targeted drill.'}</p>${weak.length ? `<div class="key-pills">${weak.map(k=>`<span class="key-pill">${esc(labelKey(k.key))}</span>`).join('')}</div>`:''}<div><a href="#practice?track=${weak.length?'weak':'words'}" class="button secondary">${weak.length?'Train weak keys':'Start practising'} <span aria-hidden="true">↗</span></a></div></div>`;
}
function chart(runs, title = '60-second tests') {
  if (runs.length < 2) return `<div class="empty">Your progress starts with a session.<br>Finish two ${esc(title.toLowerCase())} to see your trend here.</div>`;
  const width=650, height=145, padding=28;
  const max=Math.max(10,...runs.map(r=>r.wpm))*1.15;
  const x=i=>padding+i/(runs.length-1)*(width-padding-12), y=v=>height-22-v/max*(height-38);
  const path=runs.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(r.wpm).toFixed(1)}`).join(' ');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}: ${runs.map(r=>fmt(r.wpm)+' WPM').join(', ')}"><text x="0" y="18" fill="var(--faint)" font-size="10">${fmt(max)}</text><text x="8" y="${height-20}" fill="var(--faint)" font-size="10">0</text><line x1="${padding}" y1="${height-22}" x2="${width}" y2="${height-22}" stroke="var(--border)"/><path d="${path}" stroke="var(--accent)" fill="none" stroke-width="2" stroke-linejoin="round"/>${runs.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.wpm)}" r="3" fill="var(--accent)"><title>${esc(date(r.t))} · ${fmt(r.wpm,1)} WPM · ${fmt(r.acc,1)}% accuracy</title></circle>`).join('')}</svg></div><div class="chart-caption"><span>${date(runs[0].t)} · earlier</span><span>WPM / completed sessions</span><span>${date(runs.at(-1).t)} · latest</span></div>`;
}
function renderHome() {
  const db=store.data, today=db.runs.filter(r=>localDay(r.t)===localDay()), benchmark=benchmarkForRuns(db.runs), tests=benchmark.runs;
  const total=today.reduce((n,r)=>n+r.chars,0), accuracy=accuracyForRuns(today);
  $('main').innerHTML=heading('MAKE ROOM FOR A LITTLE PROGRESS', 'Find your flow.', 'A space to practise, play, and become a better typist.', `<span class="date-label">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span>`)+
    `<section class="hero"><div class="hero-content"><div class="eyebrow">SMALL SESSIONS. REAL PROGRESS.</div><h2>Your next personal best<br>starts here.</h2><p>Everyday words, real code, or a race against yourself. Make every keystroke count.</p><div class="button-row"><a class="button" href="#practice">Start practising <span aria-hidden="true">↗</span></a><a class="text-link" href="#test">Take a speed test →</a></div></div><div class="hero-art" aria-hidden="true"><div class="key-art">${['Q','W','E','A','S','D','Z','X','C'].map(k=>`<span>${k}</span>`).join('')}</div></div></section>`+
    `<div class="section-heading"><h2>A little better, every day</h2><span>Your numbers. No guesswork.</span></div><div class="metric-grid">${metric('Personal benchmark',benchmark.best===null?'—':fmt(benchmark.best),'WPM',`${esc(benchmark.note)}${benchmark.best===null?' <a class="text-link" href="#test">Start a test →</a>':''}`,true)}${metric('Today’s accuracy',accuracy===null?'—':fmt(accuracy,1),'%',today.length?`${today.length} saved session${today.length===1?'':'s'} · weighted by key attempts`:'Type in any mode to start tracking')}${metric('Keys typed today',total.toLocaleString(),'','Correct characters · all modes')}${metric('Practice streak',streak(db.runs),'days',streak(db.runs)?'Keep showing up for yourself':'One session starts a habit',true)}</div>`+
    `<div class="section-heading"><h2>Choose your rhythm</h2><a class="text-link" href="#practice">All practice modes →</a></div><div class="mode-grid">${card('#practice','Aa','Everyday practice','Build confidence with words, sentences, and real passages.','AT YOUR OWN PACE')}${card('#test','◷','Against the clock','Find your baseline in a 15, 30, 60, or 120-second test.','YOUR NEXT BENCHMARK')}${card('#games','↗','A little friendly rivalry','Clear falling words or race a replay of your personal best.','PRACTICE MEETS PLAY')}</div>`+
    `<div class="lower-grid"><section class="panel"><div class="section-heading"><h2>Your progress, in motion</h2><span>${esc(benchmark.best===null?'Finish a session to set a benchmark':benchmark.note)}</span></div>${chart(tests.slice(-10),'matching completed sessions')}</section><section class="panel">${recommendation()}</section></div>`;
}

const trackNames={words:'Words',sentences:'Sentences',paragraphs:'Paragraphs',punctuation:'Punctuation',numbers:'Numbers',symbols:'Symbols',code:'Code',weak:'Weak keys',custom:'Custom'};
function chips(items, value, group) { return `<div class="chip-group" role="group" aria-label="${group}">${items.map(([v,l])=>`<button class="chip" data-group="${group}" data-value="${v}" aria-pressed="${String(v)===String(value)}">${l}</button>`).join('')}</div>`; }
function selectField(id,label,items,value) { return `<label class="field">${label}<select id="${id}">${items.map(([v,l])=>`<option value="${v}"${String(value)===String(v)?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`; }
function renderPractice(mode = 'practice', repeat = null) {
  const isTest=mode==='test', isGhost=mode==='ghost';
  if (isGhost) { options.track='paragraphs'; options.strict=false; }
  const track=isTest?(['words','sentences','numbers','punctuation'].includes(options.track)?options.track:'words'):options.track;
  if (isTest) options.track=track;
  const code=track==='code', duration=isTest?options.duration:0;
  $('main').innerHTML=heading(isGhost?'YOU VS. YESTERDAY’S YOU':isTest?'SET YOUR NEXT BENCHMARK':'GET INTO YOUR RHYTHM',isGhost?'Race your ghost.':isTest?'Make every second count.':'A little practice goes a long way.',isGhost?'Same passage. Your best replay. A new chance to improve.':isTest?'The clock starts on your first keystroke. Accuracy counts.':'Choose your text, settle in, and find a steady pace.')+
    (isGhost?`<div class="notice">${store.data.ghosts['classic']?'Your ghost replays your fastest completed race, including corrections.':'Your first race sets the ghost. Finish it, then race your own replay.'}</div>`:
    `<div class="setup-bar">${chips(Object.entries(trackNames).filter(([k])=>!isTest||['words','sentences','numbers','punctuation'].includes(k)),track,'track')}${isTest?chips([[15,'15s'],[30,'30s'],[60,'60s'],[120,'120s'],['custom','Custom']], [15,30,60,120].includes(duration)?duration:'custom','duration'):''}</div>`)+
    `<div class="settings-row">${isTest?`<label class="field">Duration (10–600 seconds)<input id="durationInput" type="number" min="10" max="600" step="1" value="${duration}"></label>`:''}${!isGhost&&!isTest?selectField('lengthInput','Session length',[['short','Short · 20 words'],['medium','Medium · 40 words'],['long','Long · 80 words']],options.length):''}${code?selectField('langInput','Language',Object.entries(LANGUAGES).map(([k,v])=>[k,v.label]),options.lang)+selectField('codeTrackInput','Code practice',[['snippets','Real code'],['keywords','Keywords']],options.codeTrack)+(options.codeTrack==='snippets'?selectField('snippetInput','Snippet',SNIPPETS[options.lang].map((s,i)=>[i,s.title]),options.snippet):''):''}${track==='symbols'?selectField('symbolInput','Symbol set',Object.entries(SYMBOL_SETS).map(([k,v])=>[k,v.label]),options.symbolSet):''}${!isGhost?`<label class="check"><input id="strictInput" type="checkbox" ${options.strict?'checked':''}> Accuracy mode · block on error</label>`:''}${code?`<label class="check"><input id="indentInput" type="checkbox" ${options.indent?'checked':''}> Auto-indent</label>`:''}<label class="check"><input id="keyboardInput" type="checkbox" ${options.keyboard?'checked':''}> Keyboard hints</label><button class="button subtle push-right" id="focusBtn">Enter focus view</button></div>`+
    (track==='custom'?`<label class="custom-field">Paste your own text or code <span>(up to 12,000 characters)</span><textarea id="customInput" maxlength="12000" rows="3" placeholder="An email, article, paragraph, or code you want to practise…">${esc(options.custom)}</textarea><button class="button secondary" id="applyCustom">Use this text</button></label>`:'')+
    (track==='weak'&&!weakKeys(store.data.keys).length?'<div class="notice">Build a baseline first. Your practice becomes targeted after at least six attempts on a key.</div>':'')+
    `<section class="typing-panel" id="typingPanel" aria-label="Typing session"><div class="typing-top"><span><span class="session-dot"></span><span id="drillName"></span></span><div class="live-metrics"><span><b id="liveWpm">0</b> wpm</span><span><b id="liveAcc">100</b>%</span><span><b id="liveTime">${duration||'0'}</b>${duration?'s left':'s'}</span></div></div>${isGhost?'<div class="race-lanes"><div><div class="race-label"><span>You</span><span id="raceYouLabel">0%</span></div><div class="race-track"><i id="raceYou"></i></div></div><div><div class="race-label"><span>Your ghost</span><span id="raceGhostLabel">Set your first replay</span></div><div class="race-track ghost"><i id="raceGhost"></i></div></div></div>':''}<div class="typing-wrap"><div id="passage" class="passage" aria-hidden="true"></div><textarea id="typingInput" class="typing-input" aria-label="Typing area" aria-describedby="typingHelp" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off"></textarea><div class="focus-prompt" aria-hidden="true">Click here or use Tab to start <kbd>↵</kbd></div></div><div class="run-progress" aria-hidden="true"><i id="runProgress"></i></div><div class="typing-bottom"><span id="typingHelp">${code?'Type the code shown. Press Enter for ↵.':isGhost?'Complete the passage. Your replay is saved when you finish.':'Type the text above. Backspace to correct. The clock starts when you do.'}</span><div class="button-row"><button class="text-link" id="restartBtn">Restart <kbd>Esc</kbd></button><button class="button secondary" id="newBtn">${isGhost?'Reset race':'New text'} ↻</button><button class="button secondary" id="exitFocus" hidden>Exit focus</button></div></div></section><div id="keyboard" class="keyboard" aria-hidden="true" ${options.keyboard?'':'hidden'}></div><p class="practice-note">No rush. Accuracy first. Speed follows.</p><div id="results"></div>`;
  const d=repeat|| (isGhost ? { text:store.data.ghosts.classic?.text || PASSAGES[1].text,name:'Ghost Race · Learning to begin' } : makeText(track,options,store.data.keys));
  if (!d.text) { d.text='Paste your own text above, then choose Use this text.'; d.placeholder=true; }
  current={...d,mode,track,duration,strict:options.strict,indent:code&&options.indent,id:crypto.randomUUID()};
  session=new TypingSession(d.text,{strict:options.strict,indent:current.indent,duration});
  if (duration) while (session.chars.length<1500) session.append(' '+makeText(track,options).text);
  ghost=isGhost?store.data.ghosts.classic:null; saved=false; painted=-1;
  $('drillName').textContent=d.name;
  $('typingInput').setAttribute('aria-label',`Type this passage: ${session.chars.join('')}`);
  $('typingInput').disabled=Boolean(d.placeholder);
  paintPassage(true); buildKeyboard($('keyboard'));
  bindTyping(); bindSetup(mode); paintRun();
  if (options.focus) setFocus(true);
}
function bindSetup(mode) {
  document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{
    if (b.dataset.group==='track') { options.track=b.dataset.value;options.targetKey=''; }
    else if (b.dataset.value==='custom') { $('durationInput').focus(); $('durationInput').select(); return; }
    else options.duration=Number(b.dataset.value);
    stopRun();renderPractice(mode);
  }));
  const bindings={lengthInput:'length',langInput:'lang',codeTrackInput:'codeTrack',snippetInput:'snippet',symbolInput:'symbolSet',strictInput:'strict',indentInput:'indent'};
  for (const [id,prop] of Object.entries(bindings)) $(id)?.addEventListener('change',e=>{ options[prop]=e.target.type==='checkbox'?e.target.checked:prop==='snippet'?Number(e.target.value):e.target.value;if(id==='langInput') options.snippet=0;stopRun();renderPractice(mode); });
  $('durationInput')?.addEventListener('change',e=>{const n=Number(e.target.value);if(!Number.isInteger(n)||n<10||n>600){e.target.setCustomValidity('Choose a whole number from 10 to 600.');e.target.reportValidity();return;}e.target.setCustomValidity('');options.duration=n;stopRun();renderPractice(mode);});
  $('keyboardInput').addEventListener('change',e=>{options.keyboard=e.target.checked;$('keyboard').hidden=!options.keyboard;});
  $('focusBtn').addEventListener('click',()=>setFocus(true));$('exitFocus').addEventListener('click',()=>setFocus(false));
  $('restartBtn').addEventListener('click',()=>restartCurrent(true));$('newBtn').addEventListener('click',()=>restartCurrent(false));
  const finish=document.createElement('button');finish.className='button secondary';finish.id='finishBtn';finish.textContent='Finish & save';finish.disabled=true;
  $('newBtn').before(finish);finish.addEventListener('click',()=>finishRun(false));
  $('customInput')?.addEventListener('input',e=>options.custom=e.target.value);
  $('applyCustom')?.addEventListener('click',()=>{if(!options.custom.trim()){notify('Paste some text first.');$('customInput').focus();return;}stopRun();renderPractice(mode);$('typingInput').focus();});
}
function setFocus(active) {options.focus=active;document.body.classList.toggle('focus-mode',active);if($('exitFocus'))$('exitFocus').hidden=!active;if(active)$('typingInput')?.focus();}
function restartCurrent(repeat) {const meta=repeat?{text:current.text,name:current.name,placeholder:current.placeholder}:null;const mode=current.mode;stopRun();renderPractice(mode,meta);$('typingInput')?.focus();}
function consume(text) {
  if (!session||session.done||current.placeholder) return;
  for (const ch of [...text]) {
    if (session.duration&&session.chars.length-session.index<150) {session.append(' '+makeText(current.track,options).text);paintPassage(true);}
    session.type(ch,performance.now());if(session.done)break;
  }
  ensureTick();paintPassage();paintRun();if(session.done)finishRun();
}
function bindTyping() {
  const input=$('typingInput');let composing=false,compositionEnd=0;
  input.addEventListener('paste',e=>{e.preventDefault();notify('Pasting is available in Custom text. Type the passage to record a session.');});
  input.addEventListener('drop',e=>e.preventDefault());
  input.addEventListener('compositionstart',()=>composing=true);
  input.addEventListener('compositionend',e=>{composing=false;compositionEnd=performance.now();consume(e.data);input.value='';});
  input.addEventListener('input',e=>{if(composing||e.isComposing)return;if(e.inputType==='insertFromPaste'||e.inputType==='insertFromDrop'){input.value='';return;}if(e.inputType?.includes('Composition')&&performance.now()-compositionEnd<100){input.value='';return;}if(e.inputType==='deleteContentBackward'){session.backspace(performance.now());paintPassage();paintRun();}else consume(e.data??input.value);input.value='';});
  input.addEventListener('keydown',e=>{
    if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Escape'){e.preventDefault();if(options.focus)setFocus(false);else restartCurrent(true);}
    if(e.key==='Backspace'){e.preventDefault();session.backspace(performance.now());paintPassage();paintRun();if(session.done)finishRun();}
    if(e.key==='Enter'){e.preventDefault();consume('\n');}
    if(e.key.length===1&&!composing){e.preventDefault();consume(e.key);}
  });
}
function paintPassage(force=false) {
  if(!session||!$('passage'))return;
  if(force||spans.length!==session.chars.length){const fragment=document.createDocumentFragment();spans=session.chars.map(ch=>{const el=document.createElement('span');el.textContent=ch==='\n'?'↵\n':ch;fragment.append(el);return el;});$('passage').replaceChildren(fragment);painted=-1;}
  const start=painted<0?0:Math.max(0,Math.min(painted,session.index)-2),end=painted<0?spans.length:Math.min(spans.length,Math.max(painted,session.index)+3);
  for(let i=start;i<end;i++)spans[i].className= i===session.index?'current'+(session.strict&&session.lastWrong?' current-wrong':''):session.status[i]===1?'correct':session.status[i]===2?'wrong':session.status[i]===3?'auto':'';
  const cursor=spans[session.index];
  if(cursor&&painted!==session.index){const host=$('passage');const y=cursor.offsetTop-host.offsetTop;if(y<host.scrollTop||y>host.scrollTop+host.clientHeight-55)host.scrollTop=Math.max(0,y-75);}
  painted=session.index;
  const target=KEY_FOR_CHAR.get(session.chars[session.index])||session.chars[session.index];
  $('keyboard')?.querySelectorAll('[data-key]').forEach(k=>k.classList.toggle('next',k.dataset.key===target));
}
function paintRun() {
  if(!session||!$('liveWpm'))return;
  const now=performance.now(),m=session.metrics(now);
  $('liveWpm').textContent=fmt(m.wpm);$('liveAcc').textContent=fmt(m.acc);
  if($('finishBtn'))$('finishBtn').disabled=session.attempts===0||session.done;
  $('liveTime').textContent=session.duration?Math.max(0,Math.ceil(session.duration-m.seconds)):fmt(m.seconds);
  $('runProgress').style.width=`${clamp(session.duration?m.seconds/session.duration*100:session.index/session.chars.length*100,0,100)}%`;
  if(current.mode==='ghost'){
    const you=session.index/session.chars.length*100,other=ghost?ghostPosition(ghost.events,m.seconds*1000)/session.chars.length*100:0;
    $('raceYou').style.width=you+'%';$('raceYouLabel').textContent=fmt(you)+'%';$('raceGhost').style.width=other+'%';
    $('raceGhostLabel').textContent=ghost?fmt(other)+'% · '+fmt(ghost.wpm)+' WPM best':'First race · setting your ghost';
  }
}
function sessionMeta(completed) {return {name:current.name,mode:current.mode,track:current.track,duration:current.duration,strict:current.strict,indent:current.indent,id:current.id,completed};}
function checkpoint() {
  if(!session||saved||session.attempts===0||current?.placeholder)return;
  store.record(session,sessionMeta(false),performance.now());session.checkpointAt=performance.now();updateChrome();
}
function ensureTick(){if(frame!==null)return;function tick(){frame=null;if(!session||session.done)return;if(challenge){challenge.tick(performance.now());}else if(invaders){tickInvaders(performance.now());}else{if(session.expired(performance.now()))session.finish(performance.now());paintRun();if(session.done)finishRun();}if(session&&!session.done){if(performance.now()-(session.checkpointAt||0)>5000)checkpoint();frame=requestAnimationFrame(tick);}}frame=requestAnimationFrame(tick);}
function stopRun(){checkpoint();if(frame!==null)cancelAnimationFrame(frame);frame=null;closeGameDialog();challenge?.destroy();challenge=null;if(invaders)invaders=null;session=null;spans=[];saved=false;}
function finishRun(completed = true) {
  if(saved||!session||session.started===null||session.attempts===0)return;
  saved=true;if(frame!==null)cancelAnimationFrame(frame);frame=null;
  session.finish(performance.now());const old=store.data.runs.filter(r=>r.completed!==false&&r.id!==current.id&&comparable(r,current));const best=old.length?Math.max(...old.map(r=>r.wpm)):null;
  const run=store.record(session,sessionMeta(completed),performance.now());
  let ghostNote='';
  if(current.mode==='ghost'&&completed){
    const oldGhost=store.data.ghosts.classic;
    if(!oldGhost||!oldGhost.events.length||run.seconds*1000<oldGhost.events.at(-1)[0]){store.data.ghosts.classic={text:current.text,wpm:run.wpm,events:session.events.slice(0,4000)};store.save();ghostNote=oldGhost?'You beat your ghost. This run is your new replay.':'Your ghost is ready. Race this replay next time.';}
    else ghostNote='Your best ghost is waiting for another race.';
  }
  if(!completed)ghostNote='Progress saved. Finish the full passage or timer to set a personal benchmark or ghost replay.';
  if(options.focus)setFocus(false);$('typingInput')?.setAttribute('disabled','');$('invaderInput')?.setAttribute('disabled','');$('finishBtn')?.setAttribute('disabled','');
  const misses=Object.entries(session.keys).filter(([,v])=>v.err>0).sort((a,b)=>b[1].err-a[1].err).slice(0,4);
  $('results').innerHTML=`<section class="result" aria-label="Session results"><div class="result-head"><div><div class="eyebrow">${current.mode==='invaders'?`${invaders?.score||0} WORDS CLEARED`:ghostNote?'YOU VS. YOU':'ONE SESSION BETTER'}</div><h2>${run.acc>=98?'That’s a steady rhythm.':'Good practice. Keep going.'}</h2></div><span class="xp-badge">+${run.xp} XP</span></div><div class="metric-grid">${metric('Typing speed',fmt(run.wpm),'WPM',best===null?'Your first run in this mode':run.wpm>best?`New best · +${fmt(run.wpm-best,1)} WPM`:`Best in this mode · ${fmt(best)} WPM`,true)}${metric('Accuracy',fmt(run.acc,1),'%',`${run.errors} incorrect attempts`)}${metric('Consistency',run.cons===null?'—':fmt(run.cons),'%',run.cons===null?'Needs at least 5 measured intervals':'Based on correct-key timing')}${metric('Time practised',fmt(run.seconds,1),'s',`${run.chars} correct characters`)}</div><p class="result-info">${esc(ghostNote|| (misses.length?`Next focus: ${misses.map(([k,v])=>`${labelKey(k)} (${v.err} misses)`).join(', ')}.`:'A clean session. Try a longer passage or a new mode.'))}</p><p class="result-info">Raw speed ${fmt(run.raw)} WPM · ${run.backspaces} corrections · ${run.strict?'Accuracy mode':'Standard mode'}. Errors remain in accuracy after correction.</p><div class="button-row"><button class="button" id="resultRepeat">${current.mode==='ghost'?'Race again':current.mode==='invaders'?'Play again':'Try again'} ↗</button><a href="#practice?track=weak" class="button secondary">Train weak keys</a><a href="#stats" class="text-link">Explore your skill map →</a></div></section>`;
  $('resultRepeat').addEventListener('click',()=>{if(current.mode==='invaders'){stopRun();renderInvaders();}else if(['survival','dungeon'].includes(current.mode)){const mode=current.mode;stopRun();renderChallenge(mode);}else restartCurrent(true);});
  updateChrome();notify(`Session complete. ${fmt(run.wpm)} words per minute, ${fmt(run.acc)} percent accuracy. ${run.xp} XP earned.`);
  $('results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
  if(current.mode==='ghost'&&completed){const won=!ghost||!ghost.events.length||run.seconds*1000<ghost.events.at(-1)[0];showGameDialog({won,title:!ghost?'Your ghost is ready':won?'You beat your ghost!':'The ghost wins',reason:!ghost?'Your first replay is set. Restart to race against this run.':won?'You finished before your previous replay. This is your new ghost.':'Your previous replay finished first. Restart and try to beat it.',score:1,scoreLabel:'passage completed',level:'Ghost Race',onRestart:()=>restartCurrent(true)});}
}

function buildKeyboard(host,interactive=false){
  host.replaceChildren();
  const rows=[...KEY_ROWS.map(row=>row.map(([key])=>key)),[' ','\n']];
  for(const row of rows){const line=document.createElement('div');line.className='key-row';for(const key of row){const el=document.createElement(interactive?'button':'span');el.className='key'+(key===' '||key==='\n'?' wide':'');el.dataset.key=key;el.textContent=labelKey(key);if(interactive){el.type='button';el.setAttribute('aria-label',`Inspect ${labelKey(key)} key`);const v=store.data.keys[key];if(v&&v.att>=6)el.classList.add(v.err/v.att<=.02?'heat-good':v.err/v.att<=.07?'heat-mid':'heat-bad');el.addEventListener('click',()=>renderKeyDetail(key));}line.append(el);}host.append(line);}
}
function renderKeyDetail(key){
  const v=store.data.keys[key],most=v?Object.entries(v.mistakes||{}).sort((a,b)=>b[1]-a[1])[0]:null;
  $('keyDetail').innerHTML=`<h3>${esc(labelKey(key))} · ${v?`${v.att} attempts`:'No data yet'}</h3><p>${v?`${fmt((1-v.err/(v.att||1))*100,1)}% accuracy · ${v.n?fmt(v.ms/v.n)+'ms average interval':'Timing not measured yet'}. ${most?'Most common mistake: '+esc(labelKey(most[0]))+'.':''}`:'Finish a session with this key to start learning about it.'}</p>${key.trim()?`<a class="button secondary" href="#practice?track=weak&key=${encodeURIComponent(key)}">Practise ${esc(labelKey(key))} →</a>`:''}`;
}
function renderGames(){
  $('main').innerHTML=heading('A LITTLE PLAY GOES A LONG WAY','Welcome to the arcade.','Same skills. A different kind of challenge.')+`<div class="games-grid"><article class="game-card"><div class="game-art" aria-hidden="true"><div class="invader-art"><span>rhythm</span><span>keyboard</span><span>focus</span><span>practice</span></div></div><div class="game-card-body"><div class="eyebrow">QUICK THINKING · CLEAN TYPING</div><h2>Type Invaders</h2><p>Words are falling. Type the highlighted word before it reaches the ground. Words clear automatically.</p><a class="button" href="#games?play=invaders">Defend your keyboard ↗</a></div></article><article class="game-card"><div class="game-art" aria-hidden="true"><div class="race-art"><div></div><div></div></div></div><div class="game-card-body"><div class="eyebrow">PERSONAL BEST · PERSONAL RIVAL</div><h2>Ghost Race</h2><p>Your strongest opponent is your previous self. Finish a passage to set your ghost, then race its actual replay.</p><a class="button" href="#games?play=ghost">${store.data.ghosts.classic?'Race your ghost':'Set your first ghost'} ↗</a></div></article></div><p class="game-note">Every completed game trains the same skill map as your practice sessions.</p><section class="panel" style="margin-top:28px">${recommendation()}</section>`;
  $('main').querySelector('.games-grid').insertAdjacentHTML('beforeend',
    `<article class="game-card"><div class="game-art survival-art" aria-hidden="true"><span class="arcade-art-symbol">◷</span><span class="art-orbit"></span></div><div class="game-card-body"><div class="eyebrow">BEAT THE FUSE · EVERY WORD COUNTS</div><h2>Type Survival</h2><p>Two minutes, three hearts, and a timer for every word. Clear words to climb from Easy to Extra hard.</p><a class="button" href="#games?play=survival">Beat the fuse ↗</a></div></article><article class="game-card"><div class="game-art dungeon-art" aria-hidden="true"><span class="dungeon-door">♜</span><span class="dungeon-stars">· ✦ ·</span></div><div class="game-card-body"><div class="eyebrow">FOUR ROOMS · FOUR SENTENCE BOSSES</div><h2>Typing Dungeon</h2><p>Defeat word enemies, then tackle a sentence boss. Clear all four rooms before your hearts or time run out.</p><a class="button" href="#games?play=dungeon">Enter the dungeon ↗</a></div></article>`);
}
function renderChallenge(mode){
  const restart=()=>{stopRun();renderChallenge(mode);challenge.start();};
  challenge=renderWordGame($('main'),mode,{
    onStart(engine){session=engine;current={mode,name:mode==='dungeon'?'Typing Dungeon':'Type Survival',track:'words',duration:engine.duration,strict:true,indent:false,id:crypto.randomUUID()};saved=false;ensureTick();},
    onEnd(outcome){finishRun();const title=document.querySelector('#results .result-head h2');if(title)title.textContent=outcome.won?'Challenge complete!':'Game over — try again.';notify(outcome.reason);showGameDialog({...outcome,onRestart:restart});},
    onRestart:restart,announce:notify
  });
}
function renderInvaders(){
  $('main').innerHTML=heading('60 SECONDS · 10 SHIELDS','Type Invaders.','Type the highlighted word to clear it. Wrong letters and escaped words cost a shield.',`<a href="#games" class="button secondary">← Arcade</a>`)+`<section class="typing-panel"><div class="typing-top"><span><span class="session-dot"></span><span id="invaderStatus">Ready to defend</span></span><div class="live-metrics"><span><b id="gameScore">0</b> cleared</span><span><b id="gameHealth">10</b> shields</span><span><b id="gameTime">60</b>s left</span></div></div><div id="arena" class="arena" aria-label="Falling word arena"><div class="arena-start" id="arenaStart"><h2>Keep the words from landing.</h2><p>Type the word highlighted in green. It clears as soon as you finish it. You have 10 shields and 60 seconds.</p><button class="button" id="startInvaders">Start defending ↗</button></div></div><div class="game-target">Current target <strong id="targetWord">Start the game to begin</strong><span>Words clear automatically · Space is optional</span></div><div class="invader-input-row"><label for="invaderInput" class="sr-only">Type the highlighted word</label><input id="invaderInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="The highlighted word goes here…" disabled><button class="button secondary" id="gameRestart">Restart</button></div></section><p class="practice-note">Wrong letter: −1 shield · Escaped word: −2 shields · Speed rises after every word · Easy → Normal → Hard → Expert → Extra hard.</p><div id="results"></div>`;
  $('startInvaders').addEventListener('click',startInvaders);$('gameRestart').addEventListener('click',()=>{stopRun();renderInvaders();startInvaders();});
}
function startInvaders(){
  session=new TypingSession('',{strict:true,duration:60});session.started=performance.now();current={mode:'invaders',name:'Type Invaders',track:'words',duration:60,strict:true,indent:false,id:crypto.randomUUID()};saved=false;
  invaders={enemies:[],score:0,health:10,lastSpawn:performance.now(),lastFrame:performance.now(),id:0};
  $('arenaStart').remove();$('invaderInput').disabled=false;$('invaderInput').focus();spawnEnemy();
  const level=document.createElement('div');level.className='arcade-level-bar';level.innerHTML='<strong id="arcadeLevel">Level 1 · Easy</strong><span id="arcadePace">1.0× pace</span><div class="arcade-level-track"><i id="arcadeLevelFill"></i></div><span id="levelToast" role="status"></span>';
  $('arena').before(level);
  const input=$('invaderInput');
  input.addEventListener('paste',e=>e.preventDefault());input.addEventListener('drop',e=>e.preventDefault());
  input.addEventListener('input',e=>{if(e.isComposing)return;if(e.inputType==='insertFromPaste'||e.inputType==='insertFromDrop'){paintEnemies();return;}if(e.inputType==='deleteContentBackward'){undoGameKey();return;}typeInvaderText(e.data||'');});
  input.addEventListener('keydown',e=>{
    if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Backspace'){e.preventDefault();undoGameKey();}
    else if(e.key==='Escape'){e.preventDefault();stopRun();renderInvaders();}
    else if(e.key==='Enter'){e.preventDefault();}
    else if(e.key.length===1){e.preventDefault();typeInvaderText(e.key);}
  });
  ensureTick();
}
function spawnEnemy(){
  if(!invaders)return;const word=arcadeWord(invaders.score);
  const start=session.chars.length;session.append(word+' ');const el=document.createElement('div');el.className='enemy';el.textContent=word;$('arena').append(el);
  // Three lanes keep new words apart on narrow screens.
  const lane=invaders.id++%3,arena=$('arena');const x=clamp(lane*(arena.clientWidth/3)+12,6,Math.max(6,arena.clientWidth-el.offsetWidth-8));
  const enemy={word,start,end:session.chars.length,y:-40,x,el};invaders.enemies.push(enemy);paintEnemies();
}
function typeInvaderText(text){
  if(!invaders||!session||session.done)return;
  for(const ch of [...text]){
    if(/\s/.test(ch))continue; // Space/Enter between words are optional, never a penalty.
    if(session.expired(performance.now())){session.finish(performance.now());break;}
    const ok=session.type(ch,performance.now());
    if(!ok){invaders.health--; $('invaderInput').classList.add('bad');}else $('invaderInput').classList.remove('bad');
    const target=invaders.enemies[0];
    if(target&&session.index>=target.end-1){
      session.status[session.index++]=3; // separator is automatic, not a scored keystroke
      target.el.classList.add('enemy-cleared');setTimeout(()=>target.el.remove(),240);invaders.enemies.shift();invaders.score++;
      const toast=$('levelToast');toast.textContent=`Level ${invaders.score+1} · ${difficultyFor(invaders.score).name}`;toast.classList.remove('level-pop');void toast.offsetWidth;toast.classList.add('level-pop');
      if(!invaders.enemies.length)spawnEnemy();
    }
    if(invaders.health<=0){session.finish(performance.now());break;}
  }
  paintEnemies();paintGameCounters();if(session.done)endInvaders();
}
function undoGameKey(){const target=invaders?.enemies[0];if(target&&session.index>target.start){session.backspace(performance.now());paintEnemies();}}
function paintGameCounters(){if(!invaders)return;const difficulty=difficultyFor(invaders.score);$('gameScore').textContent=invaders.score;$('gameHealth').textContent=Math.max(0,invaders.health);$('gameTime').textContent=Math.max(0,Math.ceil(60-session.elapsed(performance.now())));if($('arcadeLevel')){$('arcadeLevel').textContent=`Level ${difficulty.level} · ${difficulty.name}`;$('arcadePace').textContent=`${(difficulty.speed/22).toFixed(1)}× pace`;$('arcadeLevelFill').style.width=clamp(invaders.score/35*100,0,100)+'%';}}
function paintEnemies(){
  if(!invaders)return;
  for(const enemy of invaders.enemies){enemy.el.classList.toggle('target',enemy===invaders.enemies[0]);const progress=clamp(session.index-enemy.start,0,enemy.word.length);enemy.el.innerHTML=`<b>${esc(enemy.word.slice(0,progress))}</b>${esc(enemy.word.slice(progress))}`;}
  const target=invaders.enemies[0],input=$('invaderInput');
  input.setAttribute('aria-label',target?`Type ${target.word}`:'Wait for the next word');
  input.value=target?target.word.slice(0,clamp(session.index-target.start,0,target.word.length)):'';
  input.placeholder=target?`Type: ${target.word}`:'Waiting for the next word…';
  if($('targetWord'))$('targetWord').textContent=target?.word||'…';
}
function tickInvaders(now){
  if(!invaders)return;const delta=(now-invaders.lastFrame)/1000;invaders.lastFrame=now;
  if(session.expired(now)){session.finish(now);endInvaders();return;}
  const difficulty=difficultyFor(invaders.score);
  if(now-invaders.lastSpawn>difficulty.spawnMs){spawnEnemy();invaders.lastSpawn=now;}
  for(const enemy of [...invaders.enemies]){enemy.y+=delta*difficulty.speed;enemy.el.style.transform=`translate(${enemy.x}px,${enemy.y}px)`;
    if(enemy.y>$('arena').clientHeight-enemy.el.offsetHeight){invaders.health-=2;enemy.el.remove();invaders.enemies=invaders.enemies.filter(e=>e!==enemy);while(session.index<enemy.end){session.status[session.index++]=3;}paintEnemies();}}
  if(invaders.health>0&&!invaders.enemies.length){spawnEnemy();invaders.lastSpawn=now;}
  paintGameCounters();$('invaderStatus').textContent=`${difficulty.name} · Level ${difficulty.level} · speed rises after every word`;
  if(invaders.health<=0)session.finish(now);if(session.done)endInvaders();
}
function endInvaders(){
  if(!invaders||invaders.ended)return;invaders.ended=true;
  const won=invaders.health>0;paintGameCounters();$('invaderStatus').textContent=won?'Time’s up · well defended':'Shields down · game over';$('invaderInput').disabled=true;
  if(session.attempts===0)$('results').innerHTML='<div class="notice" style="margin-top:20px">No keystrokes recorded. Restart to try again. No progress was saved.</div>';else finishRun();
  const title=document.querySelector('#results .result-head h2');if(title&&!won)title.textContent='Game over — try again.';
  const reason=won?'You defended the keyboard for 60 seconds. Ready for a faster run?':'Your shields are gone. Restart to build your rhythm and try again.';
  notify(reason);showGameDialog({won,reason,score:invaders.score,level:difficultyFor(invaders.score).name,onRestart:()=>{stopRun();renderInvaders();startInvaders();}});
}

function renderStats(){
  const db=store.data,filter=params.get('filter')||'all';
  const runs=db.runs.filter(r=>filter==='all'||filter==='practice'&&r.mode==='practice'||filter==='games'&&GAME_MODES.includes(r.mode)||filter==='test60'&&r.mode==='test'&&r.duration===60&&!r.strict);
  const recent=runs.slice(-10),weak=weakKeys(db.keys,8),pairs=Object.entries(db.pairs).filter(([,v])=>v.att>=3&&v.err>0).sort((a,b)=>b[1].err/b[1].att-a[1].err/a[1].att).slice(0,5);
  $('main').innerHTML=heading('MORE THAN A NUMBER','Meet your typing skill map.','Your speed, habits, and opportunities to improve. Built from real sessions.',selectField('statsFilter','Session history',[['test60','Standard 60s tests'],['practice','Practice'],['games','Games'],['all','All sessions']],filter))+
    `<div class="metric-grid">${metric('Saved sessions',runs.length,'',filter==='all'?'Last 1,000 sessions retained':'In the selected history')}${metric('Average speed',recent.length?fmt(average(recent.map(r=>r.wpm))):'—','WPM','Last 10 · selected history',true)}${metric('Average accuracy',recent.length?fmt(average(recent.map(r=>r.acc)),1):'—','%','Last 10 · selected history')}${metric('Lifetime characters',db.chars.toLocaleString(),'','Correct characters · all modes')}</div>`+
    (filter==='all'||filter==='games'||filter==='practice'?'<div class="notice">This view includes different session types. Use standard 60-second tests for a comparable speed benchmark.</div>':'')+
    `<div class="split"><section class="panel"><div class="section-heading"><h2>Your keyboard, decoded</h2><span>All modes · US QWERTY</span></div><p style="font-size:12px">Select a key for accuracy, timing, and a targeted drill.</p><div class="keyboard" id="skillKeyboard"></div><p class="keyboard-caption">Neutral: fewer than 6 attempts · Green: ≤2% misses · Amber: ≤7% · Red: &gt;7%</p><div id="keyDetail" class="skill-detail"><h3>Every key has a story.</h3><p>Select any key to explore it.</p></div></section><section class="panel"><div class="section-heading"><h2>Your next focus</h2><span>All modes</span></div><ul class="stat-list">${weak.length?weak.map(w=>`<li><code>${esc(labelKey(w.key))}</code><span class="muted">${fmt(w.rate*100,1)}% misses · ${w.latency?fmt(w.latency)+'ms':'no timing'}</span></li>`).join(''):'<li class="empty">Complete a few sessions to find your problem keys.</li>'}</ul><h3 style="margin-top:22px">Problem combinations</h3><ul class="stat-list">${pairs.length?pairs.map(([p,v])=>`<li><code>${p}</code><span class="muted">${v.err} misses / ${v.att} attempts</span></li>`).join(''):'<li class="empty">Repeated letter-pair mistakes will appear here.</li>'}</ul><a class="text-link" href="#practice?track=weak">Build a targeted session →</a></section></div>`+
    `<section class="panel" style="margin-top:22px"><div class="section-heading"><h2>Your pace over time</h2><span>Last 20 · selected history</span></div>${chart(runs.slice(-20),'sessions in this view')}</section><section class="panel" style="margin-top:22px"><div class="section-heading"><h2>Session history</h2><span>Latest 30</span></div>${runs.length?`<div class="table-wrap"><table><thead><tr><th>When</th><th>Session</th><th>WPM</th><th>Accuracy</th><th>Consistency</th></tr></thead><tbody>${runs.slice(-30).reverse().map(r=>`<tr><td>${date(r.t)}</td><td>${esc(r.name)} <span class="status-pill">${esc(r.mode)}${r.completed===false?' · partial':''}</span></td><td>${fmt(r.wpm,1)}</td><td>${fmt(r.acc,1)}%</td><td>${r.cons===null?'—':fmt(r.cons)+'%'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No completed sessions in this view yet. Your next session will show up here.</p>'}</section>`;
  buildKeyboard($('skillKeyboard'),true);$('statsFilter').addEventListener('change',e=>location.hash=`stats?filter=${e.target.value}`);
}
function renderProfile(){
  const db=store.data,level=Math.floor(db.xp/250)+1;
  const achievements=[['↗','First steps','Complete your first session.',db.runs.length>0],['◎','Precision','Finish 100+ characters at 98% accuracy.',db.runs.some(r=>r.chars>=100&&r.acc>=98)],['◷','Finding flow','Reach 60 WPM in a standard 60s test.',db.runs.some(r=>r.mode==='test'&&r.duration===60&&!r.strict&&r.wpm>=60)],['♧','Player one','Complete a game in the arcade.',db.runs.some(r=>GAME_MODES.includes(r.mode))]];
  const themes=[['void','Void',['#101312','#2a332d','#c0e88d']],['paper','Paper',['#f6f5ef','#dcded2','#487032']],['ocean','Ocean',['#0c1720','#294452','#83d6de']],['terminal','Terminal',['#09110b','#29482e','#8fe88b']]];
  $('main').innerHTML=heading('MAKE YOURSELF AT HOME','Your own kind of progress.','Small wins add up. Keep a little record of yours.')+`<section class="panel profile-hero"><div class="avatar">Y</div><div><div class="eyebrow">LOCAL TYPIST</div><h2>${levelName(db.xp)}</h2><p>Level ${level} · ${db.xp.toLocaleString()} total XP · ${streak(db.runs)} day streak</p></div><div class="level-progress"><p><span>Next level</span><span>${db.xp%250} / 250 XP</span></p><div class="level-track"><i style="width:${db.xp%250/250*100}%"></i></div></div></section><div class="section-heading"><h2>A few milestones along the way</h2><span>${achievements.filter(a=>a[3]).length} / ${achievements.length} earned</span></div><div class="achievement-grid">${achievements.map(([i,t,d,earned])=>`<div class="achievement${earned?' earned':''}"><div class="achievement-icon" aria-hidden="true">${i}</div><h3>${t}</h3><p>${d}</p><small>${earned?'EARNED':'AHEAD OF YOU'}</small></div>`).join('')}</div><section class="panel"><div class="section-heading"><h2>Set the mood</h2><span>All themes available</span></div><p style="font-size:12px">A quieter screen. A different shade. Make this space yours.</p><div class="theme-grid">${themes.map(([key,name,colors])=>`<button class="theme-card" data-theme-choice="${key}" aria-pressed="${db.settings.theme===key}"><span class="theme-swatches">${colors.map(c=>`<i style="background:${c}"></i>`).join('')}</span>${name}</button>`).join('')}</div><div class="data-tools"><h3>Your progress belongs to you.</h3><p>Stored in this browser, with no account needed. Export a backup to move devices. Import replaces the current profile. Backups from earlier versions are supported.</p><div class="button-row"><button class="button secondary" id="exportBtn">Export progress ↓</button><button class="button secondary" id="importBtn">Import backup ↑</button><input id="importFile" class="file-input" type="file" accept="application/json,.json" aria-label="Import progress backup"><button class="text-link" id="resetBtn" style="color:var(--error)">Reset progress</button></div><p id="importStatus" role="status"></p></div></section>`;
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{db.settings.theme=b.dataset.themeChoice;store.save();applyTheme(db.settings.theme);renderProfile();}));
  $('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(store.data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`typepoise-progress-${localDay()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Progress backup exported.');});
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('Choose a progress file smaller than 5 MB.');const data=JSON.parse(await file.text());store.replace(data);applyTheme(store.data.settings.theme);renderProfile();updateChrome();$('importStatus').textContent='Progress imported successfully.';}catch(error){$('importStatus').textContent=error instanceof SyntaxError?'That file is not valid JSON. Your progress was not changed.':error.message+' Your progress was not changed.';}e.target.value='';});
  $('resetBtn').addEventListener('click',()=>$('resetDialog').showModal());
}
function renderRoute(){
  if(session&&session.started!==null&&!session.done)notify('Your typing progress has been saved.');
  stopRun();setFocus(false);
  const [path,query='']=(location.hash.slice(1)||'home').split('?');route=Object.hasOwn(titles,path)?path:'home';params=new URLSearchParams(query);updateChrome();
  if(route==='home')renderHome();
  if(route==='practice'||route==='test'){const track=params.get('track');if(Object.hasOwn(trackNames,track))options.track=track;options.targetKey=params.get('key')?.slice(0,1)||'';renderPractice(route);}
  if(route==='games'){if(params.get('play')==='ghost')renderPractice('ghost');else if(params.get('play')==='invaders')renderInvaders();else if(['survival','dungeon'].includes(params.get('play')))renderChallenge(params.get('play'));else renderGames();}
  if(route==='learn')renderHandGuide($('main'), text=>{options.custom=text;options.track='custom';options.strict=true;location.hash='practice?track=custom';});
  if(route==='stats')renderStats();if(route==='profile')renderProfile();
  if(store.warning){const note=document.createElement('p');note.className='notice';note.textContent=store.warning;$('main').prepend(note);}
  window.scrollTo(0,0);
}
$('themeToggle').addEventListener('click',()=>{store.data.settings.theme=store.data.settings.theme==='paper'?'void':'paper';store.save();applyTheme(store.data.settings.theme);if(route==='profile')renderProfile();});
$('cancelReset').addEventListener('click',()=>$('resetDialog').close());
$('confirmReset').addEventListener('click',()=>{store.reset();$('resetDialog').close();renderRoute();notify('Progress cleared.');});
window.addEventListener('hashchange',renderRoute);
document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();$('main').focus();});
window.addEventListener('pagehide',checkpoint);
document.addEventListener('visibilitychange',()=>{if(document.hidden)checkpoint();});
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||!session||session.done)return;
  if(e.target.closest?.('input,textarea,select,button,a,[contenteditable]'))return;
  if(challenge?.started&&e.key.length===1){e.preventDefault();$('challengeInput').focus();challenge.type(e.key);}
  else if(invaders&&e.key.length===1){e.preventDefault();$('invaderInput').focus();typeInvaderText(e.key);}
  else if(!invaders&&!challenge&&(e.key.length===1||e.key==='Enter')){e.preventDefault();$('typingInput').focus();if(e.key!=='Enter')consume(e.key);}
});
applyTheme(store.data.settings.theme);renderRoute();
