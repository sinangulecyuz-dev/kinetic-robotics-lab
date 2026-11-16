// Builds docs/teacher-kit-{en,tr,fr}.html: four session plans with the missions, their starters, and checked reference solutions.
// Run `npm run kit` after changing a mission, a solution, or the kit's text; tests/teacher-kit.test.mjs fails while a file is stale.
// The kit is for teachers. It is written to docs, which is not served, and never to dist.
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DICTIONARIES,LANGUAGES} from '../dist/i18n.mjs';
import {MISSIONS,missionText} from '../dist/missions.mjs';
import {DEFAULT,PRESETS,criticalAngle,parseProgram} from '../dist/physics.mjs';
import {simulateRun} from '../dist/drive.mjs';
import {SOLUTIONS,DESIGNS} from '../tests/solutions.mjs';
import {KIT} from './teacher-kit-content.mjs';

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export const KIT_SEED=5;
// The numbers the kit quotes, taken from the model so the text cannot drift from it.
export function kitFacts(){
  const tip=d=>criticalAngle({...DEFAULT,...d}).toFixed(1),mission=id=>MISSIONS.find(m=>m.id===id);
  const fly=(m,code,wind=m.wind??null)=>m.judge(simulateRun({design:DEFAULT,robot:m.robot,terrain:m.terrain,program:parseProgram(code),seed:KIT_SEED,start:m.start,wind})).params;
  const wind=mission('wind'),park=mission('park'),round=v=>String(Math.round(Number(v)));
  return {
    a:{balanced:tip(PRESETS.balanced),tall:tip(PRESETS.tall),offset:tip(PRESETS.offset),left:tip({offset:20}),right:tip({offset:-20})},
    w:{wind:round(fly(wind,wind.starter).mean),calm:round(fly(wind,wind.starter,null).mean),pid:round(fly(wind,SOLUTIONS.wind).mean),max3:round(fly(wind,SOLUTIONS.wind.replace('1*sum','3*sum')).max)},
    p:{slow:round(fly(park,SOLUTIONS.park.replace('1*(','0.3*(')).gap)}
  };
}

export function teacherKit(lang,facts=kitFacts()){
  const ui=DICTIONARIES[lang],H=KIT.headings;
  // {ui:key} becomes the interface's label; {a.x} becomes a number from the model.
  const text=o=>esc(typeof o==='string'?o:o[lang]).replace(/\{ui:([\w.]+)\}/g,(m,k)=>{if(!(k in ui))throw new Error(`teacher kit: no interface text ${k}`);return `<b>${esc(ui[k])}</b>`;})
    .replace(/\{(\w)\.(\w+)\}/g,(m,g,k)=>{const v=facts[g]?.[k];if(v===undefined)throw new Error(`teacher kit: no fact ${g}.${k}`);return esc(v);});
  const h=k=>text(H[k]),list=items=>`<ul>${items.map(i=>`<li>${text(i)}</li>`).join('')}</ul>`,steps=items=>`<ol>${items.map(i=>`<li>${text(i)}</li>`).join('')}</ol>`;
  const lesson=n=>({title:ui[`lesson.${n}.title`],question:ui[`lesson.${n}.question`],concept:ui[`lesson.${n}.concept`]});
  const where=m=>{const parts=[ui['robot.'+m.robot],ui['terrain.'+m.terrain]];if(m.wind)parts.push(ui['wind.label'].replace('{speed}',m.wind.speed.toFixed(1)));return parts.map(esc).join(' · ');};
  const missionBlock=m=>{const t=missionText(m,lang),[flaw,why]=KIT.missions[m.id];
    return `<section class="mission"><h4>${esc(t.title)}</h4><p class="where">${h('setting')}: ${where(m)}</p><p><b>${h('missionGoal')}.</b> ${esc(t.goal)}</p>
<div class="cols"><div><h5>${h('starter')}</h5><pre>${esc(t.starter)}</pre><p>${text(flaw)}</p></div><div><h5>${h('solution')}</h5>${DESIGNS[m.id]?`<p class="where">${h('design')}: ${esc(ui['param.wheel'])} ${DESIGNS[m.id].wheel} cm · ${esc(ui['param.motor'])} × ${DESIGNS[m.id].motor} · ${esc(ui['param.chassis'])} ${DESIGNS[m.id].chassis} kg</p>`:''}<pre>${esc(SOLUTIONS[m.id])}</pre><p>${text(why)}</p></div></div></section>`;};
  const session=s=>{const L=lesson(s.experiment),ms=MISSIONS.filter(m=>m.experiment===s.experiment),n=String(s.experiment).padStart(2,'0');
    return `<article class="session"><header><span class="num">${n}</span><div><h2>${esc(L.title)}</h2><p class="q">${esc(L.question)}</p><p class="concept">${esc(L.concept)} · 40 ${h('min')}</p></div></header>
<h3>${h('goal')}</h3><p>${text(s.goal)}</p><h3>${h('idea')}</h3><p class="idea">${text(s.idea)}</p>
<h3>${h('flow')}</h3><table class="flow">${s.flow.map(([min,t])=>`<tr><th>${min} ${h('min')}</th><td>${text(t)}</td></tr>`).join('')}</table>
<h3>${h('ask')}</h3>${list(s.ask)}
<h3>${h('stuck')}</h3><table class="stuck"><tr><th>${h('sees')}</th><th>${h('say')}</th></tr>${s.stuck.map(([a,b])=>`<tr><td>${text(a)}</td><td>${text(b)}</td></tr>`).join('')}</table>
${ms.length?`<h3>${h('missions')}</h3>${ms.map(missionBlock).join('')}`:''}
<h3>${h('more')}</h3><p>${text(s.more)}</p></article>`;};
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${text(KIT.title)}</title>
<style>
body{font:14px/1.55 system-ui,"Segoe UI",Arial,sans-serif;color:#1d2938;margin:0 auto;max-width:860px;padding:28px 22px 60px}
h1{font-size:26px;margin:0 0 4px;letter-spacing:-.4px}h2{font-size:22px;margin:0}h3{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a8390;margin:22px 0 6px}
h4{font-size:15px;margin:0 0 2px}h5{font-size:12px;margin:10px 0 4px;color:#4f5b68}p{margin:6px 0}.sub{color:#56708a;margin:0 0 4px}.small{font-size:12px;color:#7a8390}
ul,ol{margin:6px 0;padding-left:22px}li{margin:4px 0}b{font-weight:600}
table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border:1px solid #dfe4e8;padding:6px 9px;text-align:left;vertical-align:top}
.flow th{width:64px;white-space:nowrap;background:#f6f8fa;font-weight:600}.stuck th{background:#f6f8fa;font-size:12px}.stuck td{width:50%}
.script td:first-child{font:12px ui-monospace,Menlo,monospace;white-space:nowrap;background:#f6f8fa}
pre{font:12px/1.5 ui-monospace,Menlo,monospace;background:#121c2b;color:#e8edf3;border-radius:8px;padding:10px 12px;margin:4px 0;white-space:pre-wrap}
.session{border-top:3px solid #f46a3c;margin-top:44px;padding-top:18px}.session header{display:flex;gap:16px;align-items:flex-start}
.num{font:700 30px/1 system-ui;color:#f46a3c;background:#fff3ec;border-radius:10px;padding:12px 14px}.q{font-size:15px;margin:2px 0}.concept{color:#7a8390;font-size:12px;margin:0}
.idea{background:#f1f8f5;border-left:3px solid #218b7d;padding:9px 12px;border-radius:0 8px 8px 0}
.mission{border:1px solid #dfe4e8;border-radius:10px;padding:12px 14px;margin:10px 0}.where{font-size:12px;color:#7a8390;margin:0 0 6px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:640px){.cols{grid-template-columns:1fr}}
@media print{body{max-width:none;padding:0;font-size:11.5px}.session{break-before:page;margin-top:0}.mission,tr{break-inside:avoid}pre{border:1px solid #999;background:#fff;color:#000}}
</style></head><body>
<h1>${text(KIT.title)}</h1><p class="sub">${text(KIT.subtitle)}</p><p class="small">${text(KIT.generated)}</p>
<h3>${h('start')}</h3>${list(KIT.start)}
<h3>${h('routine')}</h3>${steps(KIT.routine)}
<h3>${h('tools')}</h3>${list(KIT.tools)}
<h3>${h('honest')}</h3>${list(KIT.honest)}
<h3>${h('assess')}</h3>${list(KIT.assess)}
<h3>${h('script')}</h3><table class="script">${KIT.script.rows.map(([code,t])=>`<tr><td>${esc(code)}</td><td>${text(t)}</td></tr>`).join('')}</table>${list(KIT.script.notes)}
${KIT.sessions.map(session).join('\n')}
</body></html>
`;
}

export const kitPath=lang=>new URL(`../docs/teacher-kit-${lang}.html`,import.meta.url);
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const facts=kitFacts();
  for(const lang of Object.keys(LANGUAGES)){await writeFile(kitPath(lang),teacherKit(lang,facts));console.log(`Wrote ${fileURLToPath(kitPath(lang))}`);}
}
