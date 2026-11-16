import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {DriveSim,simulateRun} from '../dist/drive.mjs';
import {Replay,previousRun} from '../dist/replay.mjs';

// A replay is checked against the simulator itself: runs are deterministic, so a second simulation advanced to the same
// moment is an independent picture of the rover at that moment.
const code='drive(0.25, 0.6)\nwait(2)\ndrive(0.2, -0.9)\nwait(2.5)\nstop()',deg=r=>r*180/Math.PI;
const config=(robot,terrain,extra={})=>({design:DEFAULT,robot,terrain,program:parseProgram(code),seed:7,...extra});
// One step past the moment, so the live rover has taken the same 100 Hz sample the log row holds.
const liveAt=(cfg,time)=>{const s=new DriveSim(cfg);s.advance(time+1e-4);return s;};
const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b} (±${tol})`);

for(const [robot,terrain,extra] of [['kinetic','flat',{}],['turtlebot3','rough',{start:{x:-1,z:-1.2}}],['kinetic','slippery',{wind:{speed:5,toward:90,gust:.2}}]]){
  test(`replay matches a fresh simulation at the same moment (${robot}, ${terrain})`,()=>{
    const cfg=config(robot,terrain,extra),replay=new Replay(simulateRun(cfg));
    // Only moments inside the run: a run that stopped early has no later samples.
    const times=[0,.75,2,3.31,4.5].filter(t=>t<=replay.duration);assert.ok(times.length>=3,`run lasted ${replay.duration} s`);
    for(const time of times){
      const want=liveAt(cfg,time),got=replay.at(time);
      close(got.x,want.x,.003,`x at ${time}s`);close(got.z,want.z,.003,`z at ${time}s`);close(deg(got.heading),deg(want.heading),.3,`heading at ${time}s`);
      close(got.time,want.time,.006,'time');close(got.speed,want.speed,.03,'speed');
      for(const name of ['odom_x','odom_y','odom_heading','heading','fused_heading','encoder_left','encoder_right','distance'])close(got.sensor(name),want.sensor(name),name.startsWith('encoder')?3:.5,`${name} at ${time}s`);
      for(const k of [0,1])close(got.wheels[k].theta,want.wheels[k].theta,.05,`wheel ${k} angle, known only to one encoder count and one sample`);
      for(let j=0;j<3;j++){close(got.frame.origin[j],want.frame.origin[j],.003,'frame origin');close(got.frame.n[j],want.frame.n[j],.01,'ground normal');}
      assert.ok(Number.isFinite(got.margin)&&got.polygon.length>=3&&got.status==='running');
      if(time>.5)close(got.windSpeed,want.windSpeed,1e-9,'wind');
    }
  });
}

test('replay paths grow with time and end at the rover',()=>{
  const cfg=config('kinetic','flat'),run=simulateRun(cfg),replay=new Replay(run);
  const early=replay.at(1).path.length,late=replay.at(4).path.length;assert.ok(late>early&&early>10);
  const v=replay.at(3),end=v.path.at(-1),axle=v.axle();close(end.x,axle.x,1e-9,'path ends at the axle x');close(end.z,axle.z,1e-9,'path ends at the axle z');
  // The whole replayed path lies on the run's own true path.
  const L=run.log,all=replay.at(replay.duration).path;
  for(const p of all){let best=Infinity;for(let i=0;i<L.t.length;i++)best=Math.min(best,Math.hypot(run.start.x+L.trueY[i]-p.x,run.start.z+L.trueX[i]-p.z));assert.ok(best<1e-9);}
  close(replay.duration,L.t.at(-1),0,'duration');
});

test('replay clamps outside the run and shows the scan of that moment',()=>{
  const cfg=config('kinetic','flat'),run=simulateRun(cfg),replay=new Replay(run);
  assert.equal(replay.index(-3),0);assert.equal(replay.index(1e6),run.log.t.length-1);
  const start=replay.at(-1);close(start.x,run.origin.x,.001,'starts at the start');
  const v=replay.at(2.5),scan=run.scans.filter(s=>s.t<=2.5+1e-9).at(-1);
  assert.deepEqual(v.scan.map(r=>r<Infinity?r:0),scan.ranges);close(v.sensor('lidar_front'),scan.ranges[0]||Infinity,0,'lidar_front');
});

test('a replay never changes the run it reads',()=>{
  const run=simulateRun(config('turtlebot3','flat')),before=JSON.stringify([run.log.trueX.slice(0,400),run.x,run.z,run.heading,run.status,run.path.length]),replay=new Replay(run);
  for(let t=0;t<5;t+=.37)replay.at(t);
  assert.equal(JSON.stringify([run.log.trueX.slice(0,400),run.x,run.z,run.heading,run.status,run.path.length]),before);
});

test('the previous run is the newest earlier one on the same robot from the same start',()=>{
  const a={id:1,robot:'kinetic'},b={id:2,robot:'turtlebot3'},c={id:3,robot:'kinetic',start:{x:1,z:0}},d={id:4,robot:'kinetic',start:{x:0,z:0}},now={robot:'kinetic'};
  assert.equal(previousRun([d,c,b,a],now),d);assert.equal(previousRun([c,b,a],now),a);assert.equal(previousRun([c,b],now),null);assert.equal(previousRun([d,a],d),a);
});

import {runEvents,EVENT_KINDS,SLIP_EVENT,COMMAND_JUMP} from '../dist/replay.mjs';
test('run events: command jumps, slip on ice, and a motor at its limit are found where the log shows them',()=>{
  const drive=(src,terrain='flat',robot='kinetic')=>simulateRun({design:DEFAULT,robot,terrain,program:parseProgram(src),seed:3});
  // Two commands and a stop: three jumps, at 0, 2, and 4 s.
  const steps=drive('drive(0.2, 0)\nwait(2)\ndrive(0.2, 1)\nwait(2)\nstop()'),jumps=runEvents(steps).filter(e=>e.kind==='command').map(e=>e.t0);
  assert.equal(jumps.length,3,`jumps at ${jumps}`);[0,2,4].forEach((t,i)=>close(jumps[i],t,.011,'jump time'));
  // A hard start on ice slips; the same start on concrete at a gentle speed does not.
  const ice=runEvents(drive('wheels(9, 9)\nwait(2)\nstop()','slippery')).filter(e=>e.kind==='slip'),calm=runEvents(drive('drive(0.1, 0)\nwait(2)\nstop()')).filter(e=>e.kind==='slip');
  assert.ok(ice.length>=1&&ice[0].t0<.1&&ice[0].t1-ice[0].t0>.3,`slip on ice: ${JSON.stringify(ice)}`);assert.equal(calm.length,0);
  // Each event agrees with the log it came from, sample by sample.
  const run=drive('wheels(9, 9)\nwait(2)\nstop()','slippery'),L=run.log,ev=runEvents(run),inside=(kind,t)=>ev.some(e=>e.kind===kind&&t>=e.t0-1e-9&&t<=e.t1+1e-9);
  for(let i=0;i<L.t.length;i++){
    if(Math.max(Math.abs(L.slipL[i]),Math.abs(L.slipR[i]))>SLIP_EVENT)assert.ok(inside('slip',L.t[i]),`slip sample at ${L.t[i]} s is inside an event`);
    if(i&&Math.abs(L.cmdL[i]-L.cmdL[i-1])>COMMAND_JUMP)assert.ok(inside('command',L.t[i]));
  }
  for(const e of ev){assert.ok(EVENT_KINDS.includes(e.kind)&&e.t1>=e.t0&&e.t0>=0&&e.t1<=L.t.at(-1));
    if(e.kind==='slip'){const i=Math.round(e.t0*100);assert.ok(Math.max(Math.abs(L.slipL[i]),Math.abs(L.slipR[i]))>SLIP_EVENT,'a slip event starts on a slipping sample');}}
  // A command beyond the TurtleBot3's motor holds it at its voltage limit.
  const tb=drive('wheels(10, 10)\nwait(2)\nstop()','flat','turtlebot3'),sat=runEvents(tb).filter(e=>e.kind==='saturation');
  assert.ok(sat.length>=1&&sat[0].t1-sat[0].t0>1,`saturation: ${JSON.stringify(sat)}`);
  assert.equal(runEvents(drive('drive(0.1, 0)\nwait(2)\nstop()','flat','turtlebot3')).filter(e=>e.kind==='saturation').length,0);
});

import {toCsv} from '../dist/drive.mjs';
test('the program is replayed too: its running line and its variables, and events name the line in force',()=>{
  const src='let sum = 0\nwhile time < 3\n  let e = 1 - odom_x\n  let sum = sum + e*0.05\n  drive(0.3*e, 0)\n  wait(0.05)\nend\nstop()';
  const cfg={design:DEFAULT,robot:'kinetic',terrain:'flat',program:parseProgram(src),seed:4},run=simulateRun(cfg),replay=new Replay(run);
  for(const time of [0,.42,1.5,2.93]){
    const want=liveAt(cfg,time),got=replay.at(time);
    assert.equal(got.line,want.line,`line at ${time} s`);
    assert.deepEqual([...got.vars].sort(),[...want.vars].sort(),`variables at ${time} s`);
    assert.ok(got.vars.has('sum')&&(time===0||got.vars.get('sum')>0));
  }
  // Once the program is over there is no running line.
  assert.equal(replay.at(replay.duration).line,0);assert.ok(run.log.line.includes(6)&&run.log.line.every(Number.isInteger));
  const csv=toCsv(run.log).split('\n');assert.ok(csv[0].endsWith(',program_line'));assert.equal(csv[1].split(',').at(-1),String(run.log.line[0]));
  const steps=simulateRun({design:DEFAULT,robot:'kinetic',terrain:'flat',program:parseProgram('drive(0.2, 0)\nwait(2)\ndrive(0.2, 1)\nwait(2)\nstop()'),seed:3});
  assert.deepEqual(runEvents(steps).filter(e=>e.kind==='command').map(e=>e.line),[1,3,5]);
  // A slip that starts under the first command belongs to line 1.
  const ice=runEvents(simulateRun({design:DEFAULT,robot:'kinetic',terrain:'slippery',program:parseProgram('wheels(9, 9)\nwait(2)\nstop()'),seed:3})).find(e=>e.kind==='slip');assert.equal(ice.line,1);
});
