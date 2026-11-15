// Interface for the quadcopter model: 3D scene, ghost comparison, live equation terms, plots. All physics is in quad.mjs.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DEFAULTS,DT,FULL,GAINS,Sim,hoverSpeed,rotation,trajectory} from './quad.mjs';

const $=id=>document.getElementById(id),deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180;
const fix=(v,n=2)=>(Object.is(v,-0)?0:v).toFixed(n),sign=(v,n=2)=>(v<0?'−':'+')+Math.abs(v).toFixed(n);
const css=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COL={x:css('--x'),y:css('--y'),z:css('--z'),ccw:css('--ccw'),cw:css('--cw'),accent:css('--accent'),ghost:css('--ghost'),dim:css('--dim')};
const START=[0,0,1,0,0,0,0,0,0,0,0,0];

// ---------- state ----------
let params={...DEFAULTS},gains=structuredClone(GAINS);
const ui={mode:'manual',U:[params.m*params.g,0,0,0],hover:{Zd:1,phid:0,thetad:0,psid:0},traj:{type:'circle',radius:1,speed:.5,length:1},model:{...FULL},improvedPID:true,showGhost:true,paused:false,rate:1,start:START};
let main,ghost,hist=[],stepCount=0,spin=[0,0,0,0];
const peak={m:[null,null,null,null],g:[null,null,null,null]};
const ghostOn=()=>ui.showGhost&&!(ui.model.fullT&&ui.model.gyro&&ui.improvedPID);
function command(){
  if(ui.mode==='manual')return {mode:'manual',U:ui.U};
  if(ui.mode==='hover')return {mode:'hover',...ui.hover};
  return {mode:'traj',traj:ui.traj,psid:0};
}
function restart(state=ui.start){
  if(main){const d=V(state[0]-main.s[0],state[1]-main.s[1],state[2]-main.s[2]);orbit.target.add(d);camera.position.add(d);}
  main=new Sim({params,model:ui.model,improvedPID:ui.improvedPID,floor:true,gains,state});
  ghost=new Sim({params,model:FULL,improvedPID:true,floor:true,gains,state});
  hist=[];stepCount=0;for(const k in held)held[k]=-9;trailMain.clear();trailGhost.clear();main.step(command());ghost.step(command());main.t=ghost.t=0;drawDesired();
}
// When the model changes in flight the ghost starts again from the solid vehicle, so the two diverge from that moment.
function syncGhost(){
  ghost.s=main.s.slice();ghost.t=main.t;ghost.trajStart=main.trajStart;ghost.origin=main.origin.slice();ghost.crashed=main.crashed;trailGhost.clear();
  for(const mode of ['hover','traj'])for(const k in main.pid[mode]){ghost.pid[mode][k].integral=main.pid[mode][k].integral;ghost.pid[mode][k].last=null;}
}

// ---------- scene ----------
const view=$('view'),renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));view.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(css('--bg'));
const camera=new THREE.PerspectiveCamera(45,1,.05,200);camera.up.set(0,0,1);camera.position.set(-2.6,-2.2,2.3);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,0,.9);orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI/2-.02;
scene.add(new THREE.HemisphereLight(0xffffff,0x334455,1.1));const sun=new THREE.DirectionalLight(0xffffff,1.4);sun.position.set(2,-3,6);scene.add(sun);
const grid=new THREE.GridHelper(40,40,0x2c3a4c,0x1a2330);grid.rotation.x=Math.PI/2;scene.add(grid);
const V=(x,y,z)=>new THREE.Vector3(x,y,z),arrow=(color,len=.5,head=.09)=>new THREE.ArrowHelper(V(0,0,1),V(0,0,0),len,color,head,head*.6);
const point=(a,dir,len)=>{const l=Math.max(len,1e-4);a.visible=len>.004;a.setDirection(dir.clone().normalize());a.setLength(l,Math.min(.09,l*.4),Math.min(.055,l*.25));};
// E-frame axes fixed on the ground (deck I, slide 10).
const labels=$('labels'),tags=[];
function tag(text,cls='',color){const el=document.createElement('span');el.textContent=text;if(cls)el.className=cls;if(color)el.style.color=color;labels.append(el);const t={el,pos:V(0,0,0),show:true};tags.push(t);return t;}
[['X',V(1,0,0),COL.x],['Y',V(0,1,0),COL.y],['Z',V(0,0,1),COL.z]].forEach(([n,d,c])=>{const a=arrow(c,.8);a.setDirection(d);scene.add(a);tag(n+'ᴇ','axis',c).pos.copy(d.clone().multiplyScalar(.9));});

const ROTORS=[{at:[1,0],ccw:true},{at:[0,-1],ccw:false},{at:[-1,0],ccw:true},{at:[0,1],ccw:false}];
function makeDrone(isGhost){
  const g=new THREE.Group();g.matrixAutoUpdate=false;const l=params.l;
  const mat=(color,opacity=1)=>new THREE.MeshStandardMaterial({color,transparent:isGhost||opacity<1,opacity:isGhost?.28:opacity,roughness:.6,depthWrite:!isGhost});
  const body=isGhost?COL.ghost:'#c9d3de';
  const armX=new THREE.Mesh(new THREE.BoxGeometry(2*l,.025,.02),mat(body)),armY=new THREE.Mesh(new THREE.BoxGeometry(.025,2*l,.02),mat(body)),hub=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.045),mat(isGhost?COL.ghost:'#3c4a5c'));
  // A nose marker on the front arm, so the heading can be read.
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.022,.07,12),mat(isGhost?COL.ghost:COL.x));nose.rotation.z=-Math.PI/2;nose.position.set(l+.14,0,0);
  g.add(armX,armY,hub,nose);
  const rotors=ROTORS.map(r=>{
    const c=isGhost?COL.ghost:r.ccw?COL.ccw:COL.cw,grp=new THREE.Group();grp.position.set(r.at[0]*l,r.at[1]*l,.03);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(.105,40),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:isGhost?.12:.3,side:THREE.DoubleSide,depthWrite:false}));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.105,.004,6,48),mat(c));
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.2,.018,.004),mat(c));
    grp.add(disc,ring,blade);let thrust=null;if(!isGhost){thrust=arrow(c,.1);grp.add(thrust);}
    g.add(grp);return {blade,thrust,grp};
  });
  let axes=null,u1=null;
  if(!isGhost){
    axes=[[V(1,0,0),COL.x,'Xʙ'],[V(0,1,0),COL.y,'Yʙ'],[V(0,0,1),COL.z,'Zʙ']].map(([d,c,n])=>{const a=arrow(c,.2,.05);a.setDirection(d);g.add(a);return {d,t:tag(n,'axis',c)};});
    u1=arrow(COL.accent,.3);u1.position.set(0,0,.03);g.add(u1);
  }
  scene.add(g);return {g,rotors,axes,u1};
}
function trail(color,opacity){
  const N=6000,geo=new THREE.BufferGeometry(),arr=new Float32Array(N*3);geo.setAttribute('position',new THREE.BufferAttribute(arr,3));geo.setDrawRange(0,0);
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity}));line.frustumCulled=false;scene.add(line);let n=0;
  return {line,clear(){n=0;geo.setDrawRange(0,0);},add(x,y,z){if(n===N){arr.copyWithin(0,3);n--;}arr.set([x,y,z],n*3);n++;geo.setDrawRange(0,n);geo.attributes.position.needsUpdate=true;}};
}
let drone=makeDrone(false),phantom=makeDrone(true);
const trailMain=trail(COL.accent,.9),trailGhost=trail(COL.ghost,.7);
const desired=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xffffff,dashSize:.06,gapSize:.05,transparent:true,opacity:.5}));scene.add(desired);
const drop=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,0,1)]),new THREE.LineDashedMaterial({color:0x8494a6,dashSize:.04,gapSize:.04}));scene.add(drop);
const shadow=new THREE.Mesh(new THREE.RingGeometry(.02,.03,24),new THREE.MeshBasicMaterial({color:0x8494a6,side:THREE.DoubleSide}));scene.add(shadow);
const pull=arrow(COL.accent,.3);scene.add(pull);const pullTag=tag('','',COL.accent);
const rotorTags=ROTORS.map((r,i)=>tag('','',r.ccw?COL.ccw:COL.cw));
function drawDesired(){
  const pts=[];if(ui.mode==='traj'&&main){const o=main.trajStart===null?main.s.slice(0,3):main.origin,T=ui.traj.type==='line'?ui.traj.length/ui.traj.speed:2*Math.PI*ui.traj.radius/ui.traj.speed;for(let i=0;i<=120;i++)pts.push(V(...trajectory(ui.traj,T*i/120,o).pos));}
  desired.geometry.dispose();desired.geometry=new THREE.BufferGeometry().setFromPoints(pts);desired.computeLineDistances();desired.visible=pts.length>0;
}
function pose(d,s){const R=rotation(s[3],s[4],s[5]);d.g.matrix.set(R[0][0],R[0][1],R[0][2],s[0],R[1][0],R[1][1],R[1][2],s[1],R[2][0],R[2][1],R[2][2],s[2],0,0,0,1);d.g.matrixWorldNeedsUpdate=true;return R;}

// ---------- equation panel (deck I, slide 26) ----------
const eq=$('eq');
const term=(label)=>`<span class="t"><small>${label}</small><b></b></span>`;
eq.innerHTML=`<h4 style="grid-column:auto">Position dynamics</h4><h4 style="grid-column:auto">Attitude dynamics</h4>
<div class="r" data-k="X"><span class="lhs">Ẍ =</span>${term('(sψ·sφ + cψ·sθ·cφ)')}<span>·</span>${term('U1/m')}<span class="res"></span></div>
<div class="r" data-k="p"><span class="lhs">ṗ =</span>${term('(I<sub>YY</sub>−I<sub>ZZ</sub>)/I<sub>XX</sub>·q·r')}${term('−J<sub>TP</sub>/I<sub>XX</sub>·q·Ω')}${term('U2/I<sub>XX</sub>')}<span class="res"></span></div>
<div class="r" data-k="Y"><span class="lhs">Ÿ =</span>${term('(−cψ·sφ + sψ·sθ·cφ)')}<span>·</span>${term('U1/m')}<span class="res"></span></div>
<div class="r" data-k="q"><span class="lhs">q̇ =</span>${term('(I<sub>ZZ</sub>−I<sub>XX</sub>)/I<sub>YY</sub>·p·r')}${term('J<sub>TP</sub>/I<sub>YY</sub>·p·Ω')}${term('U3/I<sub>YY</sub>')}<span class="res"></span></div>
<div class="r" data-k="Z"><span class="lhs">Z̈ =</span>${term('−g')}${term('(cθ·cφ)·U1/m')}<span class="res"></span></div>
<div class="r" data-k="r"><span class="lhs">ṙ =</span>${term('(I<sub>XX</sub>−I<sub>YY</sub>)/I<sub>ZZ</sub>·p·q')}${term('U4/I<sub>ZZ</sub>')}<span class="res"></span></div>
<div class="r" data-k="E"><span class="lhs">Θ̇ =</span>${term('φ̇')}${term('θ̇')}${term('ψ̇')}<span class="res" style="min-width:0"></span></div>
<div class="r" data-k="W"><span class="lhs">ω =</span>${term('p')}${term('q')}${term('r')}<span class="res" style="min-width:0"></span></div>`;
const rows=Object.fromEntries([...eq.querySelectorAll('.r')].map(r=>[r.dataset.k,{t:[...r.querySelectorAll('.t')],res:r.querySelector('.res')}]));
function fillRow(k,values,result,unit,{weigh=true,off=[]}={}){
  const row=rows[k],max=Math.max(...values.map(Math.abs),.05);
  values.forEach((v,i)=>{const el=row.t[i];el.lastElementChild.textContent=sign(v,Math.abs(v)<10?3:1);el.style.setProperty('--k',weigh?Math.abs(v)/max:0);el.classList.toggle('off',off.includes(i));});
  row.res.textContent=result===null?unit:`= ${sign(result,3)} ${unit}`;
}
function updateEquations(r){
  const T=r.terms,a=r.U[0]/params.m,g=!ui.model.gyro,[ed,td,pd]=main.rates().rates,s=r.s;
  fillRow('X',[T.X.dir,a],T.X.thrust,'m/s²',{weigh:false});fillRow('Y',[T.Y.dir,a],T.Y.thrust,'m/s²',{weigh:false});fillRow('Z',[T.Z.gravity,T.Z.thrust],T.Z.gravity+T.Z.thrust,'m/s²');
  fillRow('p',[T.p.inertia,T.p.rotor,T.p.input],T.p.inertia+T.p.rotor+T.p.input,'rad/s²',{off:g?[0,1]:[]});
  fillRow('q',[T.q.inertia,T.q.rotor,T.q.input],T.q.inertia+T.q.rotor+T.q.input,'rad/s²',{off:g?[0,1]:[]});
  fillRow('r',[T.r.inertia,T.r.input],T.r.inertia+T.r.input,'rad/s²',{off:g?[0]:[]});
  fillRow('E',[ed,td,pd],null,ui.model.fullT?'rad/s = T_Θ·ω':'rad/s = ω (T_Θ ≈ I)',{weigh:false});fillRow('W',[s[6],s[7],s[8]],null,`rad/s · Ω = ${sign(r.Om,1)}`,{weigh:false});
}

// ---------- plots ----------
function chart(canvas,cap,series,unit){
  const ctx=canvas.getContext('2d');
  $(cap).innerHTML=series.map(s=>`<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')+`<span style="margin-left:auto">${unit}</span>`;
  return ()=>{
    const w=canvas.clientWidth,h=canvas.clientHeight,k=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(w*k)){canvas.width=Math.round(w*k);canvas.height=Math.round(h*k);}
    ctx.setTransform(k,0,0,k,0,0);ctx.clearRect(0,0,w,h);if(!hist.length)return;
    const t0=Math.max(0,hist.at(-1).t-10),t1=t0+10,pad={l:38,r:6,t:6,b:14};let lo=Infinity,hi=-Infinity;
    const each=fn=>{for(const s of series)for(const src of ['m','g','d'])for(const p of hist){const v=s.get(p[src]);if(v!==undefined&&Number.isFinite(v))fn(v);}};
    each(v=>{lo=Math.min(lo,v);hi=Math.max(hi,v);});
    const span=Math.max(hi-lo,series[0].min??.1),mid=(hi+lo)/2;lo=mid-span*.58;hi=mid+span*.58;
    const X=t=>pad.l+(t-t0)/10*(w-pad.l-pad.r),Y=v=>pad.t+(hi-v)/(hi-lo)*(h-pad.t-pad.b);
    ctx.font='10px ui-monospace,monospace';ctx.fillStyle=COL.dim;ctx.strokeStyle='#1e2733';ctx.lineWidth=1;ctx.setLineDash([]);
    for(const v of [lo+(hi-lo)*.1,mid,hi-(hi-lo)*.1]){ctx.beginPath();ctx.moveTo(pad.l,Y(v));ctx.lineTo(w-pad.r,Y(v));ctx.stroke();ctx.fillText(Math.abs(v)<.1&&v!==0?v.toExponential(0):v.toFixed(Math.abs(v)<10?2:0),2,Y(v)+3);}
    if(lo<0&&hi>0){ctx.strokeStyle='#33404f';ctx.beginPath();ctx.moveTo(pad.l,Y(0));ctx.lineTo(w-pad.r,Y(0));ctx.stroke();}
    ctx.fillText(`${t0.toFixed(0)} s`,pad.l,h-3);ctx.fillText(`${t1.toFixed(0)} s`,w-pad.r-26,h-3);
    const line=(src,dash,width,alpha)=>{for(const s of series){ctx.beginPath();let pen=false;for(const p of hist){const v=s.get(p[src]);if(v===undefined||p.t<t0){pen=false;continue;}pen?ctx.lineTo(X(p.t),Y(v)):ctx.moveTo(X(p.t),Y(v));pen=true;}ctx.strokeStyle=s.color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();}ctx.globalAlpha=1;};
    line('d',[2,3],1,.7);line('g',[6,4],1.4,.85);line('m',[],1.6,1);
  };
}
const snap=(r)=>({phi:deg(r.s[3]),theta:deg(r.s[4]),psi:deg(r.s[5]),X:r.s[0],Y:r.s[1],Z:r.s[2],U1:r.U[0],U2:r.U[1],U3:r.U[2],U4:r.U[3]});
const charts=[
  chart($('c-ang'),'cap-ang',[{name:'φ',color:COL.x,get:p=>p?.phi,min:2},{name:'θ',color:COL.y,get:p=>p?.theta},{name:'ψ',color:COL.z,get:p=>p?.psi}],'deg'),
  chart($('c-pos'),'cap-pos',[{name:'X',color:COL.x,get:p=>p?.X,min:.2},{name:'Y',color:COL.y,get:p=>p?.Y},{name:'Z',color:COL.z,get:p=>p?.Z}],'m'),
  chart($('c-u1'),'cap-u1',[{name:'U1',color:COL.accent,get:p=>p?.U1,min:.5}],'N'),
  chart($('c-u'),'cap-u',[{name:'U2',color:COL.x,get:p=>p?.U2,min:.004},{name:'U3',color:COL.y,get:p=>p?.U3},{name:'U4',color:COL.z,get:p=>p?.U4}],'N·m')
];

// ---------- controls ----------
function slider(id,get,set,fmt){const el=$(id),out=el.parentElement.querySelector('output'),show=()=>{el.value=get();out.textContent=fmt(get());};el.addEventListener('input',()=>{set(+el.value);out.textContent=fmt(get());});show();return show;}
const mg=()=>params.m*params.g,shows=[
  slider('U1',()=>ui.U[0]/mg(),v=>ui.U[0]=v*mg(),()=>`${fix(ui.U[0],2)} N`),
  slider('U2',()=>ui.U[1],v=>ui.U[1]=v,v=>`${sign(v*1000,1)} mN·m`),slider('U3',()=>ui.U[2],v=>ui.U[2]=v,v=>`${sign(v*1000,1)} mN·m`),slider('U4',()=>ui.U[3],v=>ui.U[3]=v,v=>`${sign(v*1000,2)} mN·m`),
  slider('Zd',()=>ui.hover.Zd,v=>ui.hover.Zd=v,v=>`${fix(v,2)} m`),
  ...['phid','thetad','psid'].map(k=>slider(k,()=>Math.round(deg(ui.hover[k])),v=>ui.hover[k]=rad(v),v=>`${sign(v,0)}°`)),
  slider('tsize',()=>ui.traj.type==='line'?ui.traj.length:ui.traj.radius,v=>{ui.traj.radius=ui.traj.length=v;retrace();},v=>`${fix(v,1)} m`),
  slider('tspeed',()=>ui.traj.speed,v=>{ui.traj.speed=v;retrace();},v=>`${fix(v,2)} m/s`)
];
const refresh=()=>{shows.forEach(f=>f());$('ttype').value=ui.traj.type;$('approxT').checked=!ui.model.fullT;$('noGyro').checked=!ui.model.gyro;$('tradPID').checked=!ui.improvedPID;$('showGhost').checked=ui.showGhost;setMode(ui.mode,false);};
function retrace(){for(const s of [main,ghost]){s.trajStart=null;s.ref={phi:null,theta:null};}drawDesired();}
function setMode(mode,act=true){
  ui.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
  for(const m of ['manual','hover','traj'])$('m-'+m).classList.toggle('hide',m!==mode);
  if(!act)return;
  if(mode==='hover'){ui.hover.Zd=Math.round(main.s[2]*20)/20;ui.hover.psid=rad(Math.round(deg(main.s[5])/5)*5);ui.hover.phid=ui.hover.thetad=0;}
  if(mode==='manual')ui.U=[mg(),0,0,0];
  for(const s of [main,ghost])for(const k in s.pid[mode==='traj'?'traj':'hover'])s.pid[mode==='traj'?'traj':'hover'][k].reset();
  retrace();shows.forEach(f=>f());hideQuestion();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('hoverU').addEventListener('click',()=>{ui.U=[mg(),0,0,0];shows.forEach(f=>f());});
$('ttype').addEventListener('change',e=>{ui.traj.type=e.target.value;shows.forEach(f=>f());retrace();});
$('trestart').addEventListener('click',retrace);
$('approxT').addEventListener('change',e=>{ui.model.fullT=!e.target.checked;main.model.fullT=ui.model.fullT;syncGhost();});
$('noGyro').addEventListener('change',e=>{ui.model.gyro=!e.target.checked;main.model.gyro=ui.model.gyro;syncGhost();});
$('tradPID').addEventListener('change',e=>{ui.improvedPID=main.improvedPID=!e.target.checked;syncGhost();});
$('showGhost').addEventListener('change',e=>{ui.showGhost=e.target.checked;syncGhost();});
$('pause').addEventListener('click',()=>{ui.paused=!ui.paused;$('pause').textContent=ui.paused?'Run':'Pause';});
$('reset').addEventListener('click',()=>{ui.start=START;ui.rate=1;$('rate').value='1';if(ui.mode==='manual')ui.U=[mg(),0,0,0];restart();shows.forEach(f=>f());hideQuestion();});
$('rate').addEventListener('change',e=>ui.rate=+e.target.value);
addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|BUTTON|SUMMARY/.test(e.target.tagName)){e.preventDefault();$('pause').click();}});

// Gains tables: one row per loop.
function gainTable(id,set){
  const names={X:'X → μx',Y:'Y → μy',Z:set==='hover'?'Z → U1':'Z → μz',phi:'φ → U2',theta:'θ → U3',psi:'ψ → U4'};
  $(id).innerHTML='<tr><th></th><th>Kp</th><th>Ki</th><th>Kd</th><th>|I| max</th></tr>'+Object.keys(gains[set]).map(k=>`<tr><th>${names[k]}</th>${['kp','ki','kd','iMax'].map(f=>`<td><input type="number" step="any" data-set="${set}" data-k="${k}" data-f="${f}" value="${gains[set][k][f]}" aria-label="${names[k]} ${f}"></td>`).join('')}</tr>`).join('');
  $(id).addEventListener('change',e=>{const d=e.target.dataset,v=+e.target.value;if(!Number.isFinite(v)||v<0){e.target.value=gains[d.set][d.k][d.f];return;}gains[d.set][d.k][d.f]=v;for(const s of [main,ghost])s.pid[d.set][d.k][d.f]=v;});
}
gainTable('g-hover','hover');gainTable('g-traj','traj');

const PARAMS=[['m','kg'],['l','m'],['Ixx','kg·m²'],['Iyy','kg·m²'],['Izz','kg·m²'],['b','N·s²'],['d','N·m·s²'],['Jtp','kg·m²'],['omegaMax','rad/s']];
$('params').innerHTML=PARAMS.map(([k,u])=>`<label for="p-${k}">${k==='omegaMax'?'Ω max':k} <small>[${u}]</small></label><input id="p-${k}" type="number" step="any" value="${params[k]}">`).join('');
const hoverLine=()=>$('hoverline').textContent=`Ω_H = √(m·g / 4b) = ${fix(hoverSpeed(params),2)} rad/s · m·g = ${fix(mg(),3)} N · g = 9.81 m/s²`;
$('applyP').addEventListener('click',()=>{
  const next={...params};for(const [k] of PARAMS){const v=+$('p-'+k).value;if(!(v>0)){$('p-'+k).value=params[k];return;}next[k]=v;}
  params=next;scene.remove(drone.g,phantom.g);drone.axes.forEach(a=>a.t.el.remove());drone=makeDrone(false);phantom=makeDrone(true);
  ui.U=[mg(),0,0,0];restart(START);shows.forEach(f=>f());hoverLine();
});
hoverLine();

// ---------- experiments ----------
const question=$('question');
const ask=(title,text)=>{question.style.display='block';question.firstElementChild.textContent=title;question.lastElementChild.textContent=text;};
function hideQuestion(){question.style.display='none';}
const SCENARIOS=[
  {name:'Hover at Ω_H',q:'All four rotors turn at Ω_H. Does Z move? Which term of Z̈ balances −g?',run(){ui.mode='manual';ui.U=[mg(),0,0,0];return START;}},
  {name:'Roll torque only',q:'Only U2 is not zero. φ grows like U2·t²/(2·Ixx). Why do θ and ψ stay at zero, and which rotors changed speed?',run(){ui.mode='manual';ui.U=[mg(),.002,0,0];return START;}},
  {name:'Tilt φ = 10°, watch X–Y',q:'Only the roll angle is held at 10°. U1 points along Z_B, so part of it is horizontal: Ÿ = −g·tan φ. Which way does it drift?',run(){ui.mode='hover';ui.hover={Zd:1,phid:rad(10),thetad:0,psid:0};return START;}},
  {name:'T_Θ ≈ I at a large angle',q:'Start rolled 57° with a yaw rate r. The solid vehicle uses [φ̇ θ̇ ψ̇] = [p q r]; the ghost uses the full T_Θ. Look at θ.',run(){ui.mode='manual';ui.U=[mg(),0,0,0];ui.model.fullT=false;ui.rate=.25;return [0,0,12,1,0,0,0,0,1.5,0,0,0];}},
  {name:'Gyroscopic coupling',q:'Start with p = 6 and r = 8 rad/s and no torque. The solid vehicle drops q·r, p·r, p·q and J_TP·Ω; in the ghost they turn roll rate into pitch rate.',run(){ui.mode='manual';ui.U=[mg(),0,0,0];ui.model.gyro=false;ui.rate=.25;return [0,0,12,0,0,0,6,0,8,0,0,0];}},
  {name:'Singularity θ → 90°',q:'A pitch torque takes θ through 90° while the body yaws slowly (r = 0.3 rad/s). Watch ψ̇ in the Θ̇ row: it is r/cos θ, so it grows without limit near 90°. The bound keeps the numbers finite.',run(){ui.mode='manual';ui.U=[mg(),0,.006,0];ui.rate=.25;return [0,0,12,0,0,0,0,0,.3,0,0,0];}},
  {name:'Derivative kick',q:'Traditional PID on the solid vehicle. Move φ_d in one step: the derivative of the error is an impulse, so U2 spikes and the rotors saturate. The ghost differentiates the output instead.',run(){ui.mode='hover';ui.hover={Zd:1,phid:0,thetad:0,psid:0};ui.improvedPID=false;return START;}},
  {name:'Follow a circle',q:'Virtual controls μx, μy, μz set U1 and the desired tilt. The vehicle leans into the circle: the tilt gives the centripetal acceleration v²/R.',run(){ui.mode='traj';ui.traj={type:'circle',radius:1,speed:.6,length:1};return START;}}
];
$('scenarios').innerHTML=SCENARIOS.map((s,i)=>`<button data-s="${i}">${s.name}</button>`).join('');
$('scenarios').addEventListener('click',e=>{
  const s=SCENARIOS[e.target.dataset.s];if(!s)return;
  ui.model={...FULL};ui.improvedPID=true;ui.showGhost=true;ui.rate=1;ui.start=s.run();$('rate').value=String(ui.rate);restart();refresh();ask(s.name,s.q);
  if(ui.paused)$('pause').click();
});

// ---------- loop ----------
const warnings=$('warnings');let lastWarn='';
// A clipped rotor or the singularity can last a single step, so each warning stays for 2 s of simulated time.
const held={low:-9,high:-9,singular:-9};
function warn(r){
  const list=[],on=k=>r.t-held[k]<2;
  if(on('low'))list.push('A rotor would need Ω² < 0: clipped to 0. The inputs you asked for are not what the vehicle gets.');
  if(on('high'))list.push(`A rotor reached Ω max (${params.omegaMax} rad/s): clipped.`);
  if(on('singular'))list.push('θ is near ±90°: T_Θ is singular (1/cos θ). The value is bounded so nothing becomes NaN, but φ̇ and ψ̇ mean little here.');
  if(r.crashed)list.push('On the ground, tilted. Press Reset.');else if(r.s[2]===0&&r.U[0]<mg())list.push('On the ground.');
  const html=list.map(t=>`<div>${t}</div>`).join('');if(html!==lastWarn){warnings.innerHTML=html;lastWarn=html;}
}
function advance(){
  const cmd=command(),r=main.step(cmd),g=ghost.step(cmd);stepCount++;
  for(const k in held)if(r[k])held[k]=r.t;
  // Plots sample every fourth step; a one-step spike in an input is kept by holding the largest value in between.
  for(const [rec,pk] of [[r,peak.m],[g,peak.g]])rec.U.forEach((u,i)=>{if(pk[i]===null||Math.abs(u)>Math.abs(pk[i]))pk[i]=u;});
  r.W.forEach((w,i)=>spin[i]+=(ROTORS[i].ccw?1:-1)*w*DT*.06);
  if(stepCount%4===0){
    const on=ghostOn(),d=r.des?{phi:r.des.phi===undefined?undefined:deg(r.des.phi),theta:r.des.theta===undefined?undefined:deg(r.des.theta),psi:r.des.psi===undefined?undefined:deg(r.des.psi),X:r.des.X,Y:r.des.Y,Z:r.des.Z}:null;
    const withPeak=(rec,pk)=>{const o=snap(rec);[o.U1,o.U2,o.U3,o.U4]=pk;pk.fill(null);return o;};
    hist.push({t:r.t,m:withPeak(r,peak.m),g:on?withPeak(g,peak.g):(peak.g.fill(null),null),d});while(hist.length&&hist[0].t<r.t-10.5)hist.shift();
    trailMain.add(r.s[0],r.s[1],r.s[2]);if(on)trailGhost.add(g.s[0],g.s[1],g.s[2]);
  }
}
const H=()=>hoverSpeed(params),tmp=V(0,0,0);
function render(){
  const r=main.last,g=ghost.last,s=r.s,on=ghostOn();
  const R=pose(drone,s);phantom.g.visible=on;trailGhost.line.visible=on;$('ghost-legend').style.visibility=on?'visible':'hidden';if(on)pose(phantom,g.s);
  drone.rotors.forEach((ro,i)=>{ro.blade.rotation.z=spin[i];point(ro.thrust,V(0,0,1),params.b*r.W[i]*r.W[i]*.22);});
  phantom.rotors.forEach((ro,i)=>ro.blade.rotation.z=spin[i]);
  point(drone.u1,V(0,0,1),r.U[0]*.12);
  // The horizontal part of the thrust acceleration, drawn on the ground under the vehicle.
  const ax=r.terms.X.thrust,ay=r.terms.Y.thrust,ah=Math.hypot(ax,ay);pull.position.set(s[0],s[1],.01);point(pull,V(ax,ay,0).add(V(1e-9,0,0)),Math.min(ah*.25,3));
  pullTag.show=ah>.05;pullTag.pos.set(s[0]+ax*.25,s[1]+ay*.25,.08);pullTag.el.textContent=`(Ẍ, Ÿ) = (${sign(ax)}, ${sign(ay)}) m/s²`;
  drop.geometry.setFromPoints([V(s[0],s[1],0),V(s[0],s[1],s[2])]);drop.computeLineDistances();shadow.position.set(s[0],s[1],.005);
  const world=(x,y,z)=>tmp.set(s[0]+R[0][0]*x+R[0][1]*y+R[0][2]*z,s[1]+R[1][0]*x+R[1][1]*y+R[1][2]*z,s[2]+R[2][0]*x+R[2][1]*y+R[2][2]*z);
  drone.axes.forEach(a=>a.t.pos.copy(world(a.d.x*.25,a.d.y*.25,a.d.z*.25)));
  const h=H();rotorTags.forEach((t,i)=>{const at=ROTORS[i].at;t.pos.copy(world(at[0]*(params.l+.17),at[1]*(params.l+.17),.1));t.el.textContent=`Ω${i+1} ${fix(r.W[i],1)}`;});
  document.querySelectorAll('.rotor').forEach((el,i)=>{const w=r.W[i];el.querySelector('i').style.width=`${Math.min(100,50*w/h)}%`;const v=el.querySelector('.val').children;v[0].textContent=`${fix(w,1)} rad/s`;v[1].textContent=`Ω_H ${sign(w-h,1)}`;});
  $('time').textContent=`t = ${fix(r.t,2)} s${ui.paused?' · paused':''}`;
  // The camera travels with the vehicle, so a drifting vehicle stays the same size on screen.
  tmp.set(s[0],s[1],Math.max(.3,s[2])).sub(orbit.target).multiplyScalar(.15);orbit.target.add(tmp);camera.position.add(tmp);orbit.update();renderer.render(scene,camera);
  const w=view.clientWidth,ht=view.clientHeight;
  for(const t of tags){tmp.copy(t.pos).project(camera);const vis=t.show&&tmp.z<1&&Math.abs(tmp.x)<1.05&&Math.abs(tmp.y)<1.05;t.el.style.display=vis?'':'none';if(vis){t.el.style.left=`${(tmp.x+1)/2*w}px`;t.el.style.top=`${(1-tmp.y)/2*ht}px`;}}
  warn(r);
}
function resize(){const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(view);
let before=performance.now(),budget=0,frame=0;
function tick(now){
  const dt=Math.min(.1,(now-before)/1000);before=now;
  if(!ui.paused){budget+=dt*ui.rate;let n=0;while(budget>=DT&&n++<60){advance();budget-=DT;}if(n>=60)budget=0;}
  render();if(frame++%6===0){updateEquations(main.last);charts.forEach(c=>c());}
  requestAnimationFrame(tick);
}
restart();refresh();resize();requestAnimationFrame(tick);
// For checks from outside the page.
window.quad={get main(){return main;},get ghost(){return ghost;},ui,get hist(){return hist;}};
