import {DEFAULT,PRESETS,balance,criticalAngle,parseProgram} from './physics.mjs';
import {DriveSim,simulateRun,toCsv,toScanCsv,terrainHeight,rangeTo,TERRAINS,ENVIRONMENTS,WIND,OBSTACLE,CASTER,ROBOTS,TB3_FIT,LIDAR,WALL} from './drive.mjs';
import {Figure,COLORS} from './plots.mjs';
import {MISSIONS,missionById,missionsFor,missionText} from './missions.mjs';
import {EXAMPLES,example} from './examples.mjs';
import {t,setLanguage,language,preferredLanguage,LANGUAGES} from './i18n.mjs';
import {skyAt,drawSky} from './sky.mjs';

const $=id=>document.getElementById(id);
const icons={
  box:'<path d="m12 3 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8M7 5.5l9 5"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  book:'<path d="M12 6c-3-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15"/>',
  chart:'<path d="M4 3v17h17M8 15v-4m5 4V6m5 9v-7"/>',
  sliders:'<path d="M4 6h5m4 0h7M4 12h10m4 0h2M4 18h2m4 0h10"/><circle cx="11" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  play:'<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  reset:'<path d="M3 10a9 9 0 1 1 1 7M3 3v7h7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><circle cx="12" cy="12" r="3"/>',
  top:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  robot:'<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M1 11v5m22-5v5M8 22v-3m8 3v-3M8 11h1m6 0h1m-7 5h6"/><circle cx="12" cy="2" r="1"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2.5M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  bulb:'<path d="M9 18h6m-6 3h6M8 15a7 7 0 1 1 8 0l-1 3H9Zm4-13v1"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  wave:'<path d="M3 12h3.5l2.5-7 4 14 3-9 1.5 2H21"/>',
  download:'<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.box}</svg>`;}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

setLanguage(preferredLanguage(navigator.languages||[navigator.language]));
let p={...DEFAULT},records=[],code=null,terrain='flat',robot='kinetic',lesson=1,mission=null,missionsDone=[],environment='indoor',windOn=true;
try{const saved=JSON.parse(localStorage.getItem('kinetic-v1')||'null');if(saved){if(LANGUAGES[saved.language])setLanguage(saved.language);if([2,3,4].includes(saved.lesson))lesson=saved.lesson;if(missionById(saved.mission))mission=saved.mission;if(Array.isArray(saved.missionsDone))missionsDone=saved.missionsDone.filter(id=>missionById(id));for(const k of Object.keys(DEFAULT)){const input=$(k),v=Number(saved.design?.[k]);if(Number.isFinite(v))p[k]=Math.max(+input.min,Math.min(+input.max,v));}if(typeof saved.code==='string'&&saved.code.length<15000)code=saved.code;if(TERRAINS[saved.terrain])terrain=saved.terrain;if(ENVIRONMENTS[saved.environment])environment=saved.environment;if(typeof saved.windOn==='boolean')windOn=saved.windOn;if(!ENVIRONMENTS[environment].includes(terrain))environment=ENVIRONMENTS.outdoor.includes(terrain)?'outdoor':'indoor';if(ROBOTS[saved.robot])robot=saved.robot;if(Array.isArray(saved.records))records=saved.records.slice(0,30).filter(r=>r&&['tilt','drive'].includes(r.mode)&&r.design&&typeof r.message==='string');}}catch{}
// Labels in the chosen language. An unedited example or mission starter follows that language.
const robotLabel=id=>t('robot.'+id),terrainLabel=id=>t('terrain.'+id),terrainLower=id=>terrainLabel(id).toLocaleLowerCase(language()),mt=m=>missionText(m,language());
function translateCode(src,to){for(const l of Object.keys(LANGUAGES)){for(const name of Object.keys(EXAMPLES))if(example(name,l)===src)return example(name,to);for(const m of MISSIONS)if(missionText(m,l).starter===src)return missionText(m,to).starter;}return src;}
code=code===null?example('turn',language()):translateCode(code,language());
let tab='build',mode='tilt',prediction=null,showCom=true,showSupport=true,showOdom=true,showLidar=true,showFused=true;
let state={status:'idle',angle:0,time:0,tip:0,targetTip:0,minMargin:1,runDesign:null};
// sim is the drive run in progress; idle is a parked rover that only places the model on the terrain.
let sim=null,idle=null,idleKey='',toastTimer,figures=[],plotCache=new Map(),plotRunId=null,plotted=null,lastPlot=0;
const canvas=$('scene'),ctx=canvas.getContext('2d');
// Camera from behind the rover, so its own left is on screen left, matching wheels(left, right) and the sensors.
const VIEW_YAW=Math.PI+.73;
let cw=800,ch=536,zoom=1,yaw=VIEW_YAW,elevation=0.43,drag=null,lastFrame=0,needsRender=true;
// A mission of the current experiment can place the rover near a wall; otherwise it starts at the center.
function startPose(){const m=lesson>1?missionById(mission):null;return m?.experiment===lesson&&m.start?m.start:null;}
// Wind blows only outdoors with the switch on: a mission's own wind, or a random one chosen from each run's seed.
function windOption(){if(environment!=='outdoor'||!windOn)return null;const m=lesson>1?missionById(mission):null;return m?.experiment===lesson&&m.wind?m.wind:true;}
function view(){if(sim)return sim;const start=startPose(),key=JSON.stringify([p,start])+terrain+robot;if(key!==idleKey){idle=new DriveSim({design:p,terrain,robot,noise:false,start});idleKey=key;}return idle;}
const terrainOf=r=>TERRAINS[r?.terrain]?r.terrain:'flat',robotOf=r=>ROBOTS[r?.robot]?r.robot:'kinetic',tb3=()=>robot==='turtlebot3';
function persist(){try{localStorage.setItem('kinetic-v1',JSON.stringify({design:p,code:$('code-editor').value,terrain,environment,windOn,robot,lesson,mission,missionsDone,records,language:language()}));show('save-status',()=>t('header.saved'));}catch{show('save-status',()=>t('header.saveFailed'));}}
// Text that depends on the language is kept as a function, so a language change can redraw it.
const shown=new Map();
function redraw(id){const {text,html}=shown.get(id),s=text();if(html)$(id).innerHTML=s;else $(id).textContent=s;}
function show(id,text,html=false){shown.set(id,{text,html});redraw(id);}
const discover=(title,copy)=>{show('discovery-title',title);show('discovery-copy',copy);};
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function changeTab(next){tab=next;document.body.dataset.tab=next;for(const t of ['build','code','plots','results']){$(`${t}-tab`).classList.toggle('active',t===next);$(`${t}-tab`).setAttribute('aria-selected',t===next);}$('code-panel').hidden=next!=='code';$('plots-panel').hidden=next!=='plots';$('results-panel').hidden=next!=='results';if(next==='code'&&mode!=='drive')changeMode('drive');if(next==='results')renderResults();if(next==='plots')renderPlots();needsRender=true;}
['build','code','plots','results'].forEach(t=>$(`${t}-tab`).onclick=()=>changeTab(t));
function updateInputs(){
  for(const k of Object.keys(DEFAULT)){
    const el=$(k);el.value=p[k];const unit=k==='mass'?'kg':k==='target'?'°':'cm';
    $(`${k}-output`).innerHTML=k==='offset'?(p[k]?`${Math.abs(p[k])} <small>${t(p[k]>0?'offset.left':'offset.right')}</small>`:`0 <small>${t('offset.center')}</small>`):`${k==='mass'?p[k].toFixed(1):p[k]} <small>${unit}</small>`;
    el.style.background=`linear-gradient(${el.dir==='rtl'?'to left':'to right'},var(--orange) ${(p[k]-el.min)/(el.max-el.min)*100}%,#e9ecef ${(p[k]-el.min)/(el.max-el.min)*100}%)`;
  }
  document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',Object.keys(p).every(k=>p[k]===PRESETS[b.dataset.preset][k])));
  needsRender=true;
}
for(const k of Object.keys(DEFAULT))$(k).addEventListener('input',e=>{if(['running','paused','done'].includes(state.status))reset();p[k]=Number(e.target.value);updateInputs();persist();updateTelemetry();});
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{reset();p={...PRESETS[b.dataset.preset]};updateInputs();persist();updateTelemetry();const d=b.dataset.preset;discover(()=>t(`discovery.${d}.title`),()=>t(`discovery.${d}.copy`));});
for(const [id,value] of [['predict-stable','stable'],['predict-tip','tip']])$(id).onclick=()=>{if(state.status==='running'||state.status==='paused'){toast(t('toast.resetFirst'));return;}prediction=prediction===value?null:value;updatePrediction();};
function updatePrediction(){ $('predict-stable').setAttribute('aria-pressed',prediction==='stable');$('predict-tip').setAttribute('aria-pressed',prediction==='tip');}
$('show-com').onchange=e=>{showCom=e.target.checked;needsRender=true;};$('show-support').onchange=e=>{showSupport=e.target.checked;needsRender=true;};$('show-odom').onchange=e=>{showOdom=e.target.checked;needsRender=true;};$('show-lidar').onchange=e=>{showLidar=e.target.checked;needsRender=true;};$('show-fused').onchange=e=>{showFused=e.target.checked;needsRender=true;};
$('experiment-mode').onchange=e=>changeMode(e.target.value);
const driveNote=()=>t(tb3()?'note.tb3':'note.kinetic',{surface:t('surface.'+terrain),mu:TERRAINS[terrain].muPeak,battery:TB3_FIT.battery}),modelNote=()=>mode==='tilt'?t('note.tilt'):driveNote();
// The TurtleBot3 has a fixed, datasheet geometry and only drives; the builder sliders and the ramp belong to the Kinetic rover.
function setRobot(next){
  if(!ROBOTS[next])return;if(state.status!=='idle')reset();robot=next;const isTb3=tb3();
  $('experiment-mode').querySelector('option[value=tilt]').disabled=isTb3;if(isTb3&&mode==='tilt')changeMode('drive');
  for(const id of ['preset-row','structure-section','payload-section'])$(id).hidden=isTb3;$('robot-note').hidden=!isTb3;
  show('robot-name',()=>t(tb3()?'robotName.tb3':'robotName.kinetic'),true);
  show('stage-title',()=>tb3()?robotLabel('turtlebot3'):t('stage.kinetic'));
  show('model-note',modelNote);updateTelemetry();needsRender=true;
}
function changeMode(next){reset();mode=next;$('experiment-mode').value=next;$('tilt-setting').hidden=next!=='tilt';$('drive-setting').hidden=next!=='drive';$('odom-row').hidden=$('lidar-row').hidden=$('fused-row').hidden=next!=='drive';document.querySelector('.prediction-card').hidden=next==='drive';modeText();
  updateTelemetry();needsRender=true;}
function modeText(){
  show('model-note',modelNote);show('stage-subtitle',()=>t(mode==='tilt'?'stage.subtitle.tilt':'stage.subtitle.drive'));
  const keys=mode==='drive'?['metric.speed','metric.slip','metric.front']:['metric.mass','metric.comHeight','metric.tilt'];['metric-mass','metric-height','metric-tilt'].forEach((id,i)=>$(id).previousElementSibling.textContent=t(keys[i]));
}
function setTerrain(next){
  if(!TERRAINS[next])return;if(state.status!=='idle')reset();terrain=next;
  document.querySelectorAll('[data-terrain]').forEach(b=>{b.classList.toggle('active',b.dataset.terrain===next);b.setAttribute('aria-pressed',b.dataset.terrain===next);});
  show('terrain-note',()=>{const T=TERRAINS[terrain],w=windOption();return t('terrain.note',{surface:t('surface.'+terrain),peak:T.muPeak,slide:T.muSlide,crr:T.crr,bumps:T.bumps?t('terrain.bumps',{cm:Math.round(2*T.bumps)}):''})+(w===true?' '+t('wind.noteRandom',{min:WIND.minMean,max:WIND.maxMean}):w?' '+t('wind.noteMission',{speed:w.speed}):'');});
  show('model-note',modelNote);updateTelemetry();needsRender=true;
}
document.querySelectorAll('[data-terrain]').forEach(b=>b.onclick=()=>{setTerrain(b.dataset.terrain);persist();});
// Indoor offers concrete and ice; outdoor offers grass, gravel, and ice, and a wind switch.
function setEnvironment(next){
  if(!ENVIRONMENTS[next])return;if(state.status!=='idle')reset();environment=next;
  document.querySelectorAll('[data-environment]').forEach(b=>{b.classList.toggle('active',b.dataset.environment===next);b.setAttribute('aria-pressed',b.dataset.environment===next);});
  document.querySelectorAll('[data-terrain]').forEach(b=>b.hidden=!ENVIRONMENTS[next].includes(b.dataset.terrain));
  $('wind-row').hidden=next!=='outdoor';$('wind-on').checked=windOn;
  setTerrain(ENVIRONMENTS[next].includes(terrain)?terrain:ENVIRONMENTS[next][0]);
}
document.querySelectorAll('[data-environment]').forEach(b=>b.onclick=()=>{setEnvironment(b.dataset.environment);persist();});
$('wind-on').onchange=e=>{if(state.status!=='idle')reset();windOn=e.target.checked;setTerrain(terrain);persist();};
function setLesson(n,user=true){
  lesson=[2,3,4].includes(n)?n:1;if(missionById(mission)?.experiment!==lesson)mission=null;
  document.querySelectorAll('[data-lesson]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.lesson===lesson));
  for(const [id,k] of [['lesson-time','time'],['lesson-title','title'],['lesson-question','question'],['lesson-concept-text','concept']])show(id,()=>t(`lesson.${lesson}.${k}`));
  const d=lesson>1?'lesson'+lesson:'balanced';discover(()=>t(`discovery.${d}.title`),()=>t(`discovery.${d}.copy`));$('mission-card').hidden=lesson===1;renderMissions();needsRender=true;
  if(user){if(lesson===1){setRobot('kinetic');changeMode('tilt');changeTab('build');}else changeMode('drive');persist();}
  // Experiments 02 to 04 are driving experiments, also after a reload.
  else if(lesson>1&&mode!=='drive')changeMode('drive');
}
document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>setLesson(+b.dataset.lesson));
// Status carries a label as well as a color, so it never depends on color alone.
function renderMissions(){
  show('missions-eyebrow',()=>t(lesson===4?'missions.eyebrow4':lesson===3?'missions.eyebrow3':'missions.eyebrow'));show('missions-title',()=>t(lesson===4?'missions.title4':lesson===3?'missions.title3':'missions.title'));
  $('mission-list').innerHTML=missionsFor(lesson).map(m=>{const done=missionsDone.includes(m.id);return `<button class="mission" data-mission="${m.id}" aria-pressed="${mission===m.id}"><span>${esc(mt(m).title)}<small>${esc(t('missions.ground',{robot:robotLabel(m.robot),terrain:terrainLower(m.terrain)}))}</small></span><span class="mission-status${done?' done':''}">${t(done?'missions.done':'missions.todo')}</span></button>`;}).join('');
  document.querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>loadMission(b.dataset.mission));
  show('mission-goal',()=>{const m=missionById(mission);return m?mt(m).goal:t('missions.pick');});
}
function loadMission(id){
  const m=missionById(id);if(!m)return;mission=id;setRobot(m.robot);if(m.wind)windOn=true;setEnvironment(m.wind?'outdoor':ENVIRONMENTS.indoor.includes(m.terrain)?'indoor':'outdoor');setTerrain(m.terrain);changeMode('drive');
  $('code-editor').value=mt(m).starter;updateLines();renderMissions();persist();changeTab('code');needsRender=true;
  discover(()=>t('discovery.mission',{title:mt(m).title}),()=>mt(m).goal);
  toast(t('toast.missionLoaded'));
}
function reset(){state={status:'idle',angle:0,time:0,tip:0,targetTip:0,minMargin:1,runDesign:null};sim=null;$('stage-outcome').hidden=true;$('code-error').hidden=true;show('code-progress',()=>t('code.idle'));setRunButton();updateTelemetry();needsRender=true;}
function setRunButton(){const running=state.status==='running',paused=state.status==='paused';$('run').innerHTML=icon(running?'pause':'play')+`<span id="run-text">${t(running?'run.pause':paused?'run.resume':'run.start')}</span>`;$('scene-status').innerHTML=`<i></i>${t(running?'status.running':paused?'status.paused':state.status==='done'?'status.done':'status.ready')}`;}
$('reset').onclick=()=>{reset();toast(t('toast.reset'));};
$('run').onclick=()=>{
  if(state.status==='running'){state.status='paused';setRunButton();return;}
  if(state.status==='paused'){state.status='running';setRunButton();return;}
  reset();
  if(mode==='drive'){
    let program;try{program=parseProgram($('code-editor').value);}catch(e){changeTab('code');show('code-error',()=>e.key?t('parse.'+e.key,{line:e.line,...e.params}):e.message);$('code-error').hidden=false;toast(t('toast.checkProgram'));return;}
    if(!tb3()&&!balance(p,0).stable){toast(t('toast.unbalanced'));return;}
    sim=new DriveSim({design:{...p},terrain,robot,program,seed:Math.random()*2**32>>>0,start:startPose(),wind:windOption()});
  }
  state.status='running';state.runDesign={...p};state.minMargin=balance(p,0).margin;state.runPrediction=prediction;setRunButton();needsRender=true;
};
// key and params name the outcome message, so it can be shown again in another language.
function finish(success,key,params={}){
  const message=()=>t(key,params);
  state.status='done';state.l=0;state.r=0;setRunButton();
  $('stage-outcome').hidden=false;$('stage-outcome').classList.toggle('failed',!success);show('stage-outcome',message);
  if(mode==='drive'){const time=sim.time.toFixed(1);show('code-progress',()=>t('code.finished',{message:message(),time}));}
  // A mission is judged only on the robot and ground it was written for, using the simulator's ground truth.
  const picked=mode==='drive'&&lesson>1?missionById(mission):null,m=picked?.experiment===lesson?picked:null,judged=m&&sim.robot===m.robot&&sim.terrain===m.terrain&&JSON.stringify(sim.windOption)===JSON.stringify(m.wind??null)?m.judge(sim):null;
  if(judged?.pass&&!missionsDone.includes(m.id))missionsDone.push(m.id);
  const drive=mode==='drive'?{terrain:sim.terrain,robot:sim.robot,seed:sim.seed,start:sim.origin,wind:sim.windOption,odomError:sim.summary().odomError,...(judged?{mission:m.id,missionPass:judged.pass}:{})}:{};
  const record={id:Date.now(),mode,design:{...state.runDesign},success,message:message(),messageKey:key,messageParams:params,angle:state.angle,time:mode==='drive'?sim.time:state.time,margin:state.minMargin,prediction:state.runPrediction||null,code:mode==='drive'?$('code-editor').value:null,...drive};
  if(mode==='drive'){plotCache.set(record.id,{sim,replayed:false});plotRunId=record.id;}
  records.unshift(record);records=records.slice(0,30);persist();renderResults();if(tab==='plots')renderPlots();
  const d=mode==='tilt'?(success?'tiltPass':'tiltFail'):'drive';discover(()=>t(`discovery.${d}.title`),()=>t(`discovery.${d}.copy`));
  if(judged){
    const result=()=>judged.key==='judge.early'?t('judge.early',{message:message()}):t(judged.key,judged.params);
    discover(()=>t(judged.pass?'discovery.missionPass':'discovery.missionFail',{title:mt(m).title}),()=>judged.pass?t('discovery.missionPassCopy',{result:result()}):`${result()} ${mt(m).lesson}`);
    toast(t(judged.pass?'toast.missionPass':'toast.missionFail'));renderMissions();
  }else if(m)show('discovery-copy',()=>t('discovery.notJudged',{title:mt(m).title,robot:robotLabel(m.robot),terrain:terrainLower(m.terrain)}));
}
function tick(dt){
  if(state.status==='running'){
    state.time+=dt;
    if(mode==='tilt'){
      const threshold=criticalAngle(p);state.angle=Math.min(p.target,state.angle+dt*5);
      if(state.angle>=threshold){state.angle=threshold;state.targetTip=1;state.minMargin=Math.min(state.minMargin,0);finish(false,'tilt.lost',{angle:threshold.toFixed(1)});}
      else{state.minMargin=Math.min(state.minMargin,balance(p,state.angle).margin);if(state.angle>=p.target)finish(true,'tilt.balanced',{angle:p.target});}
    }else{sim.advance(dt);if(sim.status==='done')finish(sim.success,sim.messageKey,sim.messageParams);else if(tab==='plots'&&performance.now()-lastPlot>250)renderPlots();}
    updateTelemetry();needsRender=true;
  }
  if(Math.abs(state.tip-state.targetTip)>.001){state.tip+=(state.targetTip-state.tip)*Math.min(1,dt*4);needsRender=true;}
}
function setMargin(m){$('metric-margin').innerHTML=`${m>=0?'+':''}${(m*100).toFixed(1)} <small>cm</small>`;$('metric-margin').style.color=m<=.001?'#ca6544':m<.02?'#b9954e':'#308574';}
function updateTelemetry(){
  if(mode==='drive'){
    const v=view();$('metric-mass').innerHTML=`${v.speed.toFixed(2)} <small>m/s</small>`;$('metric-height').innerHTML=`${v.maxSlip.toFixed(2)} <small>m/s</small>`;setMargin(v.margin);$('metric-tilt').innerHTML=`${v.range.toFixed(2)} <small>m</small>`;
    if(sim&&state.status==='running'){const line=sim.line,time=sim.time.toFixed(1),range=sim.range.toFixed(2);show('code-progress',()=>t('code.running',{line,time,range}));}
    return;
  }
  const b=balance(p,state.angle);$('metric-mass').innerHTML=`${b.com.mass.toFixed(1)} <small>kg</small>`;$('metric-height').innerHTML=`${(b.com.y*100).toFixed(1)} <small>cm</small>`;
  setMargin(b.margin);$('metric-tilt').innerHTML=`${state.angle.toFixed(1)}<small>°</small>`;
}
// Saved runs carry a message key; older runs only have their English message.
const recordMessage=r=>typeof r.messageKey==='string'&&r.messageParams&&typeof r.messageParams==='object'?t(r.messageKey,r.messageParams):r.message;
function renderResults(){
  $('result-count').textContent=records.length;
  if(!records.length){$('results-list').innerHTML=`<div class="empty-state">${t('results.empty')}<br><button class="text-button" id="back-build">${t('results.backBuild')}</button></div>`;$('back-build').onclick=()=>changeTab('build');return;}
  $('results-list').innerHTML=records.map((r,i)=>`<article class="result-card"><div class="result-card-top"><h4>${t(r.mode==='tilt'?'results.ramp':'results.program')} <span style="color:#a5afb9;font-size:9px"> / ${records.length-i}</span></h4><span class="result-badge ${r.success?'':'fail'}">${t(r.success?'results.completed':r.mode==='tilt'?'results.tipped':'results.stopped')}</span></div><p>${esc(recordMessage(r))} ${r.mode==='tilt'?(r.prediction?`${t('results.prediction',{prediction:t(r.prediction==='stable'?'results.predHold':'results.predTip')})} ${t(((r.prediction==='stable')===r.success)?'results.matched':'results.surprise')}`:t('results.noPrediction')):''}</p><div class="result-specs">${robotOf(r)==='turtlebot3'?robotLabel('turtlebot3'):t('results.kineticSpecs',{width:Number(r.design.width),mass:Number(r.design.mass).toFixed(1),height:Number(r.design.height),offset:Number(r.design.offset)})}${r.mode==='drive'?`${t('results.driveSpecs',{terrain:terrainLower(terrainOf(r)),time:Number(r.time).toFixed(1)})}${Number.isFinite(r.odomError)?t('results.odomError',{error:(r.odomError*100).toFixed(1)}):''}${r.mission&&missionById(r.mission)?t('results.mission',{title:esc(mt(missionById(r.mission)).title),status:t(r.missionPass?'results.passed':'results.notYet')}):''}`:t('results.target',{target:Number(r.design.target)})}</div><div class="result-actions"><button class="text-button" data-restore="${i}">${t('results.restore')}</button>${r.mode==='drive'?`<button class="text-button" data-plot="${i}">${t('results.openPlots')}</button>`:''}</div></article>`).join('');
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const r=records[+b.dataset.restore];reset();p={...DEFAULT,...r.design};setRobot(robotOf(r));changeMode(r.mode);if(r.mode==='drive')setTerrain(terrainOf(r));if(r.code){$('code-editor').value=r.code;updateLines();}updateInputs();updateTelemetry();persist();changeTab(r.mode==='drive'?'code':'build');toast(t('toast.restored'));});
  document.querySelectorAll('[data-plot]').forEach(b=>b.onclick=()=>{plotRunId=records[+b.dataset.plot].id;changeTab('plots');});
}
// Plots come from the live run, or are regenerated from a saved run's design, terrain, script, and seed.
function plotSource(){
  if(sim&&['running','paused'].includes(state.status))return {sim,label:t('plots.live'),name:'current'};
  const drives=records.filter(r=>r.mode==='drive');if(!drives.length)return null;
  const r=drives.find(x=>x.id===plotRunId)||drives[0],n=records.length-records.indexOf(r);plotRunId=r.id;
  if(!plotCache.has(r.id)){try{plotCache.set(r.id,{sim:simulateRun({design:{...DEFAULT,...r.design},terrain:terrainOf(r),robot:robotOf(r),program:parseProgram(r.code||''),seed:Number.isFinite(r.seed)?r.seed:r.id>>>0,start:r.start,wind:r.wind}),replayed:true});}catch{plotCache.set(r.id,{sim:null});}}
  const entry=plotCache.get(r.id);return {sim:entry.sim,replayed:entry.replayed,record:r,label:t('plots.runLabel',{n}),name:`run-${n}`};
}
function plotSpecs(s){
  const L=s.log,time=L.t,[blue,orange,purple,green]=COLORS,deg=a=>a.map(v=>v*180/Math.PI),xlabel=t('plot.time');
  const lr=(title,ylabel,unit,digits,a,b)=>({title,xlabel,ylabel,unit,digits,series:[{label:t('plot.left'),x:time,y:a,color:blue},{label:t('plot.right'),x:time,y:b,color:orange}]});
  const obstacle={label:t('plot.obstacle'),x0:OBSTACLE.z-OBSTACLE.halfZ-s.start.z,x1:OBSTACLE.z+OBSTACLE.halfZ-s.start.z,y0:OBSTACLE.x-OBSTACLE.halfX-s.start.x,y1:OBSTACLE.x+OBSTACLE.halfX-s.start.x};
  // Desired = the commanded motion integrated in time, as in Lab 1. It is a reference line, so it wears ink, not a series hue.
  const scan=s.scans.at(-1),hits=scan.ranges.map((r,i)=>[i,r]).filter(([,r])=>r>0),gaps=a=>a.map(v=>v>0?v:NaN);
  const ink='#262626',dotted=[2,3],gap=(ax,ay,bx,by)=>ax.map((v,i)=>Math.hypot(v-bx[i],ay[i]-by[i]));
  return [
    {title:t('plot.trajectory'),kind:'xy',xlabel:t('plot.xForward'),ylabel:t('plot.yLeft'),digits:3,series:[{label:t('plot.truePath'),x:L.trueX,y:L.trueY,t:time,color:orange},{label:t('plot.encoderOdometry'),x:L.odomX,y:L.odomY,t:time,color:blue,dash:true},{label:t('plot.filteredOdometry'),x:L.fusedX,y:L.fusedY,t:time,color:green},{label:t('plot.desiredCommanded'),x:L.desX,y:L.desY,t:time,color:ink,dash:dotted}],patches:[obstacle]},
    {title:t('plot.positionError'),xlabel,ylabel:t('plot.distance'),unit:'m',digits:3,series:[{label:t('plot.errOdomDesired'),x:time,y:gap(L.odomX,L.odomY,L.desX,L.desY),color:blue},{label:t('plot.errTrueDesired'),x:time,y:gap(L.trueX,L.trueY,L.desX,L.desY),color:orange},{label:t('plot.errOdomTrue'),x:time,y:gap(L.odomX,L.odomY,L.trueX,L.trueY),color:purple},{label:t('plot.errFilteredTrue'),x:time,y:gap(L.fusedX,L.fusedY,L.trueX,L.trueY),color:green}]},
    {title:t('plot.heading'),xlabel,ylabel:t('plot.yaw'),unit:'°',digits:1,series:[{label:t('plot.true'),x:time,y:deg(L.trueYaw),color:orange},{label:t('plot.encoderOdometry'),x:time,y:deg(L.odomYaw),color:blue,dash:true},{label:t('plot.gyroIntegration'),x:time,y:deg(L.gyroYaw),color:purple},{label:t('plot.complementary'),x:time,y:deg(L.fusedYaw),color:green},{label:t('plot.desired'),x:time,y:deg(L.desYaw),color:ink,dash:dotted}]},
    {title:t('plot.wheelSpeed'),xlabel,ylabel:t('plot.omega'),unit:'rad/s',digits:2,series:[{label:t('plot.leftCommand'),x:time,y:L.cmdL,color:blue,dash:true},{label:t('plot.rightCommand'),x:time,y:L.cmdR,color:orange,dash:true},{label:t('plot.leftEncoder'),x:time,y:L.speedL,color:blue},{label:t('plot.rightEncoder'),x:time,y:L.speedR,color:orange}]},
    lr(t('plot.slip'),t('plot.slipSpeed'),'m/s',3,L.slipL,L.slipR),
    lr(t('plot.encoderCounts'),t('plot.counts'),'',0,L.encL,L.encR),
    lr(t('plot.current'),t('plot.currentAxis'),'A',2,L.currentL,L.currentR),
    {title:t('plot.gyro'),xlabel,ylabel:t('plot.angularRate'),unit:'rad/s',digits:4,series:[{label:t('plot.roll'),x:time,y:L.gx,color:blue},{label:t('plot.pitch'),x:time,y:L.gy,color:orange},{label:t('plot.yawRate'),x:time,y:L.gz,color:purple}]},
    {title:t('plot.accelXY'),xlabel,ylabel:t('plot.accel'),unit:'m/s²',digits:3,series:[{label:t('plot.forward'),x:time,y:L.ax,color:blue},{label:t('plot.leftAxis'),x:time,y:L.ay,color:orange}]},
    {title:t('plot.accelZ'),xlabel,ylabel:t('plot.accel'),unit:'m/s²',digits:3,series:[{label:t('plot.up'),x:time,y:L.az,color:purple}]},
    {title:t('plot.lidarScan',{t:scan.t.toFixed(1)}),kind:'polar',rmax:LIDAR.max,digits:3,caption:t('plot.lidarCaption'),series:[{label:t('plot.range'),x:hits.map(h=>h[0]),y:hits.map(h=>h[1]),color:blue}]},
    {title:t('plot.lidarRanges'),xlabel,ylabel:t('plot.rangeAxis'),unit:'m',digits:3,series:[{label:t('plot.front0'),x:time,y:gaps(L.lidarFront),color:blue},{label:t('plot.left90'),x:time,y:gaps(L.lidarLeft),color:orange},{label:t('plot.right270'),x:time,y:gaps(L.lidarRight),color:purple}]}
  ];
}
function renderPlots(){
  lastPlot=performance.now();const drives=records.filter(r=>r.mode==='drive'),src=plotSource(),live=src&&!src.record;
  $('plot-run').innerHTML=(live?`<option value="live">${t('plots.live')}</option>`:'')+drives.map(r=>`<option value="${r.id}">${t('plots.runOption',{n:records.length-records.indexOf(r),terrain:terrainLabel(terrainOf(r)),outcome:t(r.success?'plots.completed':'plots.stopped')})}</option>`).join('');
  $('plot-run').value=live?'live':String(plotRunId);$('plot-run').disabled=live||!drives.length;$('plot-csv').disabled=$('plot-lidar').disabled=!src?.sim;
  $('plots-empty').hidden=!!src?.sim;$('plot-grid').hidden=!src?.sim;$('plots-meta').hidden=!src?.sim;
  if(!src?.sim){$('plots-empty').textContent=t(src?'plots.emptyReplay':'plots.emptyNone');return;}
  const specs=plotSpecs(src.sim);while(figures.length<specs.length)figures.push(new Figure($('plot-grid')));
  if(src.sim!==plotted){plotted=src.sim;figures.forEach(f=>f.setCursor(null));}
  specs.forEach((spec,i)=>figures[i].set(spec));
  const s=src.sim,error=s.summary().odomError,spec=ROBOTS[s.robot];
  $('plots-meta').innerHTML=t('plots.meta',{label:esc(src.label),robot:esc(robotLabel(s.robot)),surface:esc(t('surface.'+s.terrain)),cpr:spec.encoderCpr,rate:spec.imu.rate,imu:t(s.robot==='turtlebot3'?'plots.imuTb3':'plots.imuKinetic'),error:(error*100).toFixed(1),replayed:src.replayed?t('plots.replayed'):'',name:src.name});
}
$('plot-lidar').onclick=()=>{const src=plotSource();if(!src?.sim)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toScanCsv(src.sim.scans)],{type:'text/csv'}));a.download=`kinetic-${src.name}-lidar.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(t('toast.lidarCsv',{file:`kinetic-${src.name}-lidar.csv`}));};
$('plot-run').onchange=e=>{plotRunId=Number(e.target.value);renderPlots();};
$('plot-csv').onclick=()=>{const src=plotSource();if(!src?.sim)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toCsv(src.sim.log)],{type:'text/csv'}));a.download=`kinetic-${src.name}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(t('toast.csv',{file:`kinetic-${src.name}.csv`}));};
const modal=$('modal');
function openModal(title,html){$('modal-eyebrow').textContent=title;$('modal-content').innerHTML=html;modal.showModal();}
function guide(){openModal(t('modal.guide.eyebrow'),t('modal.guide.html'));}
function modelDetails(){openModal(t('modal.model.eyebrow'),t('modal.model.html',{battery:TB3_FIT.battery,friction:TB3_FIT.ballFriction}));}
function commandReference(){openModal(t('modal.reference.eyebrow'),t('modal.reference.html'));}
function learningPath(){openModal(t('modal.path.eyebrow'),t('modal.path.html'));}
['guide','help'].forEach(id=>$(id).onclick=guide);$('lab-nav').onclick=()=>{changeTab('build');window.scrollTo({top:0,behavior:'smooth'});};$('lessons-nav').onclick=learningPath;
['notebook','notebook-nav'].forEach(id=>$(id).onclick=()=>{changeTab('results');$('results-panel').scrollIntoView({behavior:'smooth',block:'nearest'});});
const lessonTwo=()=>openModal(t('modal.lesson2.eyebrow'),t('modal.lesson2.html'));
const lessonOne=()=>openModal(t('modal.lesson1.eyebrow'),t('modal.lesson1.html'));
const lessonThree=()=>openModal(t('modal.lesson3.eyebrow'),t('modal.lesson3.html'));
const lessonFour=()=>openModal(t('modal.lesson4.eyebrow'),t('modal.lesson4.html'));
$('lesson-details').onclick=()=>lesson===4?lessonFour():lesson===3?lessonThree():lesson===2?lessonTwo():lessonOne();
$('model-details').onclick=modelDetails;$('code-reference').onclick=commandReference;
$('margin-help').onclick=()=>openModal(t('modal.margin.eyebrow'),t('modal.margin.html'));
$('robot-picker').onclick=()=>{const option=(id,detail)=>`<button class="roadmap-item robot-option" data-robot="${id}"><span>${icon('robot')}</span><div><strong>${robotLabel(id)}</strong><small>${t(detail)}</small></div><b${robot===id?'':' class="later"'}>${t(robot===id?'robots.selected':'robots.choose')}</b></button>`;
  const planned=(name,detail)=>`<div class="roadmap-item"><div><strong>${t(name)}</strong><small>${t(detail)}</small></div><b class="later">${t('robots.planned')}</b></div>`;
  openModal(t('robots.eyebrow'),`<h2>${t('robots.title')}</h2>`+option('kinetic','robots.kineticDetail')+option('turtlebot3','robots.tb3Detail')+planned('robots.omni','robots.omniDetail')+planned('robots.arm','robots.armDetail')+planned('robots.humanoid','robots.humanoidDetail')+`<p>${t('robots.footer')}</p>`);
  document.querySelectorAll('[data-robot]').forEach(b=>b.onclick=()=>{setRobot(b.dataset.robot);persist();modal.close();toast(t('toast.robotSelected',{robot:robotLabel(robot)}));});};
$('modal-close').onclick=$('modal-done').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
document.addEventListener('keydown',e=>{if(e.key==='?'&&!['TEXTAREA','INPUT'].includes(document.activeElement.tagName)&&!modal.open)guide();});
$('code-editor').value=code;
function updateLines(){$('line-numbers').textContent=$('code-editor').value.split('\n').map((_,i)=>i+1).join('\n');}
$('code-editor').addEventListener('input',()=>{if(state.status!=='idle')reset();updateLines();persist();});
$('code-editor').addEventListener('scroll',()=>$('line-numbers').scrollTop=$('code-editor').scrollTop);
$('code-editor').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const el=e.target,start=el.selectionStart;el.setRangeText('  ',start,el.selectionEnd,'end');el.dispatchEvent(new Event('input'));}});
$('code-example').onchange=e=>{reset();$('code-editor').value=example(e.target.value,language());updateLines();persist();};

// Lightweight orthographic 3D renderer. Geometry and the model share SI coordinates.
let focus={x:0,z:0},bodyFrame=null,fit={scale:1,y:.15};
function project(v){const c=Math.cos(yaw),s=Math.sin(yaw),ce=Math.cos(elevation),se=Math.sin(elevation);const x=v.x-focus.x,z=v.z-focus.z,y=v.y-fit.y;const scale=Math.min(cw*.8,ch*1.05)*zoom*fit.scale;return {x:cw*.5+(c*x-s*z)*scale,y:ch*.56-(-s*se*x+ce*y-c*se*z)*scale,d:s*ce*x+se*y+c*ce*z};}
function world(v,robot=false){
  let {x,y,z}=v;
  if(robot&&state.tip){const pivot=-p.width/200,theta=state.tip*1.22;const a=x-pivot;x=pivot+a*Math.cos(theta)-y*Math.sin(theta);y=a*Math.sin(theta)+y*Math.cos(theta);}
  // Driving: the body frame sits on the terrain (local x = left, y = surface normal, z = forward).
  if(mode==='drive'&&robot&&bodyFrame){const {origin:o,l,n,f}=bodyFrame;return {x:o[0]+x*l[0]+y*n[0]+z*f[0],y:o[1]+x*l[1]+y*n[1]+z*f[1],z:o[2]+x*l[2]+y*n[2]+z*f[2]};}
  const a=state.angle*Math.PI/180;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a),z};
}
function poly(points,fill,stroke=null,width=1,dash=[]){const q=points.map(project);ctx.beginPath();q.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.setLineDash(dash);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}}
function line(a,b,color,width=1,dash=[]){const A=project(a),B=project(b);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.setLineDash(dash);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}
let faces=[];
// A decal (spoke, cap) passes its base face's depth so it always draws right after that face.
function face(vs,color,depth=vs.reduce((s,v)=>s+project(v).d,0)/vs.length){faces.push({vs,color,depth,order:faces.length});return depth;}
function box(x,y,z,w,h,d,colors,transform=v=>world(v,true)){
  const vertices=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>transform({x:x+a*w/2,y:y+b*h/2,z:z+c*d/2}));
  const ix=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
  const palette=Array.isArray(colors)?colors:Array(6).fill(colors);ix.forEach((f,i)=>face(f.map(n=>vertices[n]),palette[i]));
}
// spin is the simulated wheel angle. Alternating tread blocks and three spokes make the rotation visible.
function wheel(x,y,z,r,w,small=false,spin=0,local=v=>v){
  const n=20,at=(dx,rho,a)=>world(local({x:x+dx,y:y+Math.cos(a)*rho,z:z+Math.sin(a)*rho}),true),angle=i=>i/n*Math.PI*2+spin;
  const rings=[-1,1].map(side=>Array.from({length:n},(_,i)=>at(side*w/2,r,angle(i))));
  face(rings[0],'#28333c');face(rings[1],'#34414a');for(let i=0;i<n;i++){const b=(i+1)%n,shade=Math.round(43+Math.cos(angle(i))*13)-(i%2?7:0);face([rings[0][i],rings[1][i],rings[1][b],rings[0][b]],`rgb(${shade},${shade+11},${shade+15})`);}
  if(!small){for(const side of [-1,1]){const dx=side*(w/2+.001),hub=face(Array.from({length:n},(_,i)=>at(dx,r*.55,angle(i))),side===1?'#a6b2b9':'#87979f');
    for(let k=0;k<3;k++){const a=spin+k*Math.PI*2/3,c=Math.cos(a),s=Math.sin(a),hw=r*.07,pt=(rho,d)=>world(local({x:x+dx,y:y+c*rho-s*d,z:z+s*rho+c*d}),true);face([pt(r*.15,-hw),pt(r*.5,-hw),pt(r*.5,hw),pt(r*.15,hw)],'#5d6f79',hub);}
    face(Array.from({length:n},(_,i)=>at(dx,r*.23,angle(i))),'#526470',hub);}}
}
function circle3(v,r,fill,stroke=null){const q=project(v);ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
// TurtleBot3 Waffle Pi, simplified: three waffle plates on standoffs, OpenCR board, LiDAR, camera, two wheels, two ball casters.
function drawTurtlebot(v){
  const zc=-.064,half=ROBOTS.turtlebot3.body().track/2,plate=['#3b4148','#4a525a','#333940','#59626b','#40474f','#454d55'];
  for(const y of [.03,.075,.12])box(0,y,zc,.266,.006,.266,plate);
  for(const x of [-.115,.115])for(const z of [zc-.115,zc+.115])box(x,.075,z,.008,.09,.008,'#9aa3aa');
  box(0,.045,zc,.1,.022,.1,['#2a6f97','#3483b0','#235f82','#4a9ac6','#2c739c','#3079a3']);
  box(0,.143,zc,.07,.04,.07,['#1f2328','#2a2f35','#1b1f23','#3a4047','#262b30','#2c3237']);box(0,.165,zc,.05,.006,.05,'#11161b');
  box(0,.098,.068,.025,.022,.01,'#20262c');box(0,.098,.074,.008,.008,.003,'#6d8fa3');
  wheel(-half,.033,0,.033,.018,false,v?v.wheels[1].theta:0);wheel(half,.033,0,.033,.018,false,v?v.wheels[0].theta:0);
  for(const x of [-.064,.064])box(x,.012,-.177,.02,.02,.02,['#b8bec3','#cfd4d8','#a9b0b5','#e1e5e8','#bcc2c6','#c5cbcf']);
}
function render(){
  fit=tb3()&&mode==='drive'?{scale:1.7,y:.07}:{scale:Math.min(1,.5/(.26+p.height/100)),y:.15};
  document.querySelector('.stage-scale>span').style.width=(Math.min(cw*.8,ch*1.05)*zoom*fit.scale*.2)+'px';
  // The camera trails the rover from the arena center, keeping the box in view. A run that starts near a wall follows the rover itself.
  const v=mode==='drive'?view():null,o=v?.origin||{x:0,z:0},k=o.x||o.z?1:.65;focus=v?{x:o.x+(v.x-o.x)*k,z:o.z+(v.z-o.z)*k}:{x:0,z:0};bodyFrame=v?.frame||null;
  ctx.clearRect(0,0,cw,ch);const bg=ctx.createLinearGradient(0,0,0,ch);bg.addColorStop(0,'#f4f5f2');bg.addColorStop(1,'#edf0ed');ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
  const ground=v=>world(v,false),surface=mode==='drive'?terrain:'flat',lift=(x,z,dy=.004)=>({x,y:terrainHeight(surface,x,z)+dy,z});
  if(TERRAINS[surface].bumps){
    // True bump heights (about 2 cm on gravel, 1 cm on grass) are too small to see at this scale, so slope shading shows them.
    const s=.15,h=(x,z)=>terrainHeight(surface,x,z),gain=5/TERRAINS[surface].bumps,[r0,g0,b0]=surface==='grass'?[199,217,178]:[222,218,206];
    for(let i=-16;i<16;i++)for(let j=-16;j<16;j++){const x0=i*s,z0=j*s,x1=x0+s,z1=z0+s,a=h(x0,z0),b=h(x1,z0),c=h(x1,z1),d=h(x0,z1),gx=(b+c-a-d)/(2*s),gz=(c+d-a-b)/(2*s),k=Math.max(-1,Math.min(1,(gx*.6+gz*.4)*gain));
      const col=`rgb(${Math.round(r0+k*20)},${Math.round(g0+k*20)},${Math.round(b0+k*20)})`;poly([{x:x0,y:a,z:z0},{x:x1,y:b,z:z0},{x:x1,y:c,z:z1},{x:x0,y:d,z:z1}],col,col,.6);}
  }else{
    const icy=surface==='slippery'&&mode==='drive';
    if(icy){poly([{x:-2.8,y:-.012,z:-2.8},{x:2.8,y:-.012,z:-2.8},{x:2.8,y:-.012,z:2.8},{x:-2.8,y:-.012,z:2.8}],'#e5eff4');for(const k of [-1.7,-.5,.8,1.9])line({x:k-.5,y:-.011,z:-2.5},{x:k+.5,y:-.011,z:2.5},'#f6fafc',4);}
    for(let i=-14;i<=14;i++){const n=i*.2,col=icy?'#d2e2ea':'#e3e8e2';line(ground({x:n,y:-.012,z:-2.8}),ground({x:n,y:-.012,z:2.8}),col,.7);line(ground({x:-2.8,y:-.012,z:n}),ground({x:2.8,y:-.012,z:n}),col,.7);}
  }
  if(mode==='tilt'){
    poly([{x:-.82,y:-.009,z:-.65},{x:.82,y:-.009,z:-.65},{x:.82,y:-.009,z:.65},{x:-.82,y:-.009,z:.65}].map(ground),'#f5f6f1','#cbd3c9',1);
    for(let i=-7;i<=7;i++)line(ground({x:i*.1,y:-.008,z:-.65}),ground({x:i*.1,y:-.008,z:.65}),'#e6e9e1',.65);
    for(let i=-6;i<=6;i++)line(ground({x:-.82,y:-.008,z:i*.1}),ground({x:.82,y:-.008,z:i*.1}),'#e6e9e1',.65);
    const A=project(ground({x:.7,y:0,z:-.55}));ctx.fillStyle='#a3ada1';ctx.font='8px monospace';ctx.fillText(t('canvas.tiltTable')+' / '+state.angle.toFixed(1)+'°',Math.max(12,Math.min(cw-130,A.x-100)),Math.max(20,Math.min(ch-110,A.y)));
  }
  // Soft footprint shadow, projected onto the supporting plane.
  const foot=tb3()&&mode==='drive'?{x:.17,z:.17,c:-.064}:{x:p.width/150,z:.28,c:0},shadow=Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2;return world({x:Math.cos(a)*foot.x,y:.001,z:foot.c+Math.sin(a)*foot.z},true);});poly(shadow,'#2f403317');
  if(mode==='drive'){
    // Low arena walls at ±WALL, which the LiDAR and the front range sensor both see.
    for(const [a,b] of [[[-WALL,-WALL],[WALL,-WALL]],[[WALL,-WALL],[WALL,WALL]],[[WALL,WALL],[-WALL,WALL]],[[-WALL,WALL],[-WALL,-WALL]]])poly([{x:a[0],y:0,z:a[1]},{x:b[0],y:0,z:b[1]},{x:b[0],y:.3,z:b[1]},{x:a[0],y:.3,z:a[1]}],'#e6eae6d9','#c9d1c9',1);
    const trail=(points,color)=>{if(points.length<2)return;ctx.beginPath();points.forEach((pt,i)=>{const q=project(lift(pt.x,pt.z));i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);};
    trail(v.path,'#f2a27f');if(showOdom)trail(v.odomPath,'#5b9bd0');if(showFused)trail(v.fusedPath,'#77AC30');
    box(OBSTACLE.x,terrainHeight(surface,OBSTACLE.x,OBSTACLE.z)+.12,OBSTACLE.z,OBSTACLE.halfX*2,.24,OBSTACLE.halfZ*2,['#d87950','#ed9369','#c66c47','#f3a879','#d77d57','#dc825b'],v=>v);
    const ahead=v.spec.rangeAhead,rayY=tb3()?.1:.10;line(world({x:0,y:rayY,z:ahead-.01},true),world({x:0,y:rayY,z:ahead+rangeTo(v,OBSTACLE,ahead)},true),'#68a8a6',1,[4,5]);
  }
  // While driving, the orange point is where gravity minus acceleration meets the ground (dynamic load transfer).
  const b=mode==='drive'?{com:v.com,polygon:v.polygon,projection:v.point,stable:v.margin>0}:balance(p,state.angle),support=b.polygon.map(v=>world({...v,y:.004},mode==='drive'));
  if(showSupport)poly(support,'#269c8c14','#58a89a',1.4,[4,3]);
  const width=mode==='drive'?v.width:p.width/100;
  if(tb3()&&mode==='drive')drawTurtlebot(v);else{
  // Robot assembly: chassis, battery, motors, support rods, payload, and front sensor.
  box(0,.148,-.06,width*.90,.075,.47,['#c9512b','#ec673b','#bf4e2b','#ff8753','#dd5b32','#ed6b3c']);
  box(0,.105,-.055,width*.7,.038,.35,['#5b6870','#737f84','#4d5a61','#879298','#68757c','#63727b']);
  box(0,.204,-.14,.17,.055,.135,['#34414d','#44525f','#2a3642','#586777','#354553','#405261']);
  box(.052,.237,-.14,.025,.008,.055,'#91a29d');
  // Left wheel at +x, right wheel at -x. The caster fork swivels to trail its own velocity.
  const sw=v?v.caster.swivel:0,cs=Math.cos(sw),sn=Math.sin(sw),swivel=q=>{const dz=q.z-CASTER.z;return {x:q.x*cs+dz*sn,y:q.y,z:CASTER.z-q.x*sn+dz*cs};};
  wheel(-width/2,.075,.08,.075,.055,false,v?v.wheels[1].theta:0);wheel(width/2,.075,.08,.075,.055,false,v?v.wheels[0].theta:0);
  box(0,.073,CASTER.z,.035,.062,.025,'#98a6ad',q=>world(swivel(q),true));wheel(0,.031,CASTER.z,.031,.026,true,v?v.caster.spin:0,swivel);
  // An adjustable crossbar lets the load move sideways without changing its specified mass model.
  const payloadY=.20+p.height/100,px=p.offset/100;
  box(px,.2,-.06,.16,.018,.13,['#727e83','#a9b3b6','#66747b','#c4cdcb','#839096','#9aa7ac']);
  for(const dx of [-.047,.047])box(px+dx,(payloadY+.19)/2,-.06,.012,Math.max(.02,payloadY-.19),.012,['#8c9b9e','#b4c1c1','#7c8e95','#d1dbd5','#91a3a6','#bdc9c7']);
  if(p.mass>0){const size=.115+p.mass*.017;box(px,payloadY,-.06,size,.12,size,['#df9e5d','#e7ae6c','#c78a50','#f4c689','#d3985d','#e7b372']);box(px,payloadY+.061,-.06,.025,.002,size+.001,'#e3a66b');}
  box(0,.196,.183,.12,.035,.035,['#304652','#354b59','#293c48','#506674','#3f5865','#405a68']);
  box(0,.2,.05,.055,.028,.055,['#22282e','#2c333a','#1d2227','#3b434b','#262c32','#2f363d']);box(0,.216,.05,.04,.004,.04,'#11161b');
  box(-.032,.198,.202,.018,.018,.006,'#9fb4ba');box(.032,.198,.202,.018,.018,.006,'#9fb4ba');
  // Four screw heads on the top face.
  for(const x of [-width*.36,width*.36])for(const z of [-.24,.11])box(x,.187,z,.012,.002,.012,'#ffd0b0');
  }
  faces.sort((a,b)=>a.depth-b.depth||a.order-b.order).forEach(f=>poly(f.vs,f.color));faces=[];
  // Latest LiDAR scan: one dot per valid return, in the scan plane at the LiDAR's height.
  if(showLidar&&mode==='drive'){const M=v.spec.lidarMount,o=world({x:M.x,y:M.y,z:M.z},true);v.scan.forEach((r,i)=>{if(!(r>=LIDAR.min&&r<Infinity))return;const a=v.heading+i*2*Math.PI/LIDAR.beams;circle3({x:o.x+r*Math.sin(a),y:o.y,z:o.z+r*Math.cos(a)},1.6,'#7E2F8E');});}
  if(showSupport){support.forEach(v=>circle3(v,3,'#4f9e8b','#fff'));poly(support,null,'#319683b0',1,[4,3]);}
  if(showCom){
    const c=world(b.com,true),proj=state.tip?null:world({...b.projection,y:.006},mode==='drive');
    if(proj){line(c,proj,'#eb7e4d',1.3,[4,4]);circle3(proj,4,b.stable?'#f6b68d':'#d15d39','#fff');}
    circle3(c,6,'#f77840','#fff');const q=project(c);ctx.beginPath();ctx.arc(q.x,q.y,10,0,Math.PI*2);ctx.strokeStyle='#ef956a50';ctx.lineWidth=1;ctx.stroke();
    const label=$('label-com');label.style.opacity=1;label.style.left=Math.max(13,Math.min(cw-135,q.x+18))+'px';label.style.top=Math.max(99,Math.min(ch-135,q.y-16))+'px';
  }else $('label-com').style.opacity=0;
  if(showSupport){const q=project(world({x:width/2+.03,y:0,z:-.13},mode==='drive'));const label=$('label-support');label.style.opacity=1;label.style.left=Math.max(15,Math.min(cw-137,q.x+20))+'px';label.style.top=Math.max(140,Math.min(ch-135,q.y+19))+'px';}else $('label-support').style.opacity=0;
  // Wind: a fixed indicator under the stage title, its arrow turned to where the air moves as the camera sees it.
  if(mode==='drive'&&v.windOption&&v.windSpeed>.05){
    const d=v.windToward,a=project({x:v.x,y:0,z:v.z}),b=project({x:v.x+Math.sin(d)*.1,y:0,z:v.z+Math.cos(d)*.1}),n=Math.hypot(b.x-a.x,b.y-a.y)||1,ux=(b.x-a.x)/n,uy=(b.y-a.y)/n;
    const cx=40,cy=112,r=11;ctx.strokeStyle='#56708a';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(cx-ux*r,cy-uy*r);ctx.lineTo(cx+ux*r,cy+uy*r);
    ctx.moveTo(cx+ux*r,cy+uy*r);ctx.lineTo(cx+ux*r-ux*5+uy*4,cy+uy*r-uy*5-ux*4);ctx.moveTo(cx+ux*r,cy+uy*r);ctx.lineTo(cx+ux*r-ux*5-uy*4,cy+uy*r-uy*5+ux*4);ctx.stroke();
    ctx.fillStyle='#56708a';ctx.font='11px system-ui,sans-serif';ctx.fillText(t('wind.label',{speed:v.windSpeed.toFixed(1)}),cx+18,cy+4);
  }
  // Orientation marker.
  const origin={x:cw-48,y:ch-115};for(const [label,dx,dy,color] of [['X',18,6,'#cc8771'],['Y',0,-22,'#91a18d'],['Z',-17,9,'#799ea5']]){ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(origin.x+dx,origin.y+dy);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=color;ctx.font='7px sans-serif';ctx.fillText(label,origin.x+dx-2,origin.y+dy+(dy<0?-4:10));}
}
function resize(){const r=canvas.getBoundingClientRect();cw=r.width;ch=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);needsRender=true;}
new ResizeObserver(resize).observe(canvas);
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw,elevation};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw+(e.clientX-drag.x)*.008;elevation=Math.max(.12,Math.min(1.5,drag.elevation+(e.clientY-drag.y)*.006));needsRender=true;});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.45,Math.min(2,zoom-e.deltaY*.001));needsRender=true;},{passive:false});
canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')elevation=Math.min(1.5,elevation+.1);if(e.key==='ArrowDown')elevation=Math.max(.12,elevation-.1);if(e.key==='+')zoom=Math.min(2,zoom+.1);if(e.key==='-')zoom=Math.max(.45,zoom-.1);needsRender=true;}});
$('view-perspective').onclick=$('view-reset').onclick=()=>{yaw=VIEW_YAW;elevation=.43;zoom=1;needsRender=true;};$('view-top').onclick=()=>{yaw=Math.PI;elevation=1.5;zoom=1;needsRender=true;};$('zoom-in').onclick=()=>{zoom=Math.min(2,zoom+.15);needsRender=true;};$('zoom-out').onclick=()=>{zoom=Math.max(.45,zoom-.15);needsRender=true;};
function frame(time){const dt=lastFrame?Math.min((time-lastFrame)/1000,.25):0;lastFrame=time;tick(dt);if(needsRender){render();needsRender=false;}requestAnimationFrame(frame);}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.status==='running'){state.status='paused';setRunButton();}});
// A language change redraws every visible text. An unedited example or mission starter follows the language.
function applyLanguage(){
  const l=language();document.documentElement.lang=l;document.title=t('doc.title');document.querySelector('meta[name=description]').content=t('doc.description');$('language').value=l;
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-html]').forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-title]').forEach(el=>el.title=t(el.dataset.i18nTitle));
  for(const id of shown.keys())redraw(id);
  $('toast').hidden=true;
  modeText();setRunButton();updateInputs();renderMissions();renderResults();if(tab==='plots')renderPlots();needsRender=true;
}
$('language').onchange=e=>{setLanguage(e.target.value);const src=$('code-editor').value,next=translateCode(src,language());if(next!==src){$('code-editor').value=next;updateLines();}applyLanguage();persist();};
setEnvironment(environment);setRobot(robot);setLesson(lesson,false);modeText();show('code-progress',()=>t('code.idle'));show('save-status',()=>t('header.saved'));applyLanguage();updateLines();updateTelemetry();requestAnimationFrame(frame);
// The header sky follows the local clock; it is redrawn once a minute and on resize, never animated.
function paintSky(){const c=$('sky'),r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(!r.width)return;c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);drawSky(x,r.width,r.height,skyAt(new Date()));}
paintSky();setInterval(paintSky,60000);new ResizeObserver(paintSky).observe($('sky'));
