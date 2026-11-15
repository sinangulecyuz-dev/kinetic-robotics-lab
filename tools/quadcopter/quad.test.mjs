import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS as P,DT,FULL,Sim,PID,hoverSpeed,inputsFromOmegas,omegasFromInputs,rotation,eulerRates,derivative,rk4,trajectory} from './quad.mjs';

const deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180,mg=P.m*P.g,close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg??''} ${a} vs ${b} (±${tol})`);
const zero=()=>new Array(12).fill(0);
// Open loop: hold the asked inputs for T seconds, going through the rotor speeds as the simulator does.
const open=(U,T,model=FULL,s=zero())=>{const {W}=omegasFromInputs(U,P),r=inputsFromOmegas(W,P);for(let i=0;i<Math.round(T/DT);i++)s=rk4(s,r.U,r.Om,P,model);return s;};

test('hover: all rotors at Omega_H keep Z constant',()=>{
  const H=hoverSpeed(P);close(H,199.852,.001,'Omega_H');
  const {U,Om}=inputsFromOmegas([H,H,H,H],P);close(U[0],mg,1e-12,'U1 = m g');assert.deepEqual(U.slice(1).map(Math.abs),[0,0,0]);assert.equal(Om,0);
  let s=zero();for(let i=0;i<2400;i++)s=rk4(s,U,Om,P);
  close(s[2],0,1e-9,'Z after 10 s');close(s[11],0,1e-9,'Zdot');
});

test('rotor speeds and inputs invert each other, and impossible inputs are clipped and flagged',()=>{
  const U=[mg*1.1,.01,-.02,.003],{W,low,high}=omegasFromInputs(U,P),back=inputsFromOmegas(W,P).U;
  assert.ok(!low&&!high);U.forEach((u,i)=>close(back[i],u,1e-12));
  assert.ok(omegasFromInputs([mg,5,0,0],P).low,'a torque the rotors cannot give needs a negative square');
  assert.ok(omegasFromInputs([mg*10,0,0,0],P).high);assert.ok(omegasFromInputs([mg,5,0,0],P).W.every(Number.isFinite));
});

test('signs follow the slide figures: left faster rolls +phi, rear faster pitches +theta, left-right faster yaws +psi',()=>{
  const H=hoverSpeed(P);
  assert.ok(inputsFromOmegas([H,H-5,H,H+5],P).U[1]>0,'roll figure: LEFT +, RIGHT -');
  assert.ok(inputsFromOmegas([H-5,H,H+5,H],P).U[2]>0,'pitch figure: REAR +, FRONT -');
  assert.ok(inputsFromOmegas([H-5,H+5,H-5,H+5],P).U[3]>0,'yaw figure: LEFT and RIGHT +, FRONT and REAR -');
  // +phi tilts the thrust toward -Y (the right side): the left side has gone up.
  assert.ok(rotation(rad(10),0,0)[1][2]<0);assert.ok(rotation(0,rad(10),0)[0][2]>0,'+theta sends the thrust toward +X');
});

test('one input moves one axis: phi = U2 t^2 / (2 Ixx), and likewise for theta and psi',()=>{
  const T=.2,cases=[[[mg,.01,0,0],3,P.Ixx],[[mg,0,.01,0],4,P.Iyy],[[mg,0,0,.01],5,P.Izz]];
  for(const [U,axis,I] of cases){
    const s=open(U,T);close(s[axis],.5*.01/I*T*T,1e-6,`axis ${axis}`);
    for(const other of [3,4,5].filter(i=>i!==axis))close(s[other],0,1e-6,`axis ${other} stays`);
  }
  close(deg(open([mg,.01,0,0],T)[3]),2.9937,1e-3);close(deg(open([mg,0,0,.01],T)[5]),1.4966,1e-3);
});

test('units: Zddot = U1/m - g and phiddot = U2/Ixx',()=>{
  const d=derivative(zero(),[2*mg,.01,0,0],0,P);close(d[11],P.g,1e-12,'N / kg = m/s^2');close(d[6],.01/P.Ixx,1e-12,'N m / (kg m^2) = rad/s^2');
});

test('T_Theta agrees with the rotation matrix: dR/dt = R [omega]x',()=>{
  // Independent of the slides' T_Theta: integrate Euler angles with it, and compare R with R integrated from the body rates directly.
  const w=[.7,-.4,.9],h=1e-4;let e=[.3,-.5,.8],R=rotation(...e);
  const mul=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0))),S=[[0,-w[2],w[1]],[w[2],0,-w[0]],[-w[1],w[0],0]];
  for(let i=0;i<5000;i++){
    const f=x=>eulerRates(x[0],x[1],...w).rates,k1=f(e),k2=f(e.map((v,j)=>v+h/2*k1[j])),k3=f(e.map((v,j)=>v+h/2*k2[j])),k4=f(e.map((v,j)=>v+h*k3[j]));
    e=e.map((v,j)=>v+h/6*(k1[j]+2*k2[j]+2*k3[j]+k4[j]));
    const g=M=>mul(M,S),a=g(R),b=g(R.map((r,x)=>r.map((v,y)=>v+h/2*a[x][y]))),c=g(R.map((r,x)=>r.map((v,y)=>v+h/2*b[x][y]))),d=g(R.map((r,x)=>r.map((v,y)=>v+h*c[x][y])));
    R=R.map((r,x)=>r.map((v,y)=>v+h/6*(a[x][y]+2*b[x][y]+2*c[x][y]+d[x][y])));
  }
  const E=rotation(...e);for(let i=0;i<3;i++)for(let j=0;j<3;j++)close(E[i][j],R[i][j],1e-8,`R[${i}][${j}]`);
});

test('tilting alone drifts sideways: holding phi = 10 deg gives Yddot = -g tan(10 deg)',()=>{
  const sim=new Sim(),cmd={mode:'hover',Zd:0,phid:rad(10),thetad:0,psid:0};let v2,v3;
  for(let i=0;i<1440;i++){const r=sim.step(cmd);if(i===1199)v2=r.s[10];if(i===1439)v3=r.s[10];}
  close(deg(sim.s[3]),10,.2,'phi');close(sim.s[2],0,.01,'Z held');close(sim.s[0],0,1e-3,'X stays: only the small rotor-gyro coupling moves it');
  close(v3-v2,-P.g*Math.tan(sim.s[3]),.02,'Y acceleration over the last second');assert.ok(sim.s[1]<-20,'and it has drifted far to the right');
});

test('teaching toggles: T_Theta = I and dropped gyroscopic terms visibly change the motion',()=>{
  const tilted=[0,0,0,1,0,0,0,0,1.5,0,0,0],full=open([mg,0,0,0],1,FULL,tilted.slice()),ident=open([mg,0,0,0],1,{fullT:false,gyro:true},tilted.slice());
  close(deg(ident[4]),0,1e-9,'with T = I a yaw rate never reaches theta');assert.ok(Math.abs(deg(full[4]))>40,`full T_Theta: theta ${deg(full[4]).toFixed(1)} deg`);
  const fast=[0,0,0,0,0,0,6,0,8,0,0,0],on=open([mg,0,0,0],1,FULL,fast.slice()),off=open([mg,0,0,0],1,{fullT:true,gyro:false},fast.slice());
  close(off[6],6,1e-9,'without the terms p stays');close(off[7],0,1e-9);assert.ok(Math.abs(on[7])>3,`with them q grows to ${on[7].toFixed(2)}`);
  // Ixx = Iyy, so r is untouched either way.
  close(on[8],8,1e-9);
});

test('no NaN at the theta = 90 deg singularity, and it is flagged',()=>{
  let s=zero();s[4]=Math.PI/2;s[6]=1;s[8]=1;
  assert.ok(eulerRates(0,Math.PI/2,1,1,1).singular);assert.ok(!eulerRates(0,1,1,1,1).singular);
  for(let i=0;i<2400;i++)s=rk4(s,[mg,.001,.002,.0005],0,P);
  assert.ok(s.every(Number.isFinite),'state stays finite through the singularity');
});

test('hover controller reaches the desired altitude and attitude',()=>{
  const sim=new Sim(),cmd={mode:'hover',Zd:1.5,phid:0,thetad:0,psid:rad(45)};let peakU=0;
  for(let i=0;i<240*8;i++){const r=sim.step(cmd);peakU=Math.max(peakU,r.asked[0]);}
  close(sim.s[2],1.5,.02,'Z');close(deg(sim.s[5]),45,1,'psi');close(sim.s[0],0,1e-6);close(sim.s[1],0,1e-6);
});

test('slide 31: the traditional PID kicks on a reference step and winds up; the improved one does not',()=>{
  const kick=improved=>{const sim=new Sim({improvedPID:improved});let peak=0;for(let i=0;i<240;i++)sim.step({mode:'hover',Zd:0,phid:0,thetad:0,psid:0});
    for(let i=0;i<24;i++)peak=Math.max(peak,Math.abs(sim.step({mode:'hover',Zd:0,phid:rad(10),thetad:0,psid:0}).asked[1]));return peak;};
  assert.ok(kick(false)>20*kick(true),`derivative on the error: ${kick(false).toFixed(3)} N m vs ${kick(true).toFixed(4)} N m`);
  const a=new PID({kp:1,ki:2,kd:0,iMax:1}),b=new PID({kp:1,ki:2,kd:0,iMax:1});
  for(let i=0;i<2400;i++){a.update(1,0,0,DT,{improved:true});b.update(1,0,0,DT,{improved:false});}
  close(a.ki*a.integral,1,1e-9,'saturator holds the integral term');close(b.ki*b.integral,20,1e-6,'without it the integral keeps growing');
});

test('trajectory control follows the circle and the line',()=>{
  for(const traj of [{type:'circle',radius:1,speed:.5},{type:'line',length:3,speed:.5}]){
    const sim=new Sim({state:[0,0,1,0,0,0,0,0,0,0,0,0]}),cmd={mode:'traj',traj,psid:0};let worst=0,tilt=0;
    for(let i=0;i<240*14;i++){const r=sim.step(cmd),d=trajectory(traj,sim.t-DT,[0,0,1]);
      if(sim.t>4&&(traj.type==='circle'||sim.t<6))worst=Math.max(worst,Math.hypot(r.s[0]-r.des.X,r.s[1]-r.des.Y,r.s[2]-r.des.Z));tilt=Math.max(tilt,Math.abs(r.s[3]),Math.abs(r.s[4]));assert.ok(Number.isFinite(d.pos[0]));}
    assert.ok(worst<.05,`${traj.type}: worst tracking error while moving, after 4 s ${worst.toFixed(3)} m`);assert.ok(tilt<rad(25),`${traj.type}: tilt stays small, ${deg(tilt).toFixed(1)} deg`);
    if(traj.type==='line')close(sim.s[0],3,.03,'the line ends 3 m ahead');
  }
  // Circle centripetal check: speed^2 / radius.
  const d=trajectory({type:'circle',radius:2,speed:1},.3);close(Math.hypot(...d.acc),.5,1e-12);close(Math.hypot(...d.vel),1,1e-12);
});

test('the floor stops a fall without NaN, and the step size does not change the answer',()=>{
  const sim=new Sim({floor:true,state:[0,0,1,0,0,0,0,0,0,0,0,0]});for(let i=0;i<480;i++)sim.step({mode:'manual',U:[0,0,0,0]});
  assert.equal(sim.s[2],0);assert.ok(sim.s.every(Number.isFinite));
  const a=open([mg,.004,.002,.001],1),U=[mg,.004,.002,.001],r=inputsFromOmegas(omegasFromInputs(U,P).W,P);let b=zero();for(let i=0;i<480;i++)b=rk4(b,r.U,r.Om,P,FULL,DT/2);
  a.forEach((v,i)=>close(v,b[i],1e-6,`state ${i}`));
});
