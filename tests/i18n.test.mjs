import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DICTIONARIES,LANGUAGES,t,setLanguage,language,preferredLanguage} from '../dist/i18n.mjs';
import {EXAMPLES,example} from '../dist/examples.mjs';
import {MISSIONS,missionText} from '../dist/missions.mjs';
import {parseProgram} from '../dist/physics.mjs';
import {TERRAINS,ROBOTS} from '../dist/drive.mjs';

const en=DICTIONARIES.en,source=f=>readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const placeholders=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
const snippets=s=>[...s.matchAll(/<code>([^<]*)<\/code>/g)].map(m=>m[1]).sort();
const codeLines=s=>s.split('\n').filter(l=>!l.startsWith('#'));

test('every language has exactly the English keys, with the same placeholders',()=>{
  assert.deepEqual(Object.keys(LANGUAGES).sort(),Object.keys(DICTIONARIES).sort());
  for(const [lang,dict] of Object.entries(DICTIONARIES)){
    assert.deepEqual(Object.keys(dict).sort(),Object.keys(en).sort(),lang);
    for(const [key,text] of Object.entries(dict)){
      assert.equal(typeof text,'string',`${lang} ${key}`);assert.ok(text.trim(),`${lang} ${key} is empty`);
      assert.deepEqual(placeholders(text),placeholders(en[key]),`${lang} ${key}`);
      assert.ok(!text.includes('${'),`${lang} ${key} has a stray template expression`);
    }
  }
});

test('code in the help text keeps its English commands and sensor names',()=>{
  for(const [lang,dict] of Object.entries(DICTIONARIES))for(const key of Object.keys(en))
    assert.deepEqual(snippets(dict[key]),snippets(en[key]),`${lang} ${key}`);
});

test('examples and mission starters run the same code in every language, under translated comments',()=>{
  for(const lang of Object.keys(LANGUAGES)){
    for(const name of Object.keys(EXAMPLES)){
      const code=example(name,lang);
      assert.deepEqual(codeLines(code),codeLines(EXAMPLES[name]),`${name} in ${lang}`);
      if(lang!=='en')assert.notEqual(code,EXAMPLES[name],`${name} has ${lang} comments`);
      assert.deepEqual(parseProgram(code),parseProgram(EXAMPLES[name]));
    }
    for(const m of MISSIONS){
      const x=missionText(m,lang);
      assert.deepEqual(codeLines(x.starter),codeLines(m.starter),`${m.id} in ${lang}`);
      for(const k of ['title','goal','lesson'])assert.ok(x[k]&&(lang==='en'||x[k]!==m[k]),`${m.id} ${k} in ${lang}`);
    }
  }
});

test('every key the interface asks for exists in English, and every English key is used',()=>{
  const app=source('app.js'),plots=source('plots.mjs'),html=source('index.html');
  const used=new Set();
  // Literal keys: any quoted word.word string in the interface code, and data-i18n attributes in the page.
  for(const s of [app,plots])for(const m of s.matchAll(/'([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)'/g))if(!m[1].endsWith('.mjs'))used.add(m[1]);
  for(const m of html.matchAll(/data-i18n(?:-html|-aria|-title)?="([^"]+)"/g))used.add(m[1]);
  // Keys built at run time: simulator, parser and judge messages, lesson and discovery texts, robot and terrain names.
  for(const m of source('drive.mjs').matchAll(/'(sim\.\w+)'/g))used.add(m[1]);
  for(const m of source('physics.mjs').matchAll(/['`],'(\w+)'(?:,\{[^}]*\})?\)/g))used.add('parse.'+m[1]);
  for(const m of source('missions.mjs').matchAll(/'(judge\.\w+)'/g))used.add(m[1]);
  for(const n of [1,2,3,4])for(const k of ['time','title','question','concept','aria'])used.add(`lesson.${n}.${k}`);
  for(const d of ['balanced','tall','offset','lesson2','lesson3','lesson4','tiltPass','tiltFail','drive'])for(const k of ['title','copy'])used.add(`discovery.${d}.${k}`);
  for(const id of Object.keys(TERRAINS))used.add('terrain.'+id).add('surface.'+id);
  for(const id of Object.keys(ROBOTS))used.add('robot.'+id);
  for(const name of ['guide','model','reference','path','lesson1','lesson2','lesson3','lesson4','margin'])for(const k of ['eyebrow','html'])used.add(`modal.${name}.${k}`);
  const missing=[...used].filter(k=>!(k in en));
  assert.deepEqual(missing,[],'keys used but not defined');
  assert.deepEqual(Object.keys(en).filter(k=>!used.has(k)),[],'keys defined but never used');
  assert.ok(used.has('parse.unknownSensor')&&used.has('sim.tipRight')&&used.has('judge.square'));
});

test('t fills placeholders, falls back to English, and picks the browser language',()=>{
  try{
    setLanguage('tr');assert.equal(language(),'tr');
    assert.equal(t('code.finished',{message:'Durdu.',time:'2.0'}),'Durdu. · 2.0 s');
    assert.equal(t('parse.waitRange',{line:3}),'Satır 3: 0.05 ile 10 saniye arası bekle.');
    assert.equal(t('no.such.key'),'no.such.key');
    assert.equal(setLanguage('de'),'en');
    assert.equal(preferredLanguage(['fr-FR','en-US']),'fr');
    assert.equal(preferredLanguage(['de-DE','tr']),'tr');
    assert.equal(preferredLanguage(['de-DE']),'en');
    assert.equal(preferredLanguage([]),'en');
  }finally{setLanguage('en');}
});
