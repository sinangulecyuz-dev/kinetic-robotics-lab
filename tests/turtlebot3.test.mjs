import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {simulateRun,ROBOTS,TERRAINS} from '../dist/drive.mjs';
// One TurtleBot3's lab measurements. Values read from plots carry about ±3° of reading error.
const lab=JSON.parse(readFileSync(new URL('./fixtures/turtlebot3-lab.json',import.meta.url),'utf8'));
const deg=r=>r*180/Math.PI,mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const waits=T=>{let s='';while(T>10){s+='wait(10)\n';T-=10;}return s+`wait(${T.toFixed(2)})\n`;};
const tb3=(code,noise=false,seed=21)=>simulateRun({design:DEFAULT,robot:'turtlebot3',program:parseProgram(code),noise,seed});
// Lab 1 read the odometry heading at the end of exactly one commanded circle, T = 2π/w.
const circleRun=({v_m_s:v,w_rad_s:w})=>{const T=2*Math.PI/w,L=tb3(`drive(${v}, ${w})\n${waits(T)}stop()`).log;return {L,i:Math.min(L.t.length-1,Math.round(T*100))};};
const circleHeading=c=>{const {L,i}=circleRun(c);return deg(L.odomYaw[i]);};
// Lab 1's error: distance between the odometry and the desired (commanded) circle at the end of the run.
const circleError=c=>{const {L,i}=circleRun(c);return Math.hypot(L.odomX[i]-L.desX[i],L.odomY[i]-L.desY[i]);};

test('TurtleBot3 geometry and firmware limits follow the robot and its datasheet',()=>{
  const spec=ROBOTS.turtlebot3;assert.equal(spec.wheelRadius,lab.robot.wheelRadius_m);assert.equal(spec.body().track,lab.robot.track_m);
  assert.deepEqual(spec.limits,{v:lab.robot.maxLinear_m_s,w:lab.robot.maxAngular_rad_s});
  const L=tb3('drive(0.5, 3)\nwait(0.2)').log,half=lab.robot.track_m/2,R=lab.robot.wheelRadius_m;
  assert.equal(L.cmdR[10],(.26+1.82*half)/R,'v and w are clipped to the firmware limits, with no extra wheel scaling');assert.equal(L.cmdL[10],(.26-1.82*half)/R);
});

test('fitted values reproduce the measurements they were fitted to',()=>{
  const fit=lab.lab1.circles.find(c=>c.usedToFit);assert.ok(Math.abs(circleHeading(fit)-fit.finalOdomHeading_deg)<=3,'v = 0.20 m/s circle: outer wheel at the motor speed limit');
  const turns=4,T=turns*2*Math.PI/lab.lab1.inPlace.w_rad_s,L=tb3(`drive(0, ${lab.lab1.inPlace.w_rad_s})\n${waits(T)}stop()`).log,i=Math.round(T*100);
  const perTurn=(deg(L.odomYaw[i])-deg(L.gyroYaw[i]))/turns,measured=lab.lab1.inPlace.encoderMinusImu_deg/lab.lab1.inPlace.turns;
  assert.ok(Math.abs(perTurn-measured)<=1,`in-place encoder-minus-gyro drift ${perTurn.toFixed(2)}°/turn vs ${measured}°/turn`);
});

test('independent checks: the other circles match within reading error',()=>{
  for(const c of lab.lab1.circles.filter(c=>!c.usedToFit&&2*Math.PI/c.w_rad_s<29)){
    const h=circleHeading(c);assert.ok(Math.abs(h-c.finalOdomHeading_deg)<=3,`v ${c.v_m_s}, w ${c.w_rad_s}: sim ${h.toFixed(1)}° vs measured ${c.finalOdomHeading_deg}°`);
  }
});

test('independent checks: end-of-circle odometry errors match, except the one marked not reproduced',()=>{
  for(const c of lab.lab1.circles.filter(c=>c.finalError_m!==undefined&&!c.notReproduced&&2*Math.PI/c.w_rad_s<29)){
    const e=circleError(c);assert.ok(Math.abs(e-c.finalError_m)<=Math.max(.01,.15*c.finalError_m),`v ${c.v_m_s}, w ${c.w_rad_s}: sim ${e.toFixed(3)} m vs measured ${c.finalError_m} m`);
  }
});

test('independent check: a 0.5 rad/s spin reads 0.47–0.50 rad/s on the gyro (Lab 0)',()=>{
  const r=lab.lab0.rotation,L=tb3(`drive(0, ${r.command_rad_s})\nwait(4)`,true).log,gz=mean(L.gz.slice(150,400));
  assert.ok(gz>=r.gyroZ_rad_s[0]-.01&&gz<=r.gyroZ_rad_s[1]+.01,`gyro_z ${gz.toFixed(3)}`);
});

test('IMU at rest has the measured offsets and spread',()=>{
  const m=lab.lab0.imuStationary,L=tb3('wait(10)',true).log,az=L.az.slice(10,1000);
  assert.ok(Math.abs(mean(az)-m.azMean_m_s2)<.05);assert.ok(Math.abs(mean(L.ax.slice(10,1000))-m.axMean_m_s2)<.03);
  assert.ok(az.filter(v=>v>=m.azRange_m_s2[0]&&v<=m.azRange_m_s2[1]).length/az.length>.97,'almost every sample inside the measured range');
});

test('straight driving keeps y and heading inside the measured bounds',()=>{
  const m=lab.lab1.linear,L=tb3(`repeat 3\n  drive(${m.v_m_s}, 0)\n  wait(${m.legSeconds})\n  stop()\n  wait(1)\n  drive(-${m.v_m_s}, 0)\n  wait(${m.legSeconds})\n  stop()\n  wait(1)\nend`,true).log;
  assert.ok(Math.max(...L.odomY.map(Math.abs))<=m.yErrorMax_m);assert.ok(Math.max(...L.odomYaw.map(a=>Math.abs(deg(a))))<=m.maxHeading_deg);
});

test('ball casters cannot drag harder than the ground allows',()=>{
  for(const t of Object.values(TERRAINS))assert.ok(ROBOTS.turtlebot3.casterCrr(t)<=t.muSlide);
});
