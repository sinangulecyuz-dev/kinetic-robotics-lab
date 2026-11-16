// The teacher kit must match the lab: its missions, its checked solutions, and the numbers it quotes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {teacherKit,kitFacts,kitPath} from '../scripts/teacher-kit.mjs';
import {KIT} from '../scripts/teacher-kit-content.mjs';
import {LANGUAGES,DICTIONARIES} from '../dist/i18n.mjs';
import {MISSIONS,missionText} from '../dist/missions.mjs';
import {SOLUTIONS} from './solutions.mjs';

const facts=kitFacts(),langs=Object.keys(LANGUAGES),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

test('docs/teacher-kit-*.html are up to date; run npm run kit after changing a mission, a solution, or the kit text',()=>{
  for(const lang of langs)assert.equal(readFileSync(kitPath(lang),'utf8'),teacherKit(lang,facts),`teacher-kit-${lang}.html`);
});

test('every language has every session, mission, starter, and reference solution, with no placeholder left',()=>{
  for(const lang of langs){
    const html=teacherKit(lang,facts);
    assert.ok(!/\{(ui:)?[\w.]+\}/.test(html.replace(/<pre>[\s\S]*?<\/pre>/g,'')),`${lang}: an unfilled placeholder`);
    for(const n of [1,2,3,4])assert.ok(html.includes(esc(DICTIONARIES[lang][`lesson.${n}.title`])),`${lang}: session ${n}`);
    for(const m of MISSIONS){const t=missionText(m,lang);assert.ok(html.includes(esc(t.title))&&html.includes(esc(t.starter))&&html.includes(esc(SOLUTIONS[m.id])),`${lang}: mission ${m.id}`);assert.ok(KIT.missions[m.id],`notes for ${m.id}`);}
    assert.equal((html.match(/<article class="session">/g)||[]).length,4);
  }
  // Every text exists in all three languages.
  const walk=o=>{if(o&&typeof o==='object'){if('en' in o){for(const l of langs)assert.ok(typeof o[l]==='string'&&o[l].length>0,`missing ${l}: ${o.en}`);}else Object.values(o).forEach(walk);}};walk(KIT);
  for(const s of KIT.sessions)assert.equal(s.flow.reduce((t,[min])=>t+min,0),40,`session ${s.experiment} adds up to 40 minutes`);
});

test('the numbers the kit quotes are what the model gives',()=>{
  // Ramp: the balanced preset holds at the default 25° target, the other two do not, and the load helps on the raised side.
  assert.ok(Number(facts.a.balanced)>25&&Number(facts.a.tall)<25&&Number(facts.a.offset)<25);
  assert.ok(Number(facts.a.left)>Number(facts.a.balanced)&&Number(facts.a.right)<Number(facts.a.balanced));
  // Wind: calm halves the starter's miss but does not remove it; the sum brings it under the mission's limit; a gain of 3 swings more.
  const w=Object.fromEntries(Object.entries(facts.w).map(([k,v])=>[k,Number(v)]));
  assert.ok(w.wind>w.calm&&w.calm>=2,`wind ${w.wind} cm, calm ${w.calm} cm`);assert.ok(w.pid<w.calm&&w.pid<=2,`with the sum ${w.pid} cm`);assert.ok(w.max3>=7&&w.max3<10,`gain 3 swings to ${w.max3} cm`);
  assert.ok(Number(facts.p.slow)>52,`gain 0.3 is still at ${facts.p.slow} cm`);
});

test('the reference solutions stay out of the interface students use',()=>{
  const dist=new URL('../dist/',import.meta.url),files=[...readdirSync(dist),...readdirSync(new URL('lang/',dist)).map(f=>'lang/'+f)].filter(f=>/\.(mjs|js|html)$/.test(f));
  // One exception, by design: a later experiment may start from what an earlier one taught. Experiment 04's starter is Experiment 03's wall follower.
  const handedOn=id=>{const m=MISSIONS.find(x=>x.id===id);return MISSIONS.some(x=>x.experiment>m.experiment&&x.starter.includes(SOLUTIONS[id]));};
  assert.deepEqual(Object.keys(SOLUTIONS).filter(handedOn),['wall']);
  for(const f of files){const src=readFileSync(new URL(f,dist),'utf8');for(const [id,code] of Object.entries(SOLUTIONS))if(!(handedOn(id)&&f==='missions.mjs'))assert.ok(!src.includes(code)&&!src.includes(code.replace(/\n/g,'\\n')),`${f} holds the solution of ${id}`);}
  assert.ok(!readdirSync(dist).some(f=>f.startsWith('teacher-kit')));
});
