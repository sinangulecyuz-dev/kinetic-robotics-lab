import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {simulateRun,FUSION_ALPHA,CONTROL_STEPS,DT} from '../dist/drive.mjs';
const close=(a,b,t,msg='')=>assert.ok(Math.abs(a-b)<=t,`${msg} ${a} != ${b} ± ${t}`);
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,deg=r=>r*180/Math.PI;
const run=(code,{robot='kinetic',terrain='flat',seed=1}={})=>simulateRun({design:DEFAULT,robot,terrain,program:parseProgram(code),seed});
const square='repeat 4\n  drive(0.2, 0)\n  wait(2.5)\n  drive(0, 1)\n  wait(1.57)\nend\nstop()';

test('filter(1) is pure gyro integration and filter(0) is pure encoder odometry',()=>{
  const g=run('filter(1)\n'+square,{terrain:'slippery'}).log,e=run('filter(0)\n'+square,{terrain:'slippery'}).log;
  g.fusedYaw.forEach((v,i)=>close(v,g.gyroYaw[i],1e-12,`gyro ${i}`));
  e.fusedYaw.forEach((v,i)=>{close(v,e.odomYaw[i],1e-12,`yaw ${i}`);close(e.fusedX[i],e.odomX[i],1e-12);close(e.fusedY[i],e.odomY[i],1e-12);});
});

test('with a parked rover, the filter settles at gyro bias × alpha·T/(1 − alpha), the complementary steady state',()=>{
  const alpha=.98,T=CONTROL_STEPS*DT,L=run(`filter(${alpha})\nwait(8)`,{seed:5}).log,tail=L.t.map((t,i)=>i).filter(i=>L.t[i]>6.5);
  const bias=mean(tail.map(i=>L.gz[i])),expected=bias*alpha*T/(1-alpha);
  close(mean(tail.map(i=>L.fusedYaw[i])),expected,Math.max(2e-4,.25*Math.abs(expected)),'steady fused heading');
  assert.equal(FUSION_ALPHA,.999,'the default is the slow crossover chosen in the README');
});

test('the default filter beats encoder odometry where wheels slip, and stays near it where they do not',()=>{
  const err=(code,opts,kind)=>mean([1,2,3,4].map(seed=>{const L=run(code,{...opts,seed}).log,n=L.t.length-1;
    return kind==='yaw'?{f:Math.abs(deg(L.fusedYaw[n]-L.trueYaw[n])),e:Math.abs(deg(L.odomYaw[n]-L.trueYaw[n]))}:{f:Math.hypot(L.fusedX[n]-L.trueX[n],L.fusedY[n]-L.trueY[n]),e:Math.hypot(L.odomX[n]-L.trueX[n],L.odomY[n]-L.trueY[n])};}).map(x=>x.f-x.e));
  assert.ok(err(square,{terrain:'slippery'},'pos')<-.02,'square on ice: filtered position at least 2 cm better');
  assert.ok(err('drive(0, 1)\nwait(10)\nwait(10)\nwait(5.13)\nstop()',{robot:'turtlebot3'},'yaw')<-5,'TurtleBot3 spinning: filtered heading at least 5° better');
  assert.ok(err(square,{terrain:'flat'},'pos')<.01,'square on concrete: within 1 cm of encoder odometry');
  const parked=run('wait(10)\nwait(10)\nwait(5)',{seed:2}).log,n=parked.t.length-1;assert.ok(Math.abs(deg(parked.fusedYaw[n]))<2,'parked 25 s: under 2° of gyro drift');
});

test('filter(alpha) parses only for 0 ≤ alpha ≤ 1',()=>{
  assert.deepEqual(parseProgram('filter(0.999)')[0],{type:'filter',alpha:.999,line:1});
  for(const bad of ['filter(2)','filter(-0.5)','filter()'])assert.throws(()=>parseProgram(bad),/Line 1:/);
});
