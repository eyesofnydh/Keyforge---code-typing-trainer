import { KEY_ROWS, KEY_FOR_CHAR } from './data.js';

export const FINGERS = [
  {id:'lp',name:'Left little',home:'A',keys:'`1qaz',color:'#da91c9'},
  {id:'lr',name:'Left ring',home:'S',keys:'2wsx',color:'#d1a273'},
  {id:'lm',name:'Left middle',home:'D',keys:'3edc',color:'#cfca73'},
  {id:'li',name:'Left index',home:'F',keys:'45rtfgvb',color:'#91be9c'},
  {id:'ri',name:'Right index',home:'J',keys:'67yuhjnm',color:'#7fbdce'},
  {id:'rm',name:'Right middle',home:'K',keys:'8ik,',color:'#93a5dc'},
  {id:'rr',name:'Right ring',home:'L',keys:'9ol.',color:'#b0a0d8'},
  {id:'rp',name:'Right little',home:';',keys:"0p;/-=[]\\'",color:'#dc9a9a'},
  {id:'thumb',name:'Either thumb',home:'Space',keys:' ',color:'#a7b39d'},
];
export function fingerForKey(key) {const base=KEY_FOR_CHAR.get(key)||key.toLowerCase();return FINGERS.find(f=>f.keys.includes(base));}
const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

function hand(side) {
  const fingers=side==='Left'?FINGERS.slice(0,4):FINGERS.slice(4,8);
  const heights=side==='Left'?[55,82,94,78]:[78,94,82,55];
  return `<figure class="hand-figure"><svg viewBox="0 0 280 205" role="img" aria-label="${side} hand, viewed from above. ${fingers.map(f=>f.name+' finger on '+f.home).join(', ')}."><rect class="hand-palm" x="45" y="107" width="154" height="82" rx="28"/>${fingers.map((f,i)=>`<g data-hand-finger="${f.id}" style="--finger-color:${f.color}"><rect class="hand-finger" x="${47+i*39}" y="${126-heights[i]}" width="34" height="${heights[i]+20}" rx="16"/><text x="${64+i*39}" y="${126-heights[i]+32}" text-anchor="middle">${f.home}</text></g>`).join('')}<g data-hand-finger="thumb"><rect class="hand-thumb" x="${side==='Left'?195:10}" y="122" width="31" height="63" rx="15" transform="rotate(${side==='Left'?'-30':'30'} ${side==='Left'?210:25} 153)"/></g><text class="hand-label" x="122" y="170" text-anchor="middle">${side} hand</text></svg><figcaption>${side==='Left'?'Little → ring → middle → index':'Index → middle → ring → little'}</figcaption></figure>`;
}

export function renderHandGuide(host,onPractice) {
  let selected='li';
  host.innerHTML=`<div class="page-heading"><div><div class="eyebrow">START WITH THE BASICS</div><h1>Give every finger a home.</h1><p>A visual guide to standard US QWERTY touch typing. Select a key or a finger to explore.</p></div><button class="button" id="homeRowPractice">Try a home-row drill ↗</button></div><div class="placement-steps"><section><b>1</b><div><h2>Find the two bumps</h2><p>Place your index fingers on <kbd>F</kbd> and <kbd>J</kbd>. Their raised marks help you find home without looking.</p></div></section><section><b>2</b><div><h2>Settle on the home row</h2><p>Left hand: <kbd>A S D F</kbd>.<br>Right hand: <kbd>J K L ;</kbd>.</p></div></section><section><b>3</b><div><h2>Reach, then return</h2><p>Use either thumb for Space. Move the assigned finger to a key, then return to its home position.</p></div></section></div><section class="panel placement-panel" aria-label="Interactive finger placement guide"><div class="section-heading"><h2>Your keyboard, finger by finger</h2><span>Colour + labels · no guessing</span></div><div id="guideKeyboard" class="keyboard guide-keyboard"></div><div class="guide-key-detail" id="fingerDetail" role="status"></div><div class="hands-diagram">${hand('Left')}${hand('Right')}</div><div class="finger-selectors" role="group" aria-label="Select a finger">${FINGERS.map(f=>`<button type="button" class="finger-selector" data-finger="${f.id}" aria-pressed="false" style="--finger-color:${f.color}"><i aria-hidden="true"></i><span>${f.name}${f.id==='thumb'?'':' finger'}<small>Home: ${f.home}</small></span></button>`).join('')}</div></section><div class="lower-grid"><section class="panel"><div class="eyebrow">A GENTLE FIRST SESSION</div><h2>Start with F and J.</h2><p style="font-size:13px;margin:12px 0 20px">Find the bumps, press each key slowly, and return your index fingers to F and J. Build accuracy before worrying about speed.</p><button class="button secondary" id="anchorPractice">Practise F & J →</button></section><section class="panel"><h2>What about capitals and layouts?</h2><p style="font-size:13px;margin:12px 0">For a capital letter, use Shift with the little finger of your opposite hand. The highlighted symbol shares the same physical key as its unshifted character.</p><p style="font-size:12px">This map is for US QWERTY. Other layouts and some teaching methods assign a few boundary keys differently. Use a comfortable technique that works for you.</p><a class="text-link" href="https://s.typingclub.com/m/edclubdocs/media/pdf/KeyboardHands_handout.pdf" target="_blank" rel="noopener noreferrer">Finger placement reference · TypingClub ↗</a></section></div>`;
  const keyboard=host.querySelector('#guideKeyboard');
  for(const row of [...KEY_ROWS.map(r=>r.map(([base])=>base)),[' ']]){
    const line=document.createElement('div');line.className='key-row';
    for(const key of row){const finger=fingerForKey(key),button=document.createElement('button');button.type='button';button.className='key guide-key'+(key===' '?' wide':'');button.textContent=key===' '?'Space':key.toUpperCase();button.dataset.guideFinger=finger.id;button.dataset.guideKey=key;button.style.setProperty('--finger-color',finger.color);button.setAttribute('aria-label',`${key===' '?'Space':key.toUpperCase()} · ${finger.name}${finger.id==='thumb'?'':' finger'}`);if(key==='f'||key==='j'){button.classList.add('anchor-key');button.setAttribute('aria-label',`${key.toUpperCase()} · ${finger.name} finger · raised home-row bump`);}button.addEventListener('click',()=>{selected=finger.id;paint(key);});line.append(button);}
    keyboard.append(line);
  }
  function paint(key=null){
    const finger=FINGERS.find(f=>f.id===selected);
    host.querySelectorAll('[data-guide-finger]').forEach(el=>{const active=el.dataset.guideFinger===selected;el.classList.toggle('finger-active',active);el.setAttribute('aria-pressed',String(active));});
    host.querySelectorAll('[data-hand-finger]').forEach(el=>el.classList.toggle('finger-active',el.dataset.handFinger===selected));
    host.querySelectorAll('[data-finger]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.finger===selected)));
    host.querySelector('#fingerDetail').innerHTML=`<strong>${escapeHTML(finger.name)}${finger.id==='thumb'?'':' finger'}${key?' → '+escapeHTML(key===' '?'Space':key.toUpperCase()):''}</strong><span>Home: <kbd>${finger.home}</kbd> · ${finger.id==='thumb'?'Use either thumb for Space.':'Assigned keys: '+escapeHTML([...finger.keys].map(k=>k.toUpperCase()).join(' '))}</span>`;
  }
  host.querySelectorAll('[data-finger]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.finger;paint();}));
  host.querySelector('#homeRowPractice').addEventListener('click',()=>onPractice('fff jjj fff jjj ddd kkk sss lll aaa ;;; asdf jkl; asdf jkl;'));
  host.querySelector('#anchorPractice').addEventListener('click',()=>onPractice('fff jjj fjf jfj ff jj fj jf fff jjj'));
  paint();
}
