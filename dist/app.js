import {DEFAULT,PRESETS,centerOfMass,contacts,balance,criticalAngle,stepDrive,parseProgram,WHEEL_RADIUS} from './physics.mjs';

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
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.box}</svg>`;}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

const EXAMPLES={
  turn:'# Both wheel speeds are in rad/s.\n# The rover moves while it waits.\nwheels(4, 4)\nwait(1.2)\nwheels(2, 5)\nwait(1.5)\nstop()',
  square:'# Tune the turn time to close the square.\nrepeat 4\n  wheels(4, 4)\n  wait(1.4)\n  wheels(4, -4)\n  wait(1.15)\nend\nstop()',
  sensor:'# distance is a front ray sensor, in meters.\n# Sample it once every 0.1 seconds.\nrepeat 20\n  if distance < 0.4\n    stop()\n  else\n    wheels(4, 4)\n  end\n  wait(0.1)\nend\nstop()'
};
let p={...DEFAULT},records=[],code=EXAMPLES.turn;
try{const saved=JSON.parse(localStorage.getItem('kinetic-v1')||'null');if(saved){for(const k of Object.keys(DEFAULT)){const input=$(k),v=Number(saved.design?.[k]);if(Number.isFinite(v))p[k]=Math.max(+input.min,Math.min(+input.max,v));}if(typeof saved.code==='string'&&saved.code.length<15000)code=saved.code;if(Array.isArray(saved.records))records=saved.records.slice(0,30).filter(r=>r&&['tilt','drive'].includes(r.mode)&&r.design&&typeof r.message==='string');}}catch{}
let tab='build',mode='tilt',prediction=null,showCom=true,showSupport=true;
let state={status:'idle',angle:0,time:0,pose:{x:0,z:0,heading:0},l:0,r:0,path:[],tip:0,targetTip:0,minMargin:1,runDesign:null};
let program=[],queue=[],waitRemaining=0,instructions=0,programTime=0,toastTimer;
const canvas=$('scene'),ctx=canvas.getContext('2d');
let cw=800,ch=536,zoom=1,yaw=0.73,elevation=0.43,drag=null,lastFrame=0,needsRender=true;
const obstacle={x:0,z:1.3,halfX:.28,halfZ:.16};
function persist(){try{localStorage.setItem('kinetic-v1',JSON.stringify({design:p,code:$('code-editor').value,records}));$('save-status').textContent='Saved on this device';}catch{$('save-status').textContent='Saving unavailable';}}
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function changeTab(next){tab=next;document.body.dataset.tab=next;for(const t of ['build','code','results']){$(`${t}-tab`).classList.toggle('active',t===next);$(`${t}-tab`).setAttribute('aria-selected',t===next);}$('code-panel').hidden=next!=='code';$('results-panel').hidden=next!=='results';if(next==='code'&&mode!=='drive')changeMode('drive');if(next==='results')renderResults();needsRender=true;}
['build','code','results'].forEach(t=>$(`${t}-tab`).onclick=()=>changeTab(t));
function updateInputs(){
  for(const k of Object.keys(DEFAULT)){
    const el=$(k);el.value=p[k];const unit=k==='mass'?'kg':k==='target'?'°':'cm';
    $(`${k}-output`).innerHTML=`${k==='mass'?p[k].toFixed(1):p[k]} <small>${unit}</small>`;
    el.style.background=`linear-gradient(to right,var(--orange) ${(p[k]-el.min)/(el.max-el.min)*100}%,#e9ecef ${(p[k]-el.min)/(el.max-el.min)*100}%)`;
  }
  document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',Object.keys(p).every(k=>p[k]===PRESETS[b.dataset.preset][k])));
  needsRender=true;
}
for(const k of Object.keys(DEFAULT))$(k).addEventListener('input',e=>{if(['running','paused','done'].includes(state.status))reset();p[k]=Number(e.target.value);updateInputs();persist();updateTelemetry();});
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{reset();p={...PRESETS[b.dataset.preset]};updateInputs();persist();updateTelemetry();$('discovery-title').textContent=b.dataset.preset==='tall'?'Same idea, a much higher center of mass.':b.dataset.preset==='offset'?'A payload near the edge leaves less room for balance.':'A wider stance gives your robot more room to balance.';$('discovery-copy').textContent=b.dataset.preset==='tall'?'The mass is high above a narrow base. Will it reach the target ramp angle? Make a prediction and test it.':b.dataset.preset==='offset'?'The ramp rises on the right. Gravity shifts the load toward the left edge. Try moving the payload to the right.':'Try the top-heavy preset. Predict what will happen, then watch the center of mass as the ramp tilts.';});
for(const [id,value] of [['predict-stable','stable'],['predict-tip','tip']])$(id).onclick=()=>{if(state.status==='running'||state.status==='paused'){toast('Reset the experiment before changing your prediction.');return;}prediction=prediction===value?null:value;updatePrediction();};
function updatePrediction(){ $('predict-stable').setAttribute('aria-pressed',prediction==='stable');$('predict-tip').setAttribute('aria-pressed',prediction==='tip');}
$('show-com').onchange=e=>{showCom=e.target.checked;needsRender=true;};$('show-support').onchange=e=>{showSupport=e.target.checked;needsRender=true;};
$('experiment-mode').onchange=e=>changeMode(e.target.value);
function changeMode(next){reset();mode=next;$('experiment-mode').value=next;$('tilt-setting').hidden=next!=='tilt';$('drive-setting').hidden=next!=='drive';$('model-note').textContent=next==='tilt'?'Quasi-static balance model · Ideal grip · No sliding or impact physics':'Ideal no-slip wheel kinematics · Ray distance sensor · Flat surface';$('stage-subtitle').textContent=next==='tilt'?'Two powered wheels. One little caster. Endless ideas.':'Give each wheel a speed. Watch the path take shape.';document.querySelector('.prediction-card').hidden=next==='drive';updateTelemetry();needsRender=true;}
function reset(){state={status:'idle',angle:0,time:0,pose:{x:0,z:0,heading:0},l:0,r:0,path:[],tip:0,targetTip:0,minMargin:1,runDesign:null};queue=[];waitRemaining=0;instructions=0;programTime=0;$('stage-outcome').hidden=true;$('code-error').hidden=true;$('code-progress').textContent='Edit the script, then run your experiment.';setRunButton();updateTelemetry();needsRender=true;}
function setRunButton(){const running=state.status==='running',paused=state.status==='paused';$('run').innerHTML=icon(running?'pause':'play')+`<span id="run-text">${running?'Pause':paused?'Resume':'Run experiment'}</span>`;$('scene-status').innerHTML=`<i></i>${running?'Experiment in progress':paused?'Experiment paused':state.status==='done'?'Experiment complete':'Ready to experiment'}`;}
$('reset').onclick=()=>{reset();toast('Experiment reset. Your design is ready.');};
$('run').onclick=()=>{
  if(state.status==='running'){state.status='paused';setRunButton();return;}
  if(state.status==='paused'){state.status='running';setRunButton();return;}
  reset();
  if(mode==='drive'){
    try{program=parseProgram($('code-editor').value);queue=[...program];}catch(e){changeTab('code');$('code-error').textContent=e.message;$('code-error').hidden=false;toast('Check the highlighted program message.');return;}
    if(!balance(p,0).stable){toast('Your rover is already outside its support polygon. Balance the payload before driving.');return;}
  }
  state.status='running';state.runDesign={...p};state.minMargin=balance(p,0).margin;state.runPrediction=prediction;setRunButton();needsRender=true;
};
function finish(success,message){
  state.status='done';state.l=0;state.r=0;setRunButton();
  $('stage-outcome').hidden=false;$('stage-outcome').classList.toggle('failed',!success);$('stage-outcome').textContent=message;
  if(mode==='drive')$('code-progress').textContent=`${message} · ${programTime.toFixed(1)} s`;
  records.unshift({id:Date.now(),mode,design:{...state.runDesign},success,message,angle:state.angle,time:mode==='drive'?programTime:state.time,margin:state.minMargin,prediction:state.runPrediction||null,code:mode==='drive'?$('code-editor').value:null});records=records.slice(0,30);persist();renderResults();
  $('discovery-title').textContent=mode==='tilt'?(success?'Your rover held its balance. What could you change next?':'The gravity line crossed the edge of the support polygon.'):'Your instructions became a path.';
  $('discovery-copy').textContent=mode==='tilt'?(success?'Try increasing the payload height while keeping everything else the same. Can you find the tipping point?':'Try lowering the payload, widening the wheel spacing, or shifting the load uphill. Change one thing and test again.'):'Different wheel speeds make the rover turn. Compare this run with a new script in your Results tab.';
}
function sensorDistance(){
  const {x,z,heading}=state.pose,dx=Math.sin(heading),dz=Math.cos(heading),ox=x+dx*.3,oz=z+dz*.3;
  let near=0,far=3;
  for(const [o,d,min,max] of [[ox,dx,obstacle.x-obstacle.halfX,obstacle.x+obstacle.halfX],[oz,dz,obstacle.z-obstacle.halfZ,obstacle.z+obstacle.halfZ]]){
    if(Math.abs(d)<1e-8){if(o<min||o>max)return 3;continue;}
    const a=(min-o)/d,b=(max-o)/d;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
  }
  return far>=near&&far>=0?Math.max(0,near):3;
}
function execute(dt){
  let remaining=dt,guard=0;
  while(remaining>1e-7&&state.status==='running'){
    if(waitRemaining>0){
      const used=Math.min(remaining,waitRemaining),next=stepDrive(state.pose,state.l,state.r,p.width,used);
      const radius=Math.hypot(p.width/200+.03,.25);
      const hit=Math.abs(next.x-obstacle.x)<obstacle.halfX+radius&&Math.abs(next.z-obstacle.z)<obstacle.halfZ+radius;
      if(hit){finish(false,'Stopped: rover reached the obstacle.');return;}
      if(Math.abs(next.x)>2.3||Math.abs(next.z)>2.3){finish(false,'Stopped at the edge of the test area.');return;}
      state.pose=next;waitRemaining-=used;remaining-=used;programTime+=used;
      if(!state.path.length||Math.hypot(next.x-state.path.at(-1).x,next.z-state.path.at(-1).z)>.018)state.path.push({...next});
      if(programTime>=30){finish(false,'Stopped: 30-second experiment limit.');return;}
    }else{
      if(++guard>500||++instructions>10000){finish(false,'Stopped: instruction limit reached. Add waits to your loops.');return;}
      const n=queue.shift();if(!n){finish(true,'Program complete. Explore your results.');return;}
      state.line=n.line;
      if(n.type==='wheels'){state.l=n.l;state.r=n.r;}
      else if(n.type==='wait')waitRemaining=n.time;
      else if(n.type==='repeat')queue.unshift(...Array.from({length:n.n},()=>n.body).flat());
      else if(n.type==='if')queue.unshift(...(sensorDistance()<n.distance?n.body:n.other));
    }
  }
}
function tick(dt){
  if(state.status==='running'){
    state.time+=dt;
    if(mode==='tilt'){
      const threshold=criticalAngle(p);state.angle=Math.min(p.target,state.angle+dt*5);
      if(state.angle>=threshold){state.angle=threshold;state.targetTip=1;state.minMargin=Math.min(state.minMargin,0);finish(false,`Static support lost at ${threshold.toFixed(1)}°`);}
      else{state.minMargin=Math.min(state.minMargin,balance(p,state.angle).margin);if(state.angle>=p.target)finish(true,`Balanced at ${p.target}°. Nice work.`);}
    }else execute(dt);
    updateTelemetry();needsRender=true;
  }
  if(Math.abs(state.tip-state.targetTip)>.001){state.tip+=(state.targetTip-state.tip)*Math.min(1,dt*4);needsRender=true;}
}
function updateTelemetry(){
  const b=balance(p,state.angle);$('metric-mass').innerHTML=`${b.com.mass.toFixed(1)} <small>kg</small>`;$('metric-height').innerHTML=`${(b.com.y*100).toFixed(1)} <small>cm</small>`;
  $('metric-margin').innerHTML=`${b.margin>=0?'+':''}${(b.margin*100).toFixed(1)} <small>cm</small>`;$('metric-margin').style.color=b.margin<=.001?'#ca6544':b.margin<.02?'#b9954e':'#308574';$('metric-tilt').previousElementSibling.textContent=mode==='drive'?'FRONT SENSOR':'SURFACE TILT';$('metric-tilt').innerHTML=mode==='drive'?`${sensorDistance().toFixed(2)} <small>m</small>`:`${state.angle.toFixed(1)}<small>°</small>`;
  if(mode==='drive'&&state.status==='running')$('code-progress').textContent=`Executing line ${state.line||1} · ${programTime.toFixed(1)} s · Front distance ${sensorDistance().toFixed(2)} m`;
}
function renderResults(){
  $('result-count').textContent=records.length;
  if(!records.length){$('results-list').innerHTML='<div class="empty-state">Your notebook starts with a question.<br>Make a prediction and run your first experiment.<br><button class="text-button" id="back-build">Back to the builder →</button></div>';$('back-build').onclick=()=>changeTab('build');return;}
  $('results-list').innerHTML=records.map((r,i)=>`<article class="result-card"><div class="result-card-top"><h4>${r.mode==='tilt'?'Ramp balance test':'Rover program'} <span style="color:#a5afb9;font-size:9px"> / ${records.length-i}</span></h4><span class="result-badge ${r.success?'':'fail'}">${r.success?'COMPLETED':r.mode==='tilt'?'TIPPED':'STOPPED'}</span></div><p>${esc(r.message)} ${r.mode==='tilt'?(r.prediction?`Your prediction: <strong>${r.prediction==='stable'?'it would hold':'it would tip'}</strong>. ${((r.prediction==='stable')===r.success)?'Your prediction matched.':'A useful surprise—try changing one variable.'}`:'No prediction recorded. Make one before your next test.'):''}</p><div class="result-specs">Wheel spacing ${Number(r.design.width)} cm · Payload ${Number(r.design.mass).toFixed(1)} kg · Height ${Number(r.design.height)} cm · Offset ${Number(r.design.offset)} cm${r.mode==='drive'?` · ${Number(r.time).toFixed(1)} s`:` · Target ${Number(r.design.target)}°`}</div><button class="text-button" data-restore="${i}">Restore this setup ↗</button></article>`).join('');
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const r=records[+b.dataset.restore];reset();p={...DEFAULT,...r.design};changeMode(r.mode);if(r.code){$('code-editor').value=r.code;updateLines();}updateInputs();updateTelemetry();persist();changeTab(r.mode==='drive'?'code':'build');toast('Experiment setup restored.');});
}
const modal=$('modal');
function openModal(title,html){$('modal-eyebrow').textContent=title;$('modal-content').innerHTML=html;modal.showModal();}
function guide(){openModal('WELCOME TO KINETIC','<h2>Your first robotics experiment.</h2><p>A robot’s structure changes how it behaves. This workbench makes that connection visible.</p><ol><li><strong>Build.</strong> Choose a preset or move the sliders to position your payload.</li><li><strong>Predict.</strong> Will your rover stay balanced at the target ramp angle?</li><li><strong>Test.</strong> Run the ramp test. Watch the orange gravity line move relative to the green support polygon.</li><li><strong>Improve.</strong> Change one variable and try again. Compare runs in Results.</li></ol><h3>Ready to make it move?</h3><p>Open <strong>Code</strong> to give the wheels instructions. This switches to a flat driving area with a front distance sensor.</p><p>Your design, code, and last 30 experiments are saved in this browser on this device.</p>');}
function modelDetails(){openModal('UNDER THE HOOD','<h2>A simple model. An honest experiment.</h2><h3>Ramp experiment</h3><p>The chassis (1.8 kg), battery (0.5 kg), and payload contribute to a <strong>mass-weighted center of mass</strong>. The two drive-wheel contacts and rear caster form a triangular support polygon.</p><p>The ramp rises to the right. We intersect a vertical gravity line through the center of mass with the ramp. A signed distance to the nearest polygon edge gives the <strong>balance margin</strong>. Zero means the static tipping boundary.</p><p>This is a <strong>quasi-static model with ideal grip</strong>. It assumes the wheels are held in place during a slow tilt. It does not model slipping, motor torque, deformation, impact, or dynamic balance. The falling motion illustrates loss of support; it is not a contact-physics calculation.</p><h3>Driving experiment</h3><p>A separate <strong>ideal differential-drive kinematic model</strong> uses wheel speeds, 7.5 cm wheel radius, and your selected wheel spacing. There is no sideways slip, acceleration model, or dynamic tipping calculation. A front ray sensor measures the orange obstacle up to 3 m away. Collision stopping uses a conservative circular rover footprint.</p><p>These models teach specific ideas. Matching a physical robot will require measured dimensions, friction, actuators, and validation experiments in a later version.</p>');}
function commandReference(){openModal('ROVER SCRIPT REFERENCE','<h2>Small instructions. Real movement.</h2><p><code>wheels(left, right)</code> sets angular speeds in rad/s, from −10 to 10. Equal positive speeds move forward; different speeds turn. A negative value reverses that wheel.</p><p><code>wait(seconds)</code> lets the simulation advance, from 0.05 to 10 seconds per wait. Wheel commands remain active while waiting.</p><p><code>stop()</code> sets both wheel speeds to zero. Reaching the end of the program also stops the robot.</p><pre>repeat 3\n  if distance &lt; 0.4\n    stop()\n  else\n    wheels(4, 4)\n  end\n  wait(0.1)\nend\nstop()</pre><p><code>repeat N</code> repeats a block 1–20 times. <code>if distance &lt; N</code> checks the front sensor in meters; <code>else</code> is optional. Close each block with <code>end</code>. Use <code>#</code> for comments.</p><p>Distance is sampled when the if statement runs. Use a repeat block with short waits for repeated sensing. Runs stop after 30 seconds.</p><h3>A bridge to your next tools</h3><p>This is a teaching language. Later, the same wheel-command, sensor-reading, loop, and timing concepts can be expressed in MATLAB or a ROS 2 controller. Live MATLAB and ROS 2 connections are not part of this first lab.</p>');}
function learningPath(){openModal('YOUR LEARNING PATH','<h2>One discovery at a time.</h2><div class="roadmap-item"><span>01</span><div><strong>Structure & balance</strong><small>Center of mass · Support polygon · Ramp tests</small></div><b>IN THIS LAB</b></div><div class="roadmap-item"><span>02</span><div><strong>Make a rover move</strong><small>Wheel speeds · Turning · Loops · A distance sensor</small></div><b>IN THIS LAB</b></div><div class="roadmap-item"><span>03</span><div><strong>Movement in every direction</strong><small>Omniwheels · Holonomic movement</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><span>04</span><div><strong>Reach, pick & place</strong><small>Industrial arms · Joints · Torque</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><span>05</span><div><strong>A balancing act</strong><small>Humanoids · Standing · Weight shifts</small></div><b class="later">PLANNED</b></div>');}
['guide','help'].forEach(id=>$(id).onclick=guide);$('lab-nav').onclick=()=>{changeTab('build');window.scrollTo({top:0,behavior:'smooth'});};$('lessons-nav').onclick=learningPath;
['notebook','notebook-nav'].forEach(id=>$(id).onclick=()=>{changeTab('results');$('results-panel').scrollIntoView({behavior:'smooth',block:'nearest'});});
$('lesson-details').onclick=()=>openModal('EXPERIMENT 01 · CARRY THE LOAD','<h2>Can you keep the load balanced?</h2><p>Start with the balanced rover and a 25° ramp. The green triangle joins the three places where the robot touches the surface. This is its <strong>support polygon</strong>.</p><p>The orange point is its <strong>center of mass</strong>. The dashed vertical line follows gravity to the surface. When that line reaches a polygon edge, static support is lost.</p><ol><li>Run the balanced preset.</li><li>Try the top-heavy preset at the same target angle.</li><li>Lower only the payload height and test again.</li><li>Compare your predictions and tipping angles in Results.</li></ol><p><strong>Think about it:</strong> Can changing payload height affect balance on a flat floor? What changes when the floor tilts?</p>');
$('model-details').onclick=modelDetails;$('code-reference').onclick=commandReference;
$('margin-help').onclick=()=>openModal('READING YOUR ROBOT','<h2>What is balance margin?</h2><p>It is the shortest signed distance from the gravity-line intersection to an edge of the support polygon, measured along the ramp surface.</p><p><strong>Positive:</strong> inside the polygon.<br><strong>Zero:</strong> at the static tipping boundary.<br><strong>Negative:</strong> outside the polygon.</p><p>The margin describes this static model. It does not guarantee stability during motion or when the robot can slip.</p>');
$('robot-picker').onclick=()=>openModal('CHOOSE YOUR ROBOT','<h2>Start with the foundations.</h2><div class="roadmap-item"><span>'+icon('robot')+'</span><div><strong>Differential-drive rover</strong><small>Two driven wheels and one rear caster</small></div><b>SELECTED</b></div><div class="roadmap-item"><div><strong>Omnidirectional mobile robot</strong><small>Compare sideways motion and wheel configurations</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><div><strong>Industrial arm</strong><small>Explore reach, joints, and payloads</small></div><b class="later">PLANNED</b></div><div class="roadmap-item"><div><strong>Humanoid</strong><small>Start with standing and weight shifts</small></div><b class="later">PLANNED</b></div><p>We’re building the lab one robot at a time. The rover is fully available in this version.</p>');
$('modal-close').onclick=$('modal-done').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
document.addEventListener('keydown',e=>{if(e.key==='?'&&!['TEXTAREA','INPUT'].includes(document.activeElement.tagName)&&!modal.open)guide();});
$('code-editor').value=code;
function updateLines(){$('line-numbers').textContent=$('code-editor').value.split('\n').map((_,i)=>i+1).join('\n');}
$('code-editor').addEventListener('input',()=>{if(state.status!=='idle')reset();updateLines();persist();});
$('code-editor').addEventListener('scroll',()=>$('line-numbers').scrollTop=$('code-editor').scrollTop);
$('code-editor').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const el=e.target,start=el.selectionStart;el.setRangeText('  ',start,el.selectionEnd,'end');el.dispatchEvent(new Event('input'));}});
$('code-example').onchange=e=>{reset();$('code-editor').value=EXAMPLES[e.target.value];updateLines();persist();};

// Lightweight orthographic 3D renderer. Geometry and the model share SI coordinates.
function project(v){const c=Math.cos(yaw),s=Math.sin(yaw),ce=Math.cos(elevation),se=Math.sin(elevation);const focus=mode==='drive'?{x:state.pose.x*.65,z:state.pose.z*.65}:{x:0,z:0};const x=v.x-focus.x,z=v.z-focus.z,y=v.y-.15;const autoFit=Math.min(1,.5/(.26+p.height/100));const scale=Math.min(cw*.8,ch*1.05)*zoom*autoFit;return {x:cw*.5+(c*x-s*z)*scale,y:ch*.56-(-s*se*x+ce*y-c*se*z)*scale,d:s*ce*x+se*y+c*ce*z};}
function world(v,robot=false){
  let {x,y,z}=v;
  if(robot&&state.tip){const pivot=-p.width/200,theta=state.tip*1.22;const a=x-pivot;x=pivot+a*Math.cos(theta)-y*Math.sin(theta);y=a*Math.sin(theta)+y*Math.cos(theta);}
  if(mode==='drive'&&robot){const h=state.pose.heading;const nx=x*Math.cos(h)+z*Math.sin(h);z=-x*Math.sin(h)+z*Math.cos(h)+state.pose.z;x=nx+state.pose.x;}
  const a=state.angle*Math.PI/180;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a),z};
}
function poly(points,fill,stroke=null,width=1,dash=[]){const q=points.map(project);ctx.beginPath();q.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.setLineDash(dash);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}}
function line(a,b,color,width=1,dash=[]){const A=project(a),B=project(b);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.setLineDash(dash);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}
let faces=[];
function face(vs,color){faces.push({vs,color,depth:vs.reduce((s,v)=>s+project(v).d,0)/vs.length});}
function box(x,y,z,w,h,d,colors,transform=v=>world(v,true)){
  const vertices=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>transform({x:x+a*w/2,y:y+b*h/2,z:z+c*d/2}));
  const ix=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
  const palette=Array.isArray(colors)?colors:Array(6).fill(colors);ix.forEach((f,i)=>face(f.map(n=>vertices[n]),palette[i]));
}
function wheel(x,y,z,r,w,small=false){
  const n=20;const rings=[-1,1].map(side=>Array.from({length:n},(_,i)=>world({x:x+side*w/2,y:y+Math.cos(i/n*Math.PI*2)*r,z:z+Math.sin(i/n*Math.PI*2)*r},true)));
  face(rings[0],'#28333c');face(rings[1],'#34414a');for(let i=0;i<n;i++){const b=(i+1)%n,shade=Math.round(43+Math.cos(i/n*Math.PI*2)*13);face([rings[0][i],rings[1][i],rings[1][b],rings[0][b]],`rgb(${shade},${shade+11},${shade+15})`);}
  if(!small){for(const side of [-1,1]){const hub=Array.from({length:n},(_,i)=>world({x:x+side*(w/2+.001),y:y+Math.cos(i/n*Math.PI*2)*r*.55,z:z+Math.sin(i/n*Math.PI*2)*r*.55},true));face(hub,side===1?'#a6b2b9':'#87979f');const cap=Array.from({length:n},(_,i)=>world({x:x+side*(w/2+.002),y:y+Math.cos(i/n*Math.PI*2)*r*.23,z:z+Math.sin(i/n*Math.PI*2)*r*.23},true));face(cap,'#526470');}}
}
function circle3(v,r,fill,stroke=null){const q=project(v);ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function render(){
  document.querySelector('.stage-scale>span').style.width=(Math.min(cw*.8,ch*1.05)*zoom*Math.min(1,.5/(.26+p.height/100))*.2)+'px';
  ctx.clearRect(0,0,cw,ch);const bg=ctx.createLinearGradient(0,0,0,ch);bg.addColorStop(0,'#f4f5f2');bg.addColorStop(1,'#edf0ed');ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
  const ground=v=>world(v,false);
  for(let i=-14;i<=14;i++){const n=i*.2;line(ground({x:n,y:-.012,z:-2.8}),ground({x:n,y:-.012,z:2.8}),'#e3e8e2',.7);line(ground({x:-2.8,y:-.012,z:n}),ground({x:2.8,y:-.012,z:n}),'#e3e8e2',.7);}
  if(mode==='tilt'){
    poly([{x:-.82,y:-.009,z:-.65},{x:.82,y:-.009,z:-.65},{x:.82,y:-.009,z:.65},{x:-.82,y:-.009,z:.65}].map(ground),'#f5f6f1','#cbd3c9',1);
    for(let i=-7;i<=7;i++)line(ground({x:i*.1,y:-.008,z:-.65}),ground({x:i*.1,y:-.008,z:.65}),'#e6e9e1',.65);
    for(let i=-6;i<=6;i++)line(ground({x:-.82,y:-.008,z:i*.1}),ground({x:.82,y:-.008,z:i*.1}),'#e6e9e1',.65);
    const A=project(ground({x:.7,y:0,z:-.55}));ctx.fillStyle='#a3ada1';ctx.font='8px monospace';ctx.fillText('TILT TABLE / '+state.angle.toFixed(1)+'°',A.x-100,A.y);
  }
  // Soft footprint shadow, projected onto the supporting plane.
  const shadow=Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2;return world({x:Math.cos(a)*p.width/150,y:.001,z:Math.sin(a)*.28},true);});poly(shadow,'#2f403317');
  if(mode==='drive'){
    if(state.path.length>1){ctx.beginPath();state.path.forEach((v,i)=>{const q=project({x:v.x,y:.004,z:v.z});i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.strokeStyle='#f2a27f';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);}
    box(obstacle.x,.12,obstacle.z,obstacle.halfX*2,.24,obstacle.halfZ*2,['#d87950','#ed9369','#c66c47','#f3a879','#d77d57','#dc825b'],v=>v);
    const h=state.pose.heading,distance=sensorDistance();line(world({x:0,y:.10,z:.29},true),{x:state.pose.x+Math.sin(h)*(.30+distance),y:.10,z:state.pose.z+Math.cos(h)*(.30+distance)},'#68a8a6',1,[4,5]);
  }
  const b=balance(p,state.angle),support=b.polygon.map(v=>world({...v,y:.004},mode==='drive'));
  if(showSupport)poly(support,'#269c8c14','#58a89a',1.4,[4,3]);
  // Robot assembly: chassis, battery, motors, support rods, payload, and front sensor.
  const width=p.width/100;
  box(0,.148,-.06,width*.90,.075,.47,['#c9512b','#ec673b','#bf4e2b','#ff8753','#dd5b32','#ed6b3c']);
  box(0,.105,-.055,width*.7,.038,.35,['#5b6870','#737f84','#4d5a61','#879298','#68757c','#63727b']);
  box(0,.204,-.14,.17,.055,.135,['#34414d','#44525f','#2a3642','#586777','#354553','#405261']);
  box(.052,.237,-.14,.025,.008,.055,'#91a29d');
  wheel(-width/2,.075,.08,.075,.055);wheel(width/2,.075,.08,.075,.055);
  box(0,.073,-.22,.035,.062,.025,'#98a6ad');wheel(0,.031,-.22,.031,.026,true);
  // An adjustable crossbar lets the load move sideways without changing its specified mass model.
  const payloadY=.20+p.height/100,px=p.offset/100;
  box(px,.2,-.06,.16,.018,.13,['#727e83','#a9b3b6','#66747b','#c4cdcb','#839096','#9aa7ac']);
  for(const dx of [-.047,.047])box(px+dx,(payloadY+.19)/2,-.06,.012,Math.max(.02,payloadY-.19),.012,['#8c9b9e','#b4c1c1','#7c8e95','#d1dbd5','#91a3a6','#bdc9c7']);
  if(p.mass>0){const size=.115+p.mass*.017;box(px,payloadY,-.06,size,.12,size,['#df9e5d','#e7ae6c','#c78a50','#f4c689','#d3985d','#e7b372']);box(px,payloadY+.061,-.06,.025,.002,size+.001,'#e3a66b');}
  box(0,.196,.183,.12,.035,.035,['#304652','#354b59','#293c48','#506674','#3f5865','#405a68']);
  box(-.032,.198,.202,.018,.018,.006,'#9fb4ba');box(.032,.198,.202,.018,.018,.006,'#9fb4ba');
  // Four screw heads on the top face.
  for(const x of [-width*.36,width*.36])for(const z of [-.24,.11])box(x,.187,z,.012,.002,.012,'#ffd0b0');
  faces.sort((a,b)=>a.depth-b.depth).forEach(f=>poly(f.vs,f.color));faces=[];
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
$('view-perspective').onclick=$('view-reset').onclick=()=>{yaw=.73;elevation=.43;zoom=1;needsRender=true;};$('view-top').onclick=()=>{yaw=0;elevation=1.5;zoom=1;needsRender=true;};$('zoom-in').onclick=()=>{zoom=Math.min(2,zoom+.15);needsRender=true;};$('zoom-out').onclick=()=>{zoom=Math.max(.45,zoom-.15);needsRender=true;};
function frame(time){const dt=lastFrame?Math.min((time-lastFrame)/1000,.25):0;lastFrame=time;tick(dt);if(needsRender){render();needsRender=false;}requestAnimationFrame(frame);}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.status==='running'){state.status='paused';setRunButton();}});
updateInputs();updateLines();updateTelemetry();renderResults();requestAnimationFrame(frame);
