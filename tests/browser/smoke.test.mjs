// Browser smoke test: drives the real page in headless Chromium through the main student paths.
// It is not part of `npm test`, which needs no packages. Run it with `npm run test:browser`.
// Needs Playwright with Chromium: `npm i --no-save playwright && npx playwright install chromium`.
// Firefox, WebKit, Safari, and real phones are not covered; phone layouts are Chromium emulation only.
// A fake clock drives requestAnimationFrame, so a 30 s run takes a few seconds and does not depend on frame timing.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import en from '../../dist/lang/en.mjs';
import tr from '../../dist/lang/tr.mjs';
import fr from '../../dist/lang/fr.mjs';
import {toCsv} from '../../dist/drive.mjs';
import {missionById,missionText} from '../../dist/missions.mjs';
import {SENSORS} from '../../dist/physics.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const shots=path.join(root,'test-results');
const fill=(s,params={})=>s.replace(/\{(\w+)\}/g,(m,k)=>k in params?String(params[k]):m);

function loadPlaywright(){
  const require=createRequire(import.meta.url);
  for(const name of ['playwright','@playwright/test']){try{return require(name);}catch{}}
  throw new Error('Playwright is not installed. Run: npm i --no-save playwright && npx playwright install chromium');
}

let pw,browser,server,base;
before(async()=>{
  pw=loadPlaywright();
  browser=await pw.chromium.launch();
  server=spawn(process.execPath,[path.join(root,'scripts/serve.mjs')],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
  base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Dev server did not start within 10 s')),10000);
    server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});
    server.on('exit',code=>reject(new Error(`Dev server exited with code ${code}`)));
  });
});
after(async()=>{await browser?.close();server?.kill();});

// Opens the lab in a fresh profile with an English browser locale, collecting every console error,
// uncaught exception, and failed request. A failing test leaves a screenshot in test-results/.
async function withLab(name,options,fn){
  const context=await browser.newContext({locale:'en-US',viewport:{width:1280,height:800},acceptDownloads:true,...options});
  const page=await context.newPage(),problems=[];
  page.setDefaultTimeout(10000);
  page.on('console',m=>{if(m.type()==='error')problems.push(`console: ${m.text()}`);});
  page.on('pageerror',e=>problems.push(`exception: ${e.message}`));
  page.on('requestfailed',r=>problems.push(`request failed: ${r.url()}`));
  page.on('response',r=>{if(r.status()>=400)problems.push(`HTTP ${r.status()}: ${r.url()}`);});
  await page.clock.install();
  try{
    await page.goto(base);
    await page.clock.runFor(200);
    await fn(page);
    assert.deepEqual(problems,[],'console errors, exceptions, or failed requests');
  }catch(e){
    await mkdir(shots,{recursive:true});
    await page.screenshot({path:path.join(shots,`${name}.png`),fullPage:true}).catch(()=>{});
    throw e;
  }finally{await context.close();}
}

// Advances the fake clock until the run's outcome appears. limit is simulated milliseconds.
async function runToEnd(page,limit=40000){
  for(let t=0;t<limit;t+=250){
    if(await page.isVisible('#stage-outcome'))return (await page.textContent('#stage-outcome')).trim();
    await page.clock.runFor(250);
  }
  assert.fail(`no outcome after ${limit/1000} s of simulated time`);
}

test('the page loads every module, paints the scene, and logs no errors',async()=>{
  await withLab('load',{},async page=>{
    assert.equal(await page.title(),en['doc.title']);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
    assert.equal((await page.textContent('#run-text')).trim(),en['run.start']);
    // A blank or single-color canvas means rendering failed even without an exception.
    const colors=await page.evaluate(()=>{
      const c=document.getElementById('scene'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,seen=new Set();
      for(let i=0;i<d.length;i+=4*97)seen.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
      return seen.size;
    });
    assert.ok(colors>20,`scene shows only ${colors} sampled colors`);
  });
});

test('ramp experiment: the balanced rover holds at the target tilt and is recorded',async()=>{
  await withLab('ramp',{},async page=>{
    assert.equal(await page.inputValue('#experiment-mode'),'tilt');
    const target=Number(await page.inputValue('#target'));
    await page.click('#run');
    const outcome=await runToEnd(page);
    assert.equal(outcome,fill(en['tilt.balanced'],{angle:target}));
    assert.ok(!(await page.getAttribute('#stage-outcome','class')).includes('failed'));
    await page.click('#results-tab');
    assert.equal(await page.locator('#results-list > *').count(),1);
  });
});

test('drive run: the default example finishes, plots render, and the CSV holds the log',async()=>{
  await withLab('drive',{},async page=>{
    await page.selectOption('#experiment-mode','drive');
    await page.click('#run');
    assert.equal(await runToEnd(page),en['sim.complete']);
    await page.click('#plots-tab');
    await page.clock.runFor(300);
    assert.ok(await page.isHidden('#plots-empty'));
    const figures=await page.locator('#plot-grid canvas').count();
    assert.ok(figures>=5,`only ${figures} figures`);
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#plot-csv')]);
    const lines=(await readFile(await download.path(),'utf8')).trim().split('\n');
    assert.equal(lines[0],toCsv({t:[]}).trim(),'CSV header');
    // The log is 100 Hz; the default example runs about 3 s.
    assert.ok(lines.length>200,`CSV has only ${lines.length} lines`);
  });
});

test('a program the parser rejects shows a line-numbered error and does not start',async()=>{
  await withLab('parse-error',{},async page=>{
    await page.selectOption('#experiment-mode','drive');
    await page.click('#code-tab');
    await page.fill('#code-editor','wait(1)\nfly()');
    await page.click('#run');
    await page.clock.runFor(300);
    assert.ok(await page.isVisible('#code-error'));
    assert.equal((await page.textContent('#code-error')).trim(),fill(en['parse.unknown'],{line:2}));
    assert.ok(await page.isHidden('#stage-outcome'));
    assert.equal((await page.textContent('#run-text')).trim(),en['run.start']);
  });
});

test('math on sensors: the P example runs, an unknown name is refused, and a division by zero stops on its line',async()=>{
  await withLab('math',{},async page=>{
    await page.click('#code-tab');
    await page.selectOption('#code-example','pturn');
    assert.match(await page.inputValue('#code-editor'),/drive\(0, 0\.05\*\(90 - heading\)\)/);
    await page.click('#run');
    assert.equal(await runToEnd(page),en['sim.complete']);
    await page.fill('#code-editor','let n = 0\nwhile n < 3\n  let n = n + 1\n  drive(0.1*n, 0)\n  wait(0.2)\nend\nstop()');
    await page.click('#run');
    assert.equal(await runToEnd(page),en['sim.complete']);
    await page.fill('#code-editor','drive(0.2, 2*speed)');
    await page.click('#run');
    await page.clock.runFor(300);
    assert.equal((await page.textContent('#code-error')).trim(),fill(en['parse.exprName'],{line:1,name:'speed',list:SENSORS.join(', ')}));
    await page.fill('#code-editor','drive(0.2, 0)\nwait(0.5)\ndrive(0.2, 1/(time - time))');
    await page.click('#run');
    assert.equal(await runToEnd(page),fill(en['sim.noValue'],{line:3}));
    assert.ok((await page.getAttribute('#stage-outcome','class')).includes('failed'));
  });
});

test('Experiment 02: a mission starter loads and the judge marks it not yet passed',async()=>{
  const stop=missionText(missionById('stop'),'en');
  await withLab('mission',{},async page=>{
    await page.click('[data-lesson="2"]');
    await page.click('[data-mission="stop"]');
    assert.equal(await page.inputValue('#code-editor'),stop.starter);
    await page.click('#run');
    await runToEnd(page);
    assert.equal((await page.textContent('#discovery-title')).trim(),fill(en['discovery.missionFail'],{title:stop.title}));
    assert.equal(await page.getAttribute('[data-mission="stop"]','aria-pressed'),'true');
  });
});

test('Experiment 03: a mission starts the rover near a wall, and the judge reads the true gap',async()=>{
  const park=missionText(missionById('park'),'en'),[before,after]=en['judge.park'].split('{gap}');
  await withLab('lesson3',{},async page=>{
    await page.click('[data-lesson="3"]');
    assert.equal((await page.textContent('#missions-eyebrow')).trim(),en['missions.eyebrow3']);
    assert.equal(await page.locator('#mission-list .mission').count(),2);
    await page.click('[data-mission="park"]');
    assert.equal(await page.inputValue('#code-editor'),park.starter);
    await page.click('#build-tab');
    await page.clock.runFor(300);
    // From this start the wall ahead is past the front sensor's 3 m range; from the center the box would read 0.84 m.
    assert.match(await page.textContent('#metric-tilt'),/^\s*3\.00/);
    await page.click('#run');
    await runToEnd(page);
    assert.equal((await page.textContent('#discovery-title')).trim(),fill(en['discovery.missionFail'],{title:park.title}));
    const copy=(await page.textContent('#discovery-copy')).trim();
    assert.ok(copy.startsWith(before)&&copy.includes(after),copy);
    // The experiment, the mission, and its start survive a reload.
    await page.reload();
    await page.clock.runFor(300);
    assert.equal(await page.getAttribute('[data-lesson="3"]','aria-pressed'),'true');
    assert.equal(await page.getAttribute('[data-mission="park"]','aria-pressed'),'true');
    assert.match(await page.textContent('#metric-tilt'),/^\s*3\.00/);
    // The saved run replays from its start: in the LiDAR CSV, the 270° beam sees the right wall 1.0 m away, not 2.5 m.
    await page.click('#plots-tab');
    await page.clock.runFor(300);
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#plot-lidar')]);
    const row=(await readFile(await download.path(),'utf8')).trim().split('\n')[1].split(',').map(Number);
    assert.ok(Math.abs(row[1+270]-1)<.05,`270° beam reads ${row[1+270]} m`);
    await page.click('[data-lesson="2"]');
    assert.equal((await page.textContent('#missions-eyebrow')).trim(),en['missions.eyebrow']);
    assert.equal(await page.locator('#mission-list .mission').count(),3);
  });
});

test('Turkish and French redraw the interface and the choice survives a reload',async()=>{
  await withLab('language',{},async page=>{
    for(const [code,dict] of [['tr',tr],['fr',fr]]){
      await page.selectOption('#language',code);
      await page.clock.runFor(100);
      assert.equal(await page.evaluate(()=>document.documentElement.lang),code);
      assert.equal(await page.title(),dict['doc.title']);
      assert.equal((await page.textContent('#run-text')).trim(),dict['run.start']);
    }
    await page.reload();
    await page.clock.runFor(200);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'fr');
    assert.equal(await page.inputValue('#language'),'fr');
  });
});

test('keyboard: ? opens the lab guide and Escape closes it',async()=>{
  await withLab('keyboard',{},async page=>{
    await page.locator('body').press('?');
    assert.ok(await page.evaluate(()=>document.getElementById('modal').open),'guide did not open');
    await page.keyboard.press('Escape');
    assert.ok(!(await page.evaluate(()=>document.getElementById('modal').open)),'guide did not close');
  });
});

// Chromium emulation of phone screens and touch. It does not stand in for a real phone or Safari.
for(const device of ['Pixel 7','Galaxy S9+']){
  test(`${device} emulation: no sideways scrolling on any tab, and a tap runs the drive program`,async()=>{
    const {defaultBrowserType,...descriptor}=pw.devices[device];
    await withLab(`phone-${device.replace(/\W+/g,'-')}`,descriptor,async page=>{
      for(const tab of ['build','code','plots','results']){
        await page.tap(`#${tab}-tab`);
        await page.clock.runFor(100);
        const {scroll,width}=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
        assert.ok(scroll<=width,`${tab} tab is ${scroll} px wide on a ${width} px screen`);
      }
      // Opening the Code tab switched the experiment to driving, so the tap runs the default program.
      assert.equal(await page.inputValue('#experiment-mode'),'drive');
      await page.tap('#build-tab');
      await page.tap('#run');
      assert.equal(await runToEnd(page),en['sim.complete']);
    });
  });
}
