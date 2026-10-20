import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1360,height:850}});
const base=process.env.KEYFORGE_URL||'http://127.0.0.1:4173';
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const data=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('keyforge.v2')));
await mkdir('work',{recursive:true});
try{
  await page.goto(base+'/#games');
  assert.equal(await page.locator('.game-card').count(),4);
  for(const name of ['Type Invaders','Ghost Race','Type Survival','Typing Dungeon'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),1);
  await page.goto(base+'/#games?play=invaders');
  await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  await page.getByRole('button',{name:/Start defending/}).click();
  const speeds=[];
  for(let i=0;i<36;i++){
    const word=await page.locator('#targetWord').textContent();
    await page.locator('#invaderInput').pressSequentially(word);
    assert.equal(await page.locator('#gameScore').textContent(),String(i+1));
    speeds.push(Number((await page.locator('#arcadePace').textContent()).replace('× pace','')));
  }
  assert.match(await page.locator('#arcadeLevel').textContent(),/Extra hard/);
  assert.ok(speeds.at(-1)>speeds[0]);
  await page.locator('#invaderInput').pressSequentially('!!!!!!!!!!!!!!!!!!!!');
  const dialog=page.getByRole('dialog',{name:'Game over',exact:true});await dialog.waitFor();
  assert.equal(await dialog.locator('.outcome-symbol').isVisible(),true);
  const animations=await dialog.evaluate(el=>el.getAnimations({subtree:true}).map(a=>a.animationName));
  assert.ok(animations.some(name=>name==='shield-break'||name==='game-over-enter'));
  await page.clock.runFor(800);
  await page.screenshot({path:'work/arcade-game-over.png'});
  const count=(await data()).runs.length;
  await page.getByRole('button',{name:/Restart game/}).click();
  assert.equal(await page.locator('#invaderInput').isEnabled(),true);assert.equal(await page.locator('#gameScore').textContent(),'0');
  assert.equal(await page.locator('#gameHealth').textContent(),'10');
  assert.equal((await data()).runs.length,count);
  // A no-input loss must still show the game-over screen, without inventing progress.
  await page.clock.runFor(58000);
  await page.getByRole('dialog').waitFor();
  assert.equal((await data()).runs.length,count);
  await page.getByRole('button',{name:'View results',exact:true}).click();
  console.log('Passed: four arcade games, per-word difficulty through Extra hard, animated defeat, immediate restart, and zero-input loss.');

  await page.goto(base+'/#games?play=survival');
  await page.getByRole('button',{name:/Start surviving/}).click();
  const first=await page.locator('#challengePrompt').textContent();
  await page.locator('#challengeInput').pressSequentially(first);
  assert.equal(await page.locator('#challengeScore').textContent(),'1');
  await page.locator('#challengeInput').pressSequentially('!!!');
  await page.getByRole('dialog',{name:'Game over',exact:true}).waitFor();
  assert.equal((await data()).runs.at(-1).mode,'survival');
  await page.getByRole('button',{name:/Restart game/}).click();
  assert.equal(await page.locator('#challengeInput').isEnabled(),true);
  assert.equal(await page.locator('#challengeHealth').textContent(),'3');
  await page.goto(base+'/#games?play=dungeon');
  await page.getByRole('button',{name:/Enter dungeon/}).click();
  let bosses=0;
  for(let i=0;i<16;i++){
    if((await page.locator('#challengeRole').textContent()).includes('Sentence boss'))bosses++;
    const prompt=await page.locator('#challengePrompt').textContent();
    await page.locator('#challengeInput').pressSequentially(prompt);
  }
  assert.equal(bosses,4);
  await page.getByRole('dialog',{name:'Challenge complete!',exact:true}).waitFor();
  assert.equal((await data()).runs.at(-1).mode,'dungeon');
  assert.equal((await data()).runs.at(-1).completed,true);
  await page.screenshot({path:'work/arcade-dungeon-victory.png'});
  await page.getByRole('button',{name:'View results',exact:true}).click();
  console.log('Passed: survival loss/restart, all four dungeon rooms and sentence bosses, final victory, and shared history.');

  // A completed ghost race also needs an explicit result, including an actual loss.
  await page.goto(base+'/#games?play=ghost');
  const ghostText=await page.locator('#passage').textContent();
  await page.locator('#typingInput').pressSequentially(ghostText.slice(0,1));await page.clock.runFor(1000);
  await page.locator('#typingInput').pressSequentially(ghostText.slice(1));
  await page.getByRole('dialog',{name:'Your ghost is ready',exact:true}).waitFor();
  await page.getByRole('button',{name:/Restart game/}).click();
  await page.locator('#typingInput').pressSequentially(ghostText.slice(0,1));await page.clock.runFor(2000);
  await page.locator('#typingInput').pressSequentially(ghostText.slice(1));
  await page.getByRole('dialog',{name:'The ghost wins',exact:true}).waitFor();
  await page.getByRole('button',{name:'View results',exact:true}).click();
  console.log('Passed: explicit first-ghost outcome and a slower replay producing a visible loss.');

  await page.goto(base+'/#learn');
  await page.getByRole('heading',{name:'Give every finger a home.',exact:true}).waitFor();
  assert.equal(await page.locator('.hand-figure svg').count(),2);
  await page.getByRole('button',{name:/F · Left index finger · raised home-row bump/}).click();
  assert.match(await page.locator('#fingerDetail').textContent(),/Left index finger → F/);
  await page.locator('[data-finger="rp"]').click();
  assert.match(await page.locator('#fingerDetail').textContent(),/Right little finger/);
  assert.equal(await page.locator('[data-guide-key=";"]').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.clock.runFor(100);
  await page.screenshot({path:'work/hand-placement-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Practise F & J →',exact:true}).click();
  await page.locator('#typingInput').waitFor();
  assert.equal(await page.locator('#strictInput').isChecked(),true);
  const drill=await page.locator('#passage').textContent();
  assert.match(drill,/fff jjj/);
  await page.locator('#typingInput').pressSequentially(drill);
  await page.getByRole('region',{name:'Session results'}).waitFor();
  assert.equal((await data()).runs.at(-1).acc,100);
  console.log('Passed: finger diagrams, interactive key assignments, home-row anchors, and a completed F/J lesson.');

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base+'/#games?play=survival');
  await page.getByRole('button',{name:/Start surviving/}).click();
  await page.locator('#challengeInput').pressSequentially('!!!');
  await page.getByRole('dialog',{name:'Game over',exact:true}).waitFor();
  assert.equal(await page.locator('.outcome-symbol').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.getByRole('button',{name:'View results',exact:true}).click();
  for(const width of [815,390,320]){
    await page.setViewportSize({width,height:850});
    for(const route of ['games','games?play=invaders','games?play=survival','games?play=dungeon','learn']){
      await page.goto(base+'/#'+route);await page.locator('h1').waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} overflows at ${width}`);
    }
  }
  await page.screenshot({path:'work/hand-placement-mobile.png',fullPage:true});
  await page.reload();
  const modes=(await data()).runs.map(r=>r.mode);
  assert.ok(modes.includes('survival')&&modes.includes('dungeon'));
  assert.deepEqual(errors,[]);
  console.log('Passed: reduced motion, mobile layouts at 390/320px, narrow desktop at 815px, and new-mode persistence after reload.');
}finally{await browser.close();}
