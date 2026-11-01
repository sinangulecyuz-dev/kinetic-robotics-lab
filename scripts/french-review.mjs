// Builds docs/french-review.html: every French text in the lab beside its English source, for a native speaker to review.
// Run `npm run review:fr` after changing any French text; tests/french-review.test.mjs fails while the file is stale.
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DICTIONARIES} from '../dist/i18n.mjs';
import {MISSIONS,missionText} from '../dist/missions.mjs';
import {EXAMPLES,example} from '../dist/examples.mjs';

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// Keys ending in .html hold the lab's own markup, shown rendered; every other text is shown as plain text.
const show=(key,text)=>key.endsWith('.html')?`<div class="rich">${text}</div>`:esc(text);
const comments=src=>src.split('\n').filter(l=>l.startsWith('#')).map(l=>l.slice(1).trim());
const row=(key,en,fr)=>`<tr><td class="key">${esc(key)}</td><td>${en}</td><td lang="fr">${fr}</td><td class="note"></td></tr>`;
const table=rows=>`<table><thead><tr><th>Key</th><th>English</th><th>Français</th><th>Notes</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;

export function frenchReview(){
  const en=DICTIONARIES.en,fr=DICTIONARIES.fr,groups=new Map();
  for(const key of Object.keys(en)){const g=key.split('.')[0];if(!groups.has(g))groups.set(g,[]);groups.get(g).push(row(key,show(key,en[key]),show(key,fr[key])));}
  const missions=MISSIONS.flatMap(m=>{const e=missionText(m,'en'),f=missionText(m,'fr');
    return [['title',e.title,f.title],['goal',e.goal,f.goal],['hint 1, idea',e.lesson,f.lesson],['hint 2, tool',e.tool,f.tool],['hint 3, code shape',e.skeleton,f.skeleton],
      ...comments(e.starter).map((c,i)=>[`starter comment ${i+1}`,c,comments(f.starter)[i]??''])].map(([k,a,b])=>row(`${m.id} · ${k}`,`<pre>${esc(a)}</pre>`,`<pre>${esc(b)}</pre>`));});
  const examples=Object.keys(EXAMPLES).flatMap(name=>{const e=comments(example(name,'en')),f=comments(example(name,'fr'));return e.map((c,i)=>row(`${name} · comment ${i+1}`,esc(c),esc(f[i]??'')));});
  const count=Object.keys(en).length+missions.length+examples.length;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kinetic — French review</title>
<style>
body{font:13px/1.5 system-ui,sans-serif;color:#1e2a36;margin:24px;max-width:1200px}h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:28px 0 8px}
.intro{background:#f6f8fa;border:1px solid #e3e8ec;border-radius:8px;padding:12px 16px;margin:12px 0 20px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #dfe4e8;padding:6px 8px;vertical-align:top;text-align:left;word-wrap:break-word}
th{background:#f0f3f5;font-size:12px}th:nth-child(1){width:16%}th:nth-child(4){width:16%}td.key{font:11px ui-monospace,monospace;color:#56708a}
pre{margin:0;white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace}.rich h2{font-size:13px;margin:0 0 4px}.rich p,.rich ul,.rich ol{margin:4px 0}
@media print{body{margin:0}tr{break-inside:avoid}}
</style></head><body>
<h1>Kinetic Robotics Lab — French review</h1>
<p>${count} texts, generated from the lab's source by <code>npm run review:fr</code>.</p>
<div class="intro" lang="fr"><p><strong>Merci de relire chaque texte français.</strong> Écrivez vos corrections dans la colonne Notes. Ce laboratoire s’adresse à des lycéens : un ton simple et direct, au tutoiement, est voulu.</p>
<p>Choix voulus, à ne pas corriger : les nombres décimaux s’écrivent avec un point (0.5), comme dans le code et dans MATLAB ; les mots du langage du rover (<code>drive</code>, <code>wait</code>, <code>while</code>…), les noms de capteurs (<code>lidar_left</code>…) et les noms de colonnes CSV restent en anglais ; les textes entre accolades, comme <code>{line}</code>, sont remplacés par des valeurs et ne se traduisent pas.</p></div>
<h2>Missions and hints</h2>${table(missions)}
<h2>Example script comments</h2>${table(examples)}
${[...groups].map(([g,rows])=>`<h2>Interface · ${esc(g)}</h2>${table(rows)}`).join('\n')}
</body></html>
`;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const out=new URL('../docs/french-review.html',import.meta.url);
  await writeFile(out,frenchReview());console.log(`Wrote ${fileURLToPath(out)}`);
}
