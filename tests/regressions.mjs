import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1360,height:700}});
const page=await context.newPage();
const base=process.env.KEYFORGE_URL||'http://127.0.0.1:4173';
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const profile=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('keyforge.v2')));
const metric=label=>page.locator('.metric').filter({has:page.locator('.metric-label',{hasText:label})});
await mkdir('work',{recursive:true});
try {
  await page.goto(base);
  await page.locator('h1').waitFor();
  const before=await page.locator('.sidebar').boundingBox();
  await page.mouse.move(1100,550);await page.mouse.wheel(0,900);
  await page.waitForFunction(()=>scrollY>100);
  const after=await page.locator('.sidebar').boundingBox(),topbar=await page.locator('.topbar').boundingBox();
  assert.ok(Math.abs(before.y)<2);assert.ok(Math.abs(after.y)<2,`Sidebar moved to ${after.y}`);
  assert.ok(Math.abs(after.height-700)<2);assert.ok(Math.abs(topbar.y)<2,`Topbar moved to ${topbar.y}`);
  await page.getByRole('link',{name:'Practice',exact:true}).click();
  await page.getByRole('button',{name:'Custom',exact:true}).click();
  await page.locator('#customInput').fill('steady hands make steady progress');
  await page.getByRole('button',{name:'Use this text',exact:true}).click();
  await page.locator('#typingInput').pressSequentially('steady ',{delay:50});
  await page.getByRole('link',{name:'Overview',exact:true}).click();
  await page.getByRole('heading',{name:'Find your flow.',exact:true}).waitFor();
  assert.equal((await profile()).runs.length,1);
  assert.equal((await profile()).runs[0].completed,false);
  assert.equal((await profile()).chars,7);
  assert.match(await metric('Today’s accuracy').innerText(),/100.0/);
  assert.match(await metric('Keys typed today').innerText(),/7/);
  assert.match(await metric('Personal benchmark').innerText(),/Finish a practice/);
  await page.reload();assert.equal((await profile()).chars,7);
  await page.getByRole('link',{name:'Practice',exact:true}).click();
  await page.getByRole('button',{name:'Custom',exact:true}).click();
  await page.locator('#customInput').fill('a useful habit');
  await page.getByRole('button',{name:'Use this text',exact:true}).click();
  // Native key events must work even when the user begins typing on the page itself.
  await page.locator('h1').click();await page.keyboard.type('a useful habit',{delay:50});
  await page.getByRole('region',{name:'Session results'}).waitFor();
  assert.equal((await profile()).runs.length,2);
  assert.equal((await profile()).runs[1].attempts,14);
  await page.getByRole('link',{name:'Overview',exact:true}).click();
  await page.getByRole('heading',{name:'Find your flow.',exact:true}).waitFor();
  assert.match(await metric('Personal benchmark').innerText(),/Practice/);
  assert.doesNotMatch(await metric('Personal benchmark').locator('.metric-value').innerText(),/—/);
  await page.getByRole('link',{name:'Skill map',exact:true}).click();
  await page.getByRole('heading',{name:'Meet your typing skill map.',exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),2);
  assert.match(await page.locator('tbody').innerText(),/partial/);
  console.log('Passed: fixed navigation while scrolling, interrupted progress, dashboard accuracy, practice benchmark, history, and keyboard focus.');

  await page.goto(base+'/#test');
  await page.getByRole('button',{name:'15s',exact:true}).click();
  await page.clock.install();
  const first=await page.locator('#passage').textContent();
  await page.locator('#typingInput').pressSequentially(first.slice(0,20),{delay:20});
  await page.clock.runFor(16000);
  await page.getByRole('region',{name:'Session results'}).waitFor();
  const testRun=(await profile()).runs.at(-1);
  assert.equal(testRun.completed,true);assert.equal(testRun.duration,15);
  await page.getByRole('link',{name:'Overview',exact:true}).click();
  await page.getByRole('heading',{name:'Find your flow.',exact:true}).waitFor();
  assert.match(await metric('Personal benchmark').innerText(),/15s test/);
  await page.reload();assert.match(await metric('Personal benchmark').innerText(),/15s test/);

  await page.goto(base+'/#games?play=invaders');
  await page.getByRole('button',{name:/Start defending/}).click();
  let attempts=0;
  for(let i=0;i<12;i++){
    const word=await page.locator('#targetWord').textContent();
    await page.locator('#invaderInput').pressSequentially(word.slice(0,1),{delay:20});
    assert.equal(await page.locator('#invaderInput').inputValue(),word.slice(0,1));
    await page.locator('#invaderInput').pressSequentially(word.slice(1),{delay:20});
    attempts+=word.length;
    // No space is needed to clear a word; an optional separator is harmless.
    await page.locator('#invaderInput').press('Space');
    assert.equal(await page.locator('#gameScore').textContent(),String(i+1));
    assert.equal(await page.locator('#gameHealth').textContent(),'10');
    await page.clock.runFor(350);
  }
  // Spawn a queued word and allow the active one to escape.
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  await page.clock.runFor(13000);
  assert.ok(Number(await page.locator('#gameHealth').textContent())>0);
  const nextWord=await page.locator('#targetWord').textContent();
  assert.match(nextWord,/^[a-z]+$/);
  await page.locator('#invaderInput').pressSequentially(nextWord,{delay:20});
  assert.equal(await page.locator('#gameScore').textContent(),'13');
  await page.locator('#invaderInput').pressSequentially('!!!!!!!!!!!!!!!!!!!!',{delay:5});
  await page.getByRole('region',{name:'Session results'}).waitFor();
  assert.equal(await page.locator('#gameHealth').textContent(),'0');
  assert.equal((await profile()).runs.at(-1).mode,'invaders');
  assert.equal((await profile()).runs.at(-1).completed,true);
  assert.ok((await profile()).runs.at(-1).attempts>=attempts);
  const count=(await profile()).runs.length;
  await page.getByRole('link',{name:'Overview',exact:true}).click();
  await page.getByRole('heading',{name:'Find your flow.',exact:true}).waitFor();
  const db=await profile();
  const totalAttempts=db.runs.reduce((n,r)=>n+r.attempts,0),totalErrors=db.runs.reduce((n,r)=>n+r.errors,0);
  const expected=(100*(1-totalErrors/totalAttempts)).toFixed(1);
  assert.match(await metric('Today’s accuracy').innerText(),new RegExp(expected.replace('.','\\.')));
  await page.reload();assert.equal((await profile()).runs.length,count);
  console.log('Passed: 15-second benchmark, 13 cleared game words, visible typing, optional spaces, waves, shield loss, game-over persistence, and attempt-weighted accuracy.');

  await page.goto(base+'/#practice');
  await page.getByRole('button',{name:'Words',exact:true}).click();
  const wordText=await page.locator('#passage').textContent();
  await page.locator('#typingInput').pressSequentially(wordText.slice(0,8),{delay:20});
  await page.getByRole('button',{name:'Finish & save',exact:true}).click();
  await page.getByRole('region',{name:'Session results'}).waitFor();
  assert.equal((await profile()).runs.at(-1).completed,false);
  const savedCount=(await profile()).runs.length;
  await page.reload();assert.equal((await profile()).runs.length,savedCount);
  await page.getByRole('button',{name:'Sentences',exact:true}).click();
  await page.locator('#typingInput').pressSequentially('x',{delay:20});
  await page.reload();assert.equal((await profile()).runs.length,savedCount+1);
  console.log('Passed: explicit finish-and-save, reload checkpoints, and no duplicate saved sessions.');

  await page.goto(base+'/#home');await page.mouse.move(1100,550);await page.mouse.wheel(0,500);
  await page.screenshot({path:'work/fixed-dashboard-scrolled.png',fullPage:false});
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
