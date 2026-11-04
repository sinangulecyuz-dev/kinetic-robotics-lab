import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {DriveSim} from '../dist/drive.mjs';
// Lab 2 drove a TurtleBot3 to a goal with the polar controller, every 0.145 s, from encoder odometry only.
// None of these values were used to fit the simulator: every check here is independent.
const lab=JSON.parse(readFileSync(new URL('./fixtures/turtlebot3-lab.json',import.meta.url),'utf8')).lab2;
const C=lab.controller,deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180,mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// The lab's controller, re-implemented from the handout and the limits in the fixture. It reads odometry, never ground truth.
// Positions are in the handout frame (x forward, y left, goal at the origin); `at` places the rover in our arena.
function polar({start,gains:[kr,ka,kb],reverse=true,path='fixed',vG=0,radius=.5,feedforward=false,stop=C.stop_m,vMin=C.vMin_m_s,seconds=29.5,at}){
  const sim=new DriveSim({design:DEFAULT,robot:'turtlebot3',program:parseProgram('wait(10)\nwait(10)\nwait(10)'),noise:false,start:at});
  const x0=start.x_m,y0=start.y_m,th0=rad(start.heading_deg),c=Math.cos(th0),s=Math.sin(th0),half=sim.width/2,rows=[];
  // Drive backward when the goal starts behind the robot, decided once at the start.
  const dir=reverse&&Math.abs(wrap(Math.atan2(-y0,-x0)-th0))>Math.PI/2?-1:1;
  for(let reached=false;sim.time<seconds&&sim.status==='running'&&!reached;sim.advance(C.loopPeriod_s)){
    const t=sim.time,o=sim.odom,x=x0+o.x*c-o.y*s,y=y0+o.x*s+o.y*c,th=th0+o.yaw,p=vG*t/radius;
    const [xg,yg,tg]=path==='line'?[vG*t,0,0]:path==='circle'?[radius*Math.sin(p),radius*(1-Math.cos(p)),p]:[0,0,0];
    const dx=xg-x,dy=yg-y,rho=Math.hypot(dx,dy),alpha=wrap((dir>0?Math.atan2(dy,dx):Math.atan2(-dy,-dx))-th),beta=wrap(tg-th-alpha);
    let v=dir*kr*rho+(feedforward?vG:0),w=ka*alpha+kb*beta;
    if(path==='fixed'&&rho<stop){v=0;w=0;reached=true;}
    else if(path==='fixed'&&Math.abs(v)<vMin){const k=vMin/Math.abs(v);v*=k;w*=k;}
    // One common factor keeps the curvature when v, w, or a wheel passes its limit.
    const k=Math.max(1,Math.abs(v)/C.vMax_m_s,Math.abs(w)/C.wMax_rad_s,(Math.abs(v)+Math.abs(w)*half)/C.wheelMax_m_s);v/=k;w/=k;
    sim.setTargets((v-w*half)/sim.R,(v+w*half)/sim.R);sim.command(v,w);
    rows.push({t,x,y,th,rho,v,w,tg,reached});
  }
  return rows;
}
const last40=rows=>rows.filter(r=>r.t>.6*rows.at(-1).t);
const lineRun=(r,feedforward=false)=>polar({start:lab.line.start,gains:r.gains,path:'line',vG:r.vG_m_s,feedforward,seconds:Math.min(29.5,r.seconds),at:{x:0,z:-2}});
const parked=lab.fixedGoal.runs.map(r=>({r,end:polar({start:r.start,gains:r.gains,reverse:r.reverse,stop:r.stop_m??C.stop_m}).at(-1)}));

test('Lab 2 parking: heading at the stop matches, except the run marked not reproduced',()=>{
  for(const {r,end} of parked){
    assert.ok(end.reached,`start ${JSON.stringify(r.start)}: reaches the stop by odometry`);
    if(r.notReproduced)continue;
    const h=deg(wrap(end.th));
    assert.ok(Math.abs(h-r.headingAtStop_deg)<=2,`start ${JSON.stringify(r.start)}, gains ${r.gains}: sim ${h.toFixed(1)}° vs measured ${r.headingAtStop_deg}°`);
  }
});

test('Lab 2 circle: the odometry radius and the heading lag match',()=>{
  const c=lab.circle,rows=last40(polar({start:c.start,gains:[.4,1.5,-.4],path:'circle',vG:c.vG_m_s,radius:c.radius_m}));
  const radius=mean(rows.map(r=>Math.hypot(r.x,r.y-c.radius_m))),lag=mean(rows.map(r=>deg(wrap(r.th-r.tg))));
  assert.ok(Math.abs(radius-c.robotRadius_m)<=.002,`radius ${radius.toFixed(4)} m vs ${c.robotRadius_m} m`);
  assert.ok(Math.abs(lag-c.headingLag_deg)<=1,`heading lag ${lag.toFixed(2)}° vs ${c.headingLag_deg}°`);
});

test('Lab 2 feedforward line weaves, as the robot did, while the plain law runs straight',()=>{
  const f=lab.feedforward,run={vG_m_s:f.vG_m_s,gains:f.gains,seconds:f.seconds},tail=rows=>rows.filter(r=>r.t>rows.at(-1).t-8);
  const weave=tail(lineRun(run,true)),plain=tail(lineRun(run));
  assert.ok(Math.max(...weave.map(r=>Math.abs(r.w)))>=.3&&Math.max(...weave.map(r=>Math.abs(deg(r.th))))>=5,'feedforward: w and heading swing');
  assert.ok(Math.max(...plain.map(r=>Math.abs(r.w)))<.05,'without feedforward: no swing');
});

// If a model change ever reproduces one of these, update notReproduced in the fixture and the README calibration table.
test('Lab 2 marks stay honest: what is marked not reproduced still differs',()=>{
  for(const r of lab.line.runs){
    const d=mean(last40(lineRun(r)).map(q=>q.rho)),ideal=r.vG_m_s/r.gains[0];
    assert.ok(Math.abs(d-ideal)<=.002&&r.distance_m-d>=.004,`line vG ${r.vG_m_s}, k_rho ${r.gains[0]}: sim ${d.toFixed(4)} m, measured ${r.distance_m} m, vG/k_rho ${ideal}`);
  }
  for(const {r,end} of parked)assert.ok(end.t<.97*r.time_s,`parking time: sim ${end.t.toFixed(2)} s vs ${r.time_s} s`);
  for(const {r,end} of parked.filter(p=>p.r.notReproduced))assert.ok(Math.abs(deg(wrap(end.th))-r.headingAtStop_deg)>2);
  const c=lab.circle,d=mean(last40(polar({start:c.start,gains:[.4,1.5,-.4],path:'circle',vG:c.vG_m_s,radius:c.radius_m})).map(q=>q.rho));
  assert.ok(c.distance_m-d>=.002,`circle distance: sim ${d.toFixed(4)} m vs ${c.distance_m} m`);
  const s=lab.stall,end=polar({start:s.start,gains:s.gains,vMin:s.vMin_m_s}).at(-1);
  assert.ok(end.reached&&end.rho<C.stop_m,`no stall: sim reaches the stop at ${(100*end.rho).toFixed(2)} cm`);
  const o=lab.overLimit,sim=new DriveSim({design:DEFAULT,robot:'turtlebot3',program:parseProgram(`drive(${o.command.v_m_s}, ${o.command.w_rad_s})\nwait(3)`),noise:false}).run(),L=sim.log,i=L.t.length-1;
  assert.ok(Math.hypot(L.trueX[i],L.trueY[i])>.1,'over the wheel limit the simulated robot keeps driving');
});
