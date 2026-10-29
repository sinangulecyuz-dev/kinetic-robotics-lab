import {DEFAULT,PRESETS,balance,criticalAngle,parseProgram} from './physics.mjs';
import {DriveSim,simulateRun,toCsv,toScanCsv,terrainHeight,rangeTo,TERRAINS,OBSTACLE,CASTER,ROBOTS,TB3_FIT,LIDAR,WALL} from './drive.mjs';
import {Figure,COLORS} from './plots.mjs';
import {MISSIONS,missionById} from './missions.mjs';
import {EXAMPLES} from './examples.mjs';

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

let p={...DEFAULT},records=[],code=EXAMPLES.turn,terrain='flat',robot='kinetic',lesson=1,mission=null,missionsDone=[];
try{const saved=JSON.parse(localStorage.getItem('kinetic-v1')||'null');if(saved){if(saved.lesson===2)lesson=2;if(missionById(saved.mission))mission=saved.mission;if(Array.isArray(saved.missionsDone))missionsDone=saved.missionsDone.filter(id=>missionById(id));for(const k of Object.keys(DEFAULT)){const input=$(k),v=Number(saved.design?.[k]);if(Number.isFinite(v))p[k]=Math.max(+input.min,Math.min(+input.max,v));}if(typeof saved.code==='string'&&saved.code.length<15000)code=saved.code;if(TERRAINS[saved.terrain])terrain=saved.terrain;if(ROBOTS[saved.robot])robot=saved.robot;if(Array.isArray(saved.records))records=saved.records.slice(0,30).filter(r=>r&&['tilt','drive'].includes(r.mode)&&r.design&&typeof r.message==='string');}}catch{}
let tab='build',mode='tilt',prediction=null,showCom=true,showSupport=true,showOdom=true,showLidar=true,showFused=true;
let state={status:'idle',angle:0,time:0,tip:0,targetTip:0,minMargin:1,runDesign:null};
// sim is the drive run in progress; idle is a parked rover that only places the model on the terrain.
let sim=null,idle=null,idleKey='',toastTimer,figures=[],plotCache=new Map(),plotRunId=null,plotted=null,lastPlot=0;
const canvas=$('scene'),ctx=canvas.getContext('2d');
// Camera from behind the rover, so its own left is on screen left, matching wheels(left, right) and the sensors.
const VIEW_YAW=Math.PI+.73;
let cw=800,ch=536,zoom=1,yaw=VIEW_YAW,elevation=0.43,drag=null,lastFrame=0,needsRender=true;
function view(){if(sim)return sim;const key=JSON.stringify(p)+terrain+robot;if(key!==idleKey){idle=new DriveSim({design:p,terrain,robot,noise:false});idleKey=key;}return idle;}
const terrainOf=r=>TERRAINS[r?.terrain]?r.terrain:'flat',robotOf=r=>ROBOTS[r?.robot]?r.robot:'kinetic',tb3=()=>robot==='turtlebot3';
function persist(){try{localStorage.setItem('kinetic-v1',JSON.stringify({design:p,code:$('code-editor').value,terrain,robot,lesson,mission,missionsDone,records}));$('save-status').textContent='Saved on this device';}catch{$('save-status').textContent='Saving unavailable';}}
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function changeTab(next){tab=next;document.body.dataset.tab=next;for(const t of ['build','code','plots','results']){$(`${t}-tab`).classList.toggle('active',t===next);$(`${t}-tab`).setAttribute('aria-selected',t===next);}$('code-panel').hidden=next!=='code';$('plots-panel').hidden=next!=='plots';$('results-panel').hidden=next!=='results';if(next==='code'&&mode!=='drive')changeMode('drive');if(next==='results')renderResults();if(next==='plots')renderPlots();needsRender=true;}
['build','code','plots','results'].forEach(t=>$(`${t}-tab`).onclick=()=>changeTab(t));
function updateInputs(){
  for(const k of Object.keys(DEFAULT)){
    const el=$(k);el.value=p[k];const unit=k==='mass'?'kg':k==='target'?'°':'cm';
    $(`${k}-output`).innerHTML=k==='offset'?(p[k]?`${Math.abs(p[k])} <small>cm ${p[k]>0?'left':'right'}</small>`:'0 <small>cm · centered</small>'):`${k==='mass'?p[k].toFixed(1):p[k]} <small>${unit}</small>`;
    el.style.background=`linear-gradient(${el.dir==='rtl'?'to left':'to right'},var(--orange) ${(p[k]-el.min)/(el.max-el.min)*100}%,#e9ecef ${(p[k]-el.min)/(el.max-el.min)*100}%)`;
  }
  document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',Object.keys(p).every(k=>p[k]===PRESETS[b.dataset.preset][k])));
  needsRender=true;
}
for(const k of Object.keys(DEFAULT))$(k).addEventListener('input',e=>{if(['running','paused','done'].includes(state.status))reset();p[k]=Number(e.target.value);updateInputs();persist();updateTelemetry();});
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{reset();p={...PRESETS[b.dataset.preset]};updateInputs();persist();updateTelemetry();$('discovery-title').textContent=b.dataset.preset==='tall'?'Same idea, a much higher center of mass.':b.dataset.preset==='offset'?'A payload near the edge leaves less room for balance.':'A wider stance gives your robot more room to balance.';$('discovery-copy').textContent=b.dataset.preset==='tall'?'The mass is high above a narrow base. Will it reach the target ramp angle? Make a prediction and test it.':b.dataset.preset==='offset'?'The ramp lifts the rover’s left side, so gravity pulls the load toward its low right edge. Try moving the payload to the left, uphill.':'Try the top-heavy preset. Predict what will happen, then watch the center of mass as the ramp tilts.';});
for(const [id,value] of [['predict-stable','stable'],['predict-tip','tip']])$(id).onclick=()=>{if(state.status==='running'||state.status==='paused'){toast('Reset the experiment before changing your prediction.');return;}prediction=prediction===value?null:value;updatePrediction();};
function updatePrediction(){ $('predict-stable').setAttribute('aria-pressed',prediction==='stable');$('predict-tip').setAttribute('aria-pressed',prediction==='tip');}
$('show-com').onchange=e=>{showCom=e.target.checked;needsRender=true;};$('show-support').onchange=e=>{showSupport=e.target.checked;needsRender=true;};$('show-odom').onchange=e=>{showOdom=e.target.checked;needsRender=true;};$('show-lidar').onchange=e=>{showLidar=e.target.checked;needsRender=true;};$('show-fused').onchange=e=>{showFused=e.target.checked;needsRender=true;};
$('experiment-mode').onchange=e=>changeMode(e.target.value);
const driveNote=()=>{const t=TERRAINS[terrain];return tb3()?`TurtleBot3 Waffle Pi · Dynamixel servos on a ${TB3_FIT.battery} V battery · ${t.surface}, μ ${t.muPeak} · Calibrated to one robot's lab data`:`Planar dynamics · DC motors with PI speed control · ${t.surface}, μ ${t.muPeak} · Not validated on hardware`;};
// The TurtleBot3 has a fixed, datasheet geometry and only drives; the builder sliders and the ramp belong to the Kinetic rover.
function setRobot(next){
  if(!ROBOTS[next])return;if(state.status!=='idle')reset();robot=next;const t=tb3();
  $('experiment-mode').querySelector('option[value=tilt]').disabled=t;if(t&&mode==='tilt')changeMode('drive');
  for(const id of ['preset-row','structure-section','payload-section'])$(id).hidden=t;$('robot-note').hidden=!t;
  $('robot-name').innerHTML=t?'TurtleBot3 Waffle Pi<small>ROS 2 · 2 DYNAMIXEL SERVOS</small>':'Differential drive<small>MOBILE ROBOT · 2 MOTORS</small>';
  $('stage-title').textContent=ROBOTS[robot].label==='Kinetic rover'?'Differential-drive rover':ROBOTS[robot].label;
  if(mode==='drive')$('model-note').textContent=driveNote();updateTelemetry();needsRender=true;
}
function changeMode(next){reset();mode=next;$('experiment-mode').value=next;$('tilt-setting').hidden=next!=='tilt';$('drive-setting').hidden=next!=='drive';$('odom-row').hidden=$('lidar-row').hidden=$('fused-row').hidden=next!=='drive';$('model-note').textContent=next==='tilt'?'Quasi-static balance model · Ideal grip · No sliding or impact physics':driveNote();$('stage-subtitle').textContent=next==='tilt'?'Two powered wheels. One little caster. Endless ideas.':'Give each wheel a target speed. Watch it move, slip, and measure.';document.querySelector('.prediction-card').hidden=next==='drive';
  const labels=next==='drive'?['SPEED','WHEEL SLIP','FRONT SENSOR']:['TOTAL MASS','COM HEIGHT','SURFACE TILT'];['metric-mass','metric-height','metric-tilt'].forEach((id,i)=>$(id).previousElementSibling.textContent=labels[i]);
  updateTelemetry();needsRender=true;}
function setTerrain(next){
  if(!TERRAINS[next])return;if(state.status!=='idle')reset();terrain=next;const t=TERRAINS[next];
  document.querySelectorAll('[data-terrain]').forEach(b=>{b.classList.toggle('active',b.dataset.terrain===next);b.setAttribute('aria-pressed',b.dataset.terrain===next);});
  $('terrain-note').textContent=`${t.surface}. Peak friction μ ${t.muPeak}, sliding μ ${t.muSlide}, rolling resistance ${t.crr}${t.bumps?'. Bumps up to about 2 cm':''}.`;
  if(mode==='drive')$('model-note').textContent=driveNote();updateTelemetry();needsRender=true;
}
document.querySelectorAll('[data-terrain]').forEach(b=>b.onclick=()=>{setTerrain(b.dataset.terrain);persist();});
const LESSONS={
  1:{time:'· 5 MIN',title:'Carry the load',question:'Can your rover keep its balance on a tilted surface?',concept:'Center of mass & support polygon',discovery:['A wider stance gives your robot more room to balance.','Try the top-heavy preset. Predict what will happen, then watch the center of mass as the ramp tilts.']},
  2:{time:'· 15 MIN',title:'Where am I?',question:'Can your rover tell where it is using only its own sensors?',concept:'Odometry, gyro & ground truth',discovery:['Your rover only knows what its sensors tell it.','Pick a mission in the builder. Each starter script falls a little short on purpose.']}
};
function setLesson(n,user=true){
  lesson=n===2?2:1;const L=LESSONS[lesson];
  document.querySelectorAll('[data-lesson]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.lesson===lesson));
  $('lesson-time').textContent=L.time;$('lesson-title').textContent=L.title;$('lesson-question').textContent=L.question;$('lesson-concept-text').textContent=L.concept;
  [$('discovery-title').textContent,$('discovery-copy').textContent]=L.discovery;$('mission-card').hidden=lesson!==2;renderMissions();
  if(user){if(lesson===1){setRobot('kinetic');changeMode('tilt');changeTab('build');}else changeMode('drive');persist();}
}
document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>setLesson(+b.dataset.lesson));
// Status carries a label as well as a color, so it never depends on color alone.
function renderMissions(){
  $('mission-list').innerHTML=MISSIONS.map(m=>{const done=missionsDone.includes(m.id);return `<button class="mission" data-mission="${m.id}" aria-pressed="${mission===m.id}"><span>${esc(m.title)}<small>${esc(ROBOTS[m.robot].label)} · ${esc(TERRAINS[m.terrain].label)} ground</small></span><span class="mission-status${done?' done':''}">${done?'DONE ✓':'TO DO'}</span></button>`;}).join('');
  document.querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>loadMission(b.dataset.mission));
  const m=missionById(mission);$('mission-goal').textContent=m?m.goal:'Pick a mission. Each starter script falls a little short on purpose. The judge uses the true position, which your program never sees.';
}
function loadMission(id){
  const m=missionById(id);if(!m)return;mission=id;setRobot(m.robot);setTerrain(m.terrain);changeMode('drive');
  $('code-editor').value=m.starter;updateLines();renderMissions();persist();changeTab('code');
  $('discovery-title').textContent=`Mission: ${m.title}`;$('discovery-copy').textContent=m.goal;
  toast('Mission loaded into the editor. Run it, then improve it.');
}
function reset(){state={status:'idle',angle:0,time:0,tip:0,targetTip:0,minMargin:1,runDesign:null};sim=null;$('stage-outcome').hidden=true;$('code-error').hidden=true;$('code-progress').textContent='Edit the script, then run your experiment.';setRunButton();updateTelemetry();needsRender=true;}
function setRunButton(){const running=state.status==='running',paused=state.status==='paused';$('run').innerHTML=icon(running?'pause':'play')+`<span id="run-text">${running?'Pause':paused?'Resume':'Run experiment'}</span>`;$('scene-status').innerHTML=`<i></i>${running?'Experiment in progress':paused?'Experiment paused':state.status==='done'?'Experiment complete':'Ready to experiment'}`;}
$('reset').onclick=()=>{reset();toast('Experiment reset. Your design is ready.');};
$('run').onclick=()=>{
  if(state.status==='running'){state.status='paused';setRunButton();return;}
  if(state.status==='paused'){state.status='running';setRunButton();return;}
  reset();
  if(mode==='drive'){
    let program;try{program=parseProgram($('code-editor').value);}catch(e){changeTab('code');$('code-error').textContent=e.message;$('code-error').hidden=false;toast('Check the highlighted program message.');return;}
    if(!tb3()&&!balance(p,0).stable){toast('Your rover is already outside its support polygon. Balance the payload before driving.');return;}
    sim=new DriveSim({design:{...p},terrain,robot,program,seed:Math.random()*2**32>>>0});
  }
  state.status='running';state.runDesign={...p};state.minMargin=balance(p,0).margin;state.runPrediction=prediction;setRunButton();needsRender=true;
};
function finish(success,message){
  state.status='done';state.l=0;state.r=0;setRunButton();
  $('stage-outcome').hidden=false;$('stage-outcome').classList.toggle('failed',!success);$('stage-outcome').textContent=message;
  if(mode==='drive')$('code-progress').textContent=`${message} · ${sim.time.toFixed(1)} s`;
  // A mission is judged only on the robot and ground it was written for, using the simulator's ground truth.
  const m=mode==='drive'&&lesson===2?missionById(mission):null,judged=m&&sim.robot===m.robot&&sim.terrain===m.terrain?m.judge(sim):null;
  if(judged?.pass&&!missionsDone.includes(m.id))missionsDone.push(m.id);
  const drive=mode==='drive'?{terrain:sim.terrain,robot:sim.robot,seed:sim.seed,odomError:sim.summary().odomError,...(judged?{mission:m.id,missionPass:judged.pass}:{})}:{};
  const record={id:Date.now(),mode,design:{...state.runDesign},success,message,angle:state.angle,time:mode==='drive'?sim.time:state.time,margin:state.minMargin,prediction:state.runPrediction||null,code:mode==='drive'?$('code-editor').value:null,...drive};
  if(mode==='drive'){plotCache.set(record.id,{sim,replayed:false});plotRunId=record.id;}
  records.unshift(record);records=records.slice(0,30);persist();renderResults();if(tab==='plots')renderPlots();
  $('discovery-title').textContent=mode==='tilt'?(success?'Your rover held its balance. What could you change next?':'The gravity line crossed the edge of the support polygon.'):'Your instructions became a path, and your sensors recorded it.';
  $('discovery-copy').textContent=mode==='tilt'?(success?'Try increasing the payload height while keeping everything else the same. Can you find the tipping point?':'Try lowering the payload, widening the wheel spacing, or shifting the load uphill. Change one thing and test again.'):'Open Plots to compare the encoder odometry with the true path. Then try the same script on slippery ground.';
  if(judged){
    $('discovery-title').textContent=judged.pass?`Mission complete: ${m.title}.`:`Not yet: ${m.title}.`;
    $('discovery-copy').textContent=judged.pass?`${judged.text} Try another mission next.`:`${judged.text} ${m.lesson}`;
    toast(judged.pass?'Mission complete!':'Not yet. The hint is below the stage.');renderMissions();
  }else if(m)$('discovery-copy').textContent=`This run was not judged. “${m.title}” needs the ${ROBOTS[m.robot].label} on ${TERRAINS[m.terrain].label.toLowerCase()} ground.`;
}
function tick(dt){
  if(state.status==='running'){
    state.time+=dt;
    if(mode==='tilt'){
      const threshold=criticalAngle(p);state.angle=Math.min(p.target,state.angle+dt*5);
      if(state.angle>=threshold){state.angle=threshold;state.targetTip=1;state.minMargin=Math.min(state.minMargin,0);finish(false,`Static support lost at ${threshold.toFixed(1)}°`);}
      else{state.minMargin=Math.min(state.minMargin,balance(p,state.angle).margin);if(state.angle>=p.target)finish(true,`Balanced at ${p.target}°. Nice work.`);}
    }else{sim.advance(dt);if(sim.status==='done')finish(sim.success,sim.message);else if(tab==='plots'&&performance.now()-lastPlot>250)renderPlots();}
    updateTelemetry();needsRender=true;
  }
  if(Math.abs(state.tip-state.targetTip)>.001){state.tip+=(state.targetTip-state.tip)*Math.min(1,dt*4);needsRender=true;}
}
function setMargin(m){$('metric-margin').innerHTML=`${m>=0?'+':''}${(m*100).toFixed(1)} <small>cm</small>`;$('metric-margin').style.color=m<=.001?'#ca6544':m<.02?'#b9954e':'#308574';}
function updateTelemetry(){
  if(mode==='drive'){
    const v=view();$('metric-mass').innerHTML=`${v.speed.toFixed(2)} <small>m/s</small>`;$('metric-height').innerHTML=`${v.maxSlip.toFixed(2)} <small>m/s</small>`;setMargin(v.margin);$('metric-tilt').innerHTML=`${v.range.toFixed(2)} <small>m</small>`;
    if(sim&&state.status==='running')$('code-progress').textContent=`Executing line ${sim.line} · ${sim.time.toFixed(1)} s · Front distance ${sim.range.toFixed(2)} m`;
    return;
  }
  const b=balance(p,state.angle);$('metric-mass').innerHTML=`${b.com.mass.toFixed(1)} <small>kg</small>`;$('metric-height').innerHTML=`${(b.com.y*100).toFixed(1)} <small>cm</small>`;
  setMargin(b.margin);$('metric-tilt').innerHTML=`${state.angle.toFixed(1)}<small>°</small>`;
}
function renderResults(){
  $('result-count').textContent=records.length;
  if(!records.length){$('results-list').innerHTML='<div class="empty-state">Your notebook starts with a question.<br>Make a prediction and run your first experiment.<br><button class="text-button" id="back-build">Back to the builder →</button></div>';$('back-build').onclick=()=>changeTab('build');return;}
  $('results-list').innerHTML=records.map((r,i)=>`<article class="result-card"><div class="result-card-top"><h4>${r.mode==='tilt'?'Ramp balance test':'Rover program'} <span style="color:#a5afb9;font-size:9px"> / ${records.length-i}</span></h4><span class="result-badge ${r.success?'':'fail'}">${r.success?'COMPLETED':r.mode==='tilt'?'TIPPED':'STOPPED'}</span></div><p>${esc(r.message)} ${r.mode==='tilt'?(r.prediction?`Your prediction: <strong>${r.prediction==='stable'?'it would hold':'it would tip'}</strong>. ${((r.prediction==='stable')===r.success)?'Your prediction matched.':'A useful surprise—try changing one variable.'}`:'No prediction recorded. Make one before your next test.'):''}</p><div class="result-specs">${robotOf(r)==='turtlebot3'?'TurtleBot3 Waffle Pi':`Wheel spacing ${Number(r.design.width)} cm · Payload ${Number(r.design.mass).toFixed(1)} kg · Height ${Number(r.design.height)} cm · Offset ${Number(r.design.offset)} cm`}${r.mode==='drive'?` · ${TERRAINS[terrainOf(r)].label} terrain · ${Number(r.time).toFixed(1)} s${Number.isFinite(r.odomError)?` · Odometry error ${(r.odomError*100).toFixed(1)} cm`:''}${r.mission&&missionById(r.mission)?` · Mission “${esc(missionById(r.mission).title)}”: ${r.missionPass?'passed':'not yet'}`:''}`:` · Target ${Number(r.design.target)}°`}</div><div class="result-actions"><button class="text-button" data-restore="${i}">Restore this setup ↗</button>${r.mode==='drive'?`<button class="text-button" data-plot="${i}">Open plots ↗</button>`:''}</div></article>`).join('');
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const r=records[+b.dataset.restore];reset();p={...DEFAULT,...r.design};setRobot(robotOf(r));changeMode(r.mode);if(r.mode==='drive')setTerrain(terrainOf(r));if(r.code){$('code-editor').value=r.code;updateLines();}updateInputs();updateTelemetry();persist();changeTab(r.mode==='drive'?'code':'build');toast('Experiment setup restored.');});
  document.querySelectorAll('[data-plot]').forEach(b=>b.onclick=()=>{plotRunId=records[+b.dataset.plot].id;changeTab('plots');});
}
// Plots come from the live run, or are regenerated from a saved run's design, terrain, script, and seed.
function plotSource(){
  if(sim&&['running','paused'].includes(state.status))return {sim,label:'Current run (recording)',name:'current'};
  const drives=records.filter(r=>r.mode==='drive');if(!drives.length)return null;
  const r=drives.find(x=>x.id===plotRunId)||drives[0],n=records.length-records.indexOf(r);plotRunId=r.id;
  if(!plotCache.has(r.id)){try{plotCache.set(r.id,{sim:simulateRun({design:{...DEFAULT,...r.design},terrain:terrainOf(r),robot:robotOf(r),program:parseProgram(r.code||''),seed:Number.isFinite(r.seed)?r.seed:r.id>>>0}),replayed:true});}catch{plotCache.set(r.id,{sim:null});}}
  const entry=plotCache.get(r.id);return {sim:entry.sim,replayed:entry.replayed,record:r,label:`Run ${n}`,name:`run-${n}`};
}
function plotSpecs(s){
  const L=s.log,t=L.t,[blue,orange,purple,green]=COLORS,deg=a=>a.map(v=>v*180/Math.PI),xlabel='Time (s)';
  const lr=(title,ylabel,unit,digits,a,b)=>({title,xlabel,ylabel,unit,digits,series:[{label:'Left',x:t,y:a,color:blue},{label:'Right',x:t,y:b,color:orange}]});
  const obstacle={label:'Obstacle',x0:OBSTACLE.z-OBSTACLE.halfZ-s.start.z,x1:OBSTACLE.z+OBSTACLE.halfZ-s.start.z,y0:OBSTACLE.x-OBSTACLE.halfX-s.start.x,y1:OBSTACLE.x+OBSTACLE.halfX-s.start.x};
  // Desired = the commanded motion integrated in time, as in Lab 1. It is a reference line, so it wears ink, not a series hue.
  const scan=s.scans.at(-1),hits=scan.ranges.map((r,i)=>[i,r]).filter(([,r])=>r>0),gaps=a=>a.map(v=>v>0?v:NaN);
  const ink='#262626',dotted=[2,3],gap=(ax,ay,bx,by)=>ax.map((v,i)=>Math.hypot(v-bx[i],ay[i]-by[i]));
  return [
    {title:'Trajectory (top view)',kind:'xy',xlabel:'X, forward from start (m)',ylabel:'Y, to the left (m)',digits:3,series:[{label:'True path',x:L.trueX,y:L.trueY,t,color:orange},{label:'Encoder odometry',x:L.odomX,y:L.odomY,t,color:blue,dash:true},{label:'Filtered odometry',x:L.fusedX,y:L.fusedY,t,color:green},{label:'Desired (commanded)',x:L.desX,y:L.desY,t,color:ink,dash:dotted}],patches:[obstacle]},
    {title:'Position error',xlabel,ylabel:'Distance (m)',unit:'m',digits:3,series:[{label:'Odometry vs desired (what Lab 1 measures)',x:t,y:gap(L.odomX,L.odomY,L.desX,L.desY),color:blue},{label:'True vs desired (robot off its command)',x:t,y:gap(L.trueX,L.trueY,L.desX,L.desY),color:orange},{label:'Odometry vs true (estimate error)',x:t,y:gap(L.odomX,L.odomY,L.trueX,L.trueY),color:purple},{label:'Filtered vs true',x:t,y:gap(L.fusedX,L.fusedY,L.trueX,L.trueY),color:green}]},
    {title:'Heading',xlabel,ylabel:'Yaw (°)',unit:'°',digits:1,series:[{label:'True',x:t,y:deg(L.trueYaw),color:orange},{label:'Encoder odometry',x:t,y:deg(L.odomYaw),color:blue,dash:true},{label:'Gyro integration',x:t,y:deg(L.gyroYaw),color:purple},{label:'Complementary filter',x:t,y:deg(L.fusedYaw),color:green},{label:'Desired',x:t,y:deg(L.desYaw),color:ink,dash:dotted}]},
    {title:'Wheel speed',xlabel,ylabel:'ω (rad/s)',unit:'rad/s',digits:2,series:[{label:'Left command',x:t,y:L.cmdL,color:blue,dash:true},{label:'Right command',x:t,y:L.cmdR,color:orange,dash:true},{label:'Left encoder',x:t,y:L.speedL,color:blue},{label:'Right encoder',x:t,y:L.speedR,color:orange}]},
    lr('Wheel slip (ground truth)','Slip speed (m/s)','m/s',3,L.slipL,L.slipR),
    lr('Encoder counts','Counts','',0,L.encL,L.encR),
    lr('Motor current','Current (A)','A',2,L.currentL,L.currentR),
    {title:'Gyroscope',xlabel,ylabel:'Angular rate (rad/s)',unit:'rad/s',digits:4,series:[{label:'x · roll rate',x:t,y:L.gx,color:blue},{label:'y · pitch rate',x:t,y:L.gy,color:orange},{label:'z · yaw rate',x:t,y:L.gz,color:purple}]},
    {title:'Accelerometer x, y',xlabel,ylabel:'Acceleration (m/s²)',unit:'m/s²',digits:3,series:[{label:'x · forward',x:t,y:L.ax,color:blue},{label:'y · left',x:t,y:L.ay,color:orange}]},
    {title:'Accelerometer z',xlabel,ylabel:'Acceleration (m/s²)',unit:'m/s²',digits:3,series:[{label:'z · up',x:t,y:L.az,color:purple}]},
    {title:`LiDAR scan at t = ${scan.t.toFixed(1)} s`,kind:'polar',rmax:LIDAR.max,digits:3,caption:'0° = rover front, counterclockwise. Gaps = no return.',series:[{label:'Range',x:hits.map(h=>h[0]),y:hits.map(h=>h[1]),color:blue}]},
    {title:'LiDAR ranges',xlabel,ylabel:'Range (m)',unit:'m',digits:3,series:[{label:'Front (0°)',x:t,y:gaps(L.lidarFront),color:blue},{label:'Left (90°)',x:t,y:gaps(L.lidarLeft),color:orange},{label:'Right (270°)',x:t,y:gaps(L.lidarRight),color:purple}]}
  ];
}
function renderPlots(){
  lastPlot=performance.now();const drives=records.filter(r=>r.mode==='drive'),src=plotSource(),live=src&&!src.record;
  $('plot-run').innerHTML=(live?'<option value="live">Current run (recording)</option>':'')+drives.map(r=>`<option value="${r.id}">Run ${records.length-records.indexOf(r)} · ${TERRAINS[terrainOf(r)].label} · ${r.success?'completed':'stopped'}</option>`).join('');
  $('plot-run').value=live?'live':String(plotRunId);$('plot-run').disabled=live||!drives.length;$('plot-csv').disabled=$('plot-lidar').disabled=!src?.sim;
  $('plots-empty').hidden=!!src?.sim;$('plot-grid').hidden=!src?.sim;$('plots-meta').hidden=!src?.sim;
  if(!src?.sim){$('plots-empty').textContent=src?'This saved run could not be replayed. Restore it and run it again.':'No sensor data yet. Run a program from the Code tab and every sensor will be recorded here.';return;}
  const specs=plotSpecs(src.sim);while(figures.length<specs.length)figures.push(new Figure($('plot-grid')));
  if(src.sim!==plotted){plotted=src.sim;figures.forEach(f=>f.setCursor(null));}
  specs.forEach((spec,i)=>figures[i].set(spec));
  const s=src.sim,error=s.summary().odomError,spec=ROBOTS[s.robot];
  $('plots-meta').innerHTML=`<strong>${esc(src.label)}</strong> · ${esc(spec.label)} · ${esc(TERRAINS[s.terrain].surface)} · Encoders ${spec.encoderCpr} counts/rev · IMU ${spec.imu.rate} Hz${s.robot==='turtlebot3'?' with noise and offsets measured on one TurtleBot3':' with MPU-6050-class noise and bias'} · Odometry error ${(error*100).toFixed(1)} cm${src.replayed?' · Replayed from the saved setup and seed':''}<br>In MATLAB: <code>T = readtable('kinetic-${src.name}.csv'); plot(T.t_s, T.gyro_z_rad_s)</code>`;
}
$('plot-lidar').onclick=()=>{const src=plotSource();if(!src?.sim)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toScanCsv(src.sim.scans)],{type:'text/csv'}));a.download=`kinetic-${src.name}-lidar.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(`Saved kinetic-${src.name}-lidar.csv: one row per scan, 0 means no return.`);};
$('plot-run').onchange=e=>{plotRunId=Number(e.target.value);renderPlots();};
$('plot-csv').onclick=()=>{const src=plotSource();if(!src?.sim)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toCsv(src.sim.log)],{type:'text/csv'}));a.download=`kinetic-${src.name}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(`Saved kinetic-${src.name}.csv. Every column name includes its unit.`);};
const modal=$('modal');
function openModal(title,html){$('modal-eyebrow').textContent=title;$('modal-content').innerHTML=html;modal.showModal();}
function guide(){openModal('WELCOME TO KINETIC','<h2>Your first robotics experiment.</h2><p>A robot’s structure changes how it behaves. This workbench makes that connection visible.</p><ol><li><strong>Build.</strong> Choose a preset or move the sliders to position your payload.</li><li><strong>Predict.</strong> Will your rover stay balanced at the target ramp angle?</li><li><strong>Test.</strong> Run the ramp test. Watch the orange gravity line move relative to the green support polygon.</li><li><strong>Improve.</strong> Change one variable and try again. Compare runs in Results.</li></ol><h3>Ready to make it move?</h3><p>Open <strong>Code</strong> to give the wheels instructions. Choose flat, rough, or slippery ground in the builder. After a run, open <strong>Plots</strong> to read the encoders, the IMU, and the motors.</p><p>Your design, code, and last 30 experiments are saved in this browser on this device.</p>');}
function modelDetails(){openModal('UNDER THE HOOD','<h2>A simple model. An honest experiment.</h2><h3>Ramp experiment</h3><p>The chassis (1.8 kg), battery (0.5 kg), and payload contribute to a <strong>mass-weighted center of mass</strong>. The two drive-wheel contacts and rear caster form a triangular support polygon.</p><p>The ramp tilts about the forward axis and lifts the rover’s left side. We intersect a vertical gravity line through the center of mass with the ramp. A signed distance to the nearest polygon edge gives the <strong>balance margin</strong>. Zero means the static tipping boundary.</p><p>This is a <strong>quasi-static model with ideal grip</strong>. It assumes the wheels are held in place during a slow tilt. It does not model slipping, motor torque, deformation, impact, or dynamic balance. The falling motion illustrates loss of support; it is not a contact-physics calculation.</p><h3>Driving experiment</h3><p>The rover is a <strong>planar rigid body</strong>: it moves forward, sideways, and turns. Two <strong>12 V gear motors</strong> drive the 7.5 cm wheels. At the wheel, each motor gives 1.36 N·m at stall and 34.6 rad/s with no load. Each motor has a <strong>speed controller</strong> like real motor firmware: feedforward plus PI on encoder speed, updated 100 times per second.</p><p>Each tire pushes on the ground with a force that depends on how fast it slips. Grip peaks at 5 cm/s of slip, then falls to the sliding value. Peak and sliding friction are μ 0.90 and 0.75 on concrete, 0.65 and 0.55 on gravel, and 0.15 and 0.10 on ice. The model includes rolling resistance and caster drag. It also includes <strong>load transfer</strong>: speeding up moves weight onto the caster, and braking moves it onto the wheels. On rough ground the rover follows bumps of up to 2 cm, so slopes pull on it and the IMU tilts.</p><p><strong>Sensors.</strong> Each wheel has an encoder with 1920 counts per revolution. The IMU is MPU-6050 class, with noise, bias, and 16-bit steps. The front range sensor reaches 3 m, updates 20 times per second, and has about 1% noise. Odometry uses encoder counts only, so it drifts when a wheel slips.</p><p><strong>LiDAR.</strong> Both robots carry an LDS-01-class 2D LiDAR. It takes 360 beams at 1°, 5 scans per second, from 0.12 to 3.5 m, with ±1 cm accuracy below 0.5 m and ±3.5% beyond. Each 10 ms adds the next slice of beams from the pose at that moment, so a moving rover sees a slightly smeared scan, like a real spinning LiDAR. The scan plane stays horizontal and ignores the robot’s own body. Low walls at ±2.5 m surround the arena. The LiDAR and the front range sensor both see them and the box.</p><p><strong>Complementary filter.</strong> A fused heading combines the gyro (good for quick changes, but it drifts with bias) with the encoder heading (no drift while standing still, but wrong when wheels slip or casters drag). The time constant is alpha·T/(1 − alpha). Both errors build up slowly here, so the default alpha of 0.999 (about 10 s) works better than the textbook 0.98. The README has the comparison. Programs can change alpha with <code>filter(alpha)</code>.</p><p><strong>Limits.</strong> There is no suspension, bouncing, or jumping. If a wheel or the caster would lift, the run stops, because dynamic tipping is not simulated. The model assumes gentle slopes. A rover parked on a slope creeps a few millimeters per second, because the friction model depends on slip speed. All parameters are typical datasheet values. Nobody has measured them on a physical robot. This model is realistic, but it is not validated. Collision stopping still uses a conservative circular footprint.</p><h3>TurtleBot3 Waffle Pi</h3><p>This preset is built from the ROBOTIS datasheet: 3.3 cm wheels, 28.7 cm track, 1.8 kg, Dynamixel XM430-W210 servos, 4096-count encoders, two ball casters, and firmware limits of 0.26 m/s and 1.82 rad/s. Two values were then <strong>fitted</strong> to one robot’s ME425 lab measurements. A '+TB3_FIT.battery+' V battery reproduces the 333° circle at v = 0.20 m/s, where the outer wheel reaches the motor’s speed limit. Ball-caster friction of '+TB3_FIT.ballFriction+' reproduces about 9.4° of encoder-minus-IMU drift per turn in place.</p><p>Without further tuning, the model then <strong>predicts</strong> the other circles within the ±3° reading error and the 0.47–0.50 rad/s gyro reading of a 0.5 rad/s spin. It also predicts that odometry overstates straight-line distance by about 3%, which a tape measure could test. It <strong>does not reproduce</strong> the shorter forward legs of the straight-line test. That asymmetry has no cause in this model.</p><p>This is one robot, one floor, and one battery charge, with values read from plots. It is a calibration, not a general validation.</p>');}
function commandReference(){openModal('ROVER SCRIPT REFERENCE','<h2>Small instructions. Real movement.</h2><p><code>wheels(left, right)</code> sets each wheel’s target speed in rad/s, from −10 to 10. Each motor’s speed controller pushes its wheel toward the target. This takes a moment, and on slippery ground a wheel can spin faster than the rover moves. Equal positive speeds drive forward. A faster right wheel turns left. A negative value reverses that wheel.</p><p><code>drive(v, w)</code> commands the whole rover the way <code>/cmd_vel</code> does in ROS: forward speed <code>v</code> in m/s (−0.75 to 0.75) and turn rate <code>w</code> in rad/s (−6 to 6), positive to the left. The rover sets the right wheel to (v + w·W/2)/R and the left wheel to (v − w·W/2)/R, where W is the wheel spacing. If a wheel would need more than 10 rad/s, both wheels slow down together, so the curve keeps its radius.</p><p><code>wait(seconds)</code> lets the simulation advance, from 0.05 to 10 seconds per wait. Wheel commands remain active while waiting.</p><p><code>stop()</code> sets both targets to zero, so the controller brakes. Reaching the end of the program also brakes the robot to a stop. Sudden full-speed reversals can tip a tall rover.</p><pre>drive(0, 1)\nwhile heading &lt; 90\n  wait(0.05)\nend\nstop()</pre><p><code>repeat N</code> repeats a block 1–20 times. <code>while sensor &lt; N</code> repeats a block for as long as the test is true. <code>if sensor &lt; N</code> runs a block once, and <code>else</code> is optional. Tests can use <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code> or <code>&gt;=</code>. Close each block with <code>end</code>. Use <code>#</code> for comments.</p><h3>Sensors your program can read</h3><ul><li><code>distance</code>: front range sensor, in meters. It updates 20 times per second, has about 1% noise, and reads 3 when nothing is ahead.</li><li><code>heading</code>: IMU heading in degrees, positive to the left. It integrates the gyro, so it drifts slowly.</li><li><code>odom_heading</code>: heading from the wheel encoders in degrees. It goes wrong when wheels slip.</li><li><code>gyro_z</code>: IMU turn rate in rad/s.</li><li><code>encoder_left</code>, <code>encoder_right</code>: encoder counts since the start, 1920 per wheel revolution.</li><li><code>odom_x</code>, <code>odom_y</code>: encoder odometry position in meters. x is forward from the start and y is to the left.</li><li><code>time</code>: seconds since the run started.</li><li><code>lidar_front</code>, <code>lidar_left</code>, <code>lidar_back</code>, <code>lidar_right</code>: 2D LiDAR range in meters at 0°, 90°, 180°, and 270°. It reads 0 when something is closer than 0.12 m, and it reads infinity when nothing is within 3.5 m.</li><li><code>lidar_min</code>, <code>lidar_min_angle</code>: the closest LiDAR return in meters, and its direction in degrees counterclockwise from the front.</li><li><code>fused_heading</code>, <code>fused_x</code>, <code>fused_y</code>: heading in degrees and position in meters from the complementary filter.</li></ul><h3>Complementary filter</h3><p><code>filter(alpha)</code> sets how much the fused heading trusts the gyro, from 0 to 1. Every 0.01 s, the fused heading becomes alpha × (fused heading + gyro turn) + (1 − alpha) × encoder heading. With 1 it trusts only the gyro, and with 0 only the encoders. The default is 0.999, which hands over from gyro to encoders over about 10 s. Filtered odometry adds up encoder distance along the fused heading.</p><p>The program sees the latest sensor sample, never the true position. Sensors update every 0.01 s, the range sensor every 0.05 s, and the LiDAR every 0.2 s, so a loop reacts a little late. Put a short <code>wait</code> in every loop. A loop without one stops with an instruction-limit message. Runs stop after 30 seconds.</p><h3>A bridge to your next tools</h3><p>This is a teaching language. Later, the same wheel-command, sensor-reading, loop, and timing concepts can be expressed in MATLAB or a ROS 2 controller. Live MATLAB and ROS 2 connections are not part of this first lab.</p>');}
function learningPath(){openModal('YOUR LEARNING PATH','<h2>One discovery at a time.</h2><div class="roadmap-item"><span>01</span><div><strong>Structure & balance</strong><small>Center of mass · Support polygon · Ramp tests</small></div><b>IN THIS LAB</b></div><div class="roadmap-item"><span>02</span><div><strong>Make a rover move</strong><small>Wheel speeds · Terrain · Encoders, IMU & plots</small></div><b>IN THIS LAB</b></div><div class="roadmap-item"><span>03</span><div><strong>Movement in every direction</strong><small>Omniwheels · Holonomic movement</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><span>04</span><div><strong>Reach, pick & place</strong><small>Industrial arms · Joints · Torque</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><span>05</span><div><strong>A balancing act</strong><small>Humanoids · Standing · Weight shifts</small></div><b class="later">PLANNED</b></div>');}
['guide','help'].forEach(id=>$(id).onclick=guide);$('lab-nav').onclick=()=>{changeTab('build');window.scrollTo({top:0,behavior:'smooth'});};$('lessons-nav').onclick=learningPath;
['notebook','notebook-nav'].forEach(id=>$(id).onclick=()=>{changeTab('results');$('results-panel').scrollIntoView({behavior:'smooth',block:'nearest'});});
const lessonTwo=()=>openModal('EXPERIMENT 02 · WHERE AM I?','<h2>Can your rover tell where it is?</h2><p>A real robot cannot see its own position. It has to <strong>estimate</strong> it. Encoders count wheel turns, so <strong>odometry</strong> adds those turns up into a position and heading. The <strong>IMU</strong> measures how fast the body turns, and adding that up over time gives a heading that drifts slowly.</p><p>Both estimates go wrong in their own ways. Wheels slip and casters drag, and gyros have bias. In a lab you need a camera system or a tape measure to know the truth. This simulator always knows it, and the missions are judged on it. Your program never sees it.</p><ol><li><strong>Stop 20 cm from the box.</strong> The sensor and your loop react late, and braking takes distance.</li><li><strong>Turn exactly once around</strong> on the TurtleBot3. Should you trust the encoders or the IMU?</li><li><strong>Close a square on ice.</strong> Time is not distance, and wheel turns are not body turns.</li></ol><p>Each starter script falls short on purpose. Run it, open <strong>Plots</strong> to see why, change one thing, and try again.</p>');
const lessonOne=()=>openModal('EXPERIMENT 01 · CARRY THE LOAD','<h2>Can you keep the load balanced?</h2><p>Start with the balanced rover and a 25° ramp. The green triangle joins the three places where the robot touches the surface. This is its <strong>support polygon</strong>.</p><p>The orange point is its <strong>center of mass</strong>. The dashed vertical line follows gravity to the surface. When that line reaches a polygon edge, static support is lost.</p><ol><li>Run the balanced preset.</li><li>Try the top-heavy preset at the same target angle.</li><li>Lower only the payload height and test again.</li><li>Compare your predictions and tipping angles in Results.</li></ol><p><strong>Think about it:</strong> Can changing payload height affect balance on a flat floor? What changes when the floor tilts?</p>');
$('lesson-details').onclick=()=>lesson===2?lessonTwo():lessonOne();
$('model-details').onclick=modelDetails;$('code-reference').onclick=commandReference;
$('margin-help').onclick=()=>openModal('READING YOUR ROBOT','<h2>What is balance margin?</h2><p>It is the shortest signed distance from the gravity-line intersection to an edge of the support polygon, measured along the ramp surface.</p><p><strong>Positive:</strong> inside the polygon.<br><strong>Zero:</strong> at the static tipping boundary.<br><strong>Negative:</strong> outside the polygon.</p><p>On the ramp, the margin describes the static model. While driving, it also includes acceleration. Braking moves the point forward and speeding up moves it back. If the point reaches an edge, a wheel or the caster lifts and the run stops.</p>');
$('robot-picker').onclick=()=>{const option=(id,name,detail)=>`<button class="roadmap-item robot-option" data-robot="${id}"><span>${icon('robot')}</span><div><strong>${name}</strong><small>${detail}</small></div><b${robot===id?'':' class="later"'}>${robot===id?'SELECTED':'CHOOSE'}</b></button>`;
  openModal('CHOOSE YOUR ROBOT','<h2>Start with the foundations.</h2>'+option('kinetic','Kinetic rover','Two driven wheels and one rear caster. Adjustable structure, ramp and driving experiments.')+option('turtlebot3','TurtleBot3 Waffle Pi','The ME425 lab robot. Calibrated to one robot’s lab measurements. Driving only.')+'<div class="roadmap-item"><div><strong>Omnidirectional mobile robot</strong><small>Compare sideways motion and wheel configurations</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><div><strong>Industrial arm</strong><small>Explore reach, joints, and payloads</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><div><strong>Humanoid</strong><small>Start with standing and weight shifts</small></div><b class="later">PLANNED</b></div><p>We’re building the lab one robot at a time. Both differential-drive robots are available in this version.</p>');
  document.querySelectorAll('[data-robot]').forEach(b=>b.onclick=()=>{setRobot(b.dataset.robot);persist();modal.close();toast(`${ROBOTS[robot].label} selected.`);});};
$('modal-close').onclick=$('modal-done').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
document.addEventListener('keydown',e=>{if(e.key==='?'&&!['TEXTAREA','INPUT'].includes(document.activeElement.tagName)&&!modal.open)guide();});
$('code-editor').value=code;
function updateLines(){$('line-numbers').textContent=$('code-editor').value.split('\n').map((_,i)=>i+1).join('\n');}
$('code-editor').addEventListener('input',()=>{if(state.status!=='idle')reset();updateLines();persist();});
$('code-editor').addEventListener('scroll',()=>$('line-numbers').scrollTop=$('code-editor').scrollTop);
$('code-editor').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const el=e.target,start=el.selectionStart;el.setRangeText('  ',start,el.selectionEnd,'end');el.dispatchEvent(new Event('input'));}});
$('code-example').onchange=e=>{reset();$('code-editor').value=EXAMPLES[e.target.value];updateLines();persist();};

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
  const v=mode==='drive'?view():null;focus=v?{x:v.x*.65,z:v.z*.65}:{x:0,z:0};bodyFrame=v?.frame||null;
  ctx.clearRect(0,0,cw,ch);const bg=ctx.createLinearGradient(0,0,0,ch);bg.addColorStop(0,'#f4f5f2');bg.addColorStop(1,'#edf0ed');ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
  const ground=v=>world(v,false),surface=mode==='drive'?terrain:'flat',lift=(x,z,dy=.004)=>({x,y:terrainHeight(surface,x,z)+dy,z});
  if(surface==='rough'){
    // True bump heights (about 2 cm) are too small to see at this scale, so slope shading shows them.
    const s=.15,h=(x,z)=>terrainHeight('rough',x,z);
    for(let i=-16;i<16;i++)for(let j=-16;j<16;j++){const x0=i*s,z0=j*s,x1=x0+s,z1=z0+s,a=h(x0,z0),b=h(x1,z0),c=h(x1,z1),d=h(x0,z1),gx=(b+c-a-d)/(2*s),gz=(c+d-a-b)/(2*s),k=Math.max(-1,Math.min(1,(gx*.6+gz*.4)*5));
      const col=`rgb(${Math.round(222+k*20)},${Math.round(218+k*20)},${Math.round(206+k*20)})`;poly([{x:x0,y:a,z:z0},{x:x1,y:b,z:z0},{x:x1,y:c,z:z1},{x:x0,y:d,z:z1}],col,col,.6);}
  }else{
    const icy=surface==='slippery'&&mode==='drive';
    if(icy){poly([{x:-2.8,y:-.012,z:-2.8},{x:2.8,y:-.012,z:-2.8},{x:2.8,y:-.012,z:2.8},{x:-2.8,y:-.012,z:2.8}],'#e5eff4');for(const k of [-1.7,-.5,.8,1.9])line({x:k-.5,y:-.011,z:-2.5},{x:k+.5,y:-.011,z:2.5},'#f6fafc',4);}
    for(let i=-14;i<=14;i++){const n=i*.2,col=icy?'#d2e2ea':'#e3e8e2';line(ground({x:n,y:-.012,z:-2.8}),ground({x:n,y:-.012,z:2.8}),col,.7);line(ground({x:-2.8,y:-.012,z:n}),ground({x:2.8,y:-.012,z:n}),col,.7);}
  }
  if(mode==='tilt'){
    poly([{x:-.82,y:-.009,z:-.65},{x:.82,y:-.009,z:-.65},{x:.82,y:-.009,z:.65},{x:-.82,y:-.009,z:.65}].map(ground),'#f5f6f1','#cbd3c9',1);
    for(let i=-7;i<=7;i++)line(ground({x:i*.1,y:-.008,z:-.65}),ground({x:i*.1,y:-.008,z:.65}),'#e6e9e1',.65);
    for(let i=-6;i<=6;i++)line(ground({x:-.82,y:-.008,z:i*.1}),ground({x:.82,y:-.008,z:i*.1}),'#e6e9e1',.65);
    const A=project(ground({x:.7,y:0,z:-.55}));ctx.fillStyle='#a3ada1';ctx.font='8px monospace';ctx.fillText('TILT TABLE / '+state.angle.toFixed(1)+'°',Math.max(12,Math.min(cw-130,A.x-100)),Math.max(20,Math.min(ch-110,A.y)));
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
setTerrain(terrain);setRobot(robot);setLesson(lesson,false);updateInputs();updateLines();updateTelemetry();renderResults();requestAnimationFrame(frame);
