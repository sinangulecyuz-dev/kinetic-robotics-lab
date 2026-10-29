import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,PRESETS,centerOfMass,parseProgram,WHEEL_RADIUS} from '../dist/physics.mjs';
import {DriveSim,simulateRun,contactLoads,frictionCurve,terrainHeight,toCsv,TERRAINS,PEAK_SLIP,ENCODER_CPR,MOTOR,GRAVITY,AXLE_Z,CHANNELS} from '../dist/drive.mjs';
const close=(a,b,tolerance,msg='')=>assert.ok(Math.abs(a-b)<=tolerance,`${msg} ${a} != ${b} ± ${tolerance}`);
const mean=(a,i0,i1)=>{let s=0;for(let i=i0;i<i1;i++)s+=a[i];return s/(i1-i0);};
const drive=(code,terrain='flat',design=DEFAULT,extra={})=>simulateRun({design,terrain,program:parseProgram(code),noise:false,...extra});

test('static loads match lever arms about the axle and the centerline',()=>{
  const com=centerOfMass(DEFAULT),s=contactLoads(DEFAULT,{f:0,l:0,n:-GRAVITY});
  const caster=(AXLE_Z-com.z)/(AXLE_Z+.22);
  close(s.fractions[2],caster,1e-12,'caster share');close(s.fractions[0],(1-caster)/2,1e-12,'left');close(s.fractions[1],(1-caster)/2,1e-12,'right');
  close(s.total,com.mass*GRAVITY,1e-9,'total');
  // Braking at 3 m/s²: extra caster unloading equals m·a·h over the 0.30 m wheelbase.
  const brake=contactLoads(DEFAULT,{f:3,l:0,n:-GRAVITY});
  close(s.loads[2]-brake.loads[2],com.mass*3*com.y/.30,1e-9,'load transfer');
  // A payload on the robot's left (+x) loads the left wheel more.
  const leftLoad=contactLoads({...DEFAULT,offset:10},{f:0,l:0,n:-GRAVITY});assert.ok(leftLoad.fractions[0]>leftLoad.fractions[1]);
});

test('friction curve peaks at the peak slip and settles at the sliding coefficient',()=>{
  for(const t of Object.values(TERRAINS)){
    const c=frictionCurve(t);close(c.mu(PEAK_SLIP),t.muPeak,1e-12);assert.ok(c.mu(PEAK_SLIP*.5)<t.muPeak&&c.mu(PEAK_SLIP*2)<t.muPeak);
    close(c.mu(1e6),t.muSlide,1e-4);
  }
});

test('motor constants give the stated stall torque and free speed',()=>{
  close(MOTOR.kt*MOTOR.volts/MOTOR.resistance,1.36,.01,'stall torque N·m');close(MOTOR.volts/MOTOR.ke,34.6,.1,'free speed rad/s');
});

test('a parked rover on flat ground stays put and its IMU reads gravity',()=>{
  const sim=drive('wait(2)'),L=sim.log;
  assert.equal(sim.success,true);assert.ok(Math.hypot(sim.x,sim.z)<1e-9);
  for(const i of [10,100,200]){close(L.az[i],GRAVITY,2e-3);close(L.ax[i],0,2e-3);close(L.gz[i],0,1e-3);}
});

test('straight driving on concrete reaches R·ω and keeps a straight heading',()=>{
  const L=drive('wheels(4, 4)\nwait(2.5)').log,i=240;
  close(mean(L.trueSpeed,200,240),4*WHEEL_RADIUS,.003,'speed');close(L.trueYaw[i],0,1e-9,'yaw');close(L.trueY[i],0,1e-9,'lateral');
  assert.ok(Math.max(...L.wheelL.slice(0,100))<4*1.05,'speed loop overshoot under 5%');
});

test('steady turn matches ideal kinematics, gyro, and centripetal acceleration',()=>{
  const L=drive('wheels(2, 5)\nwait(4)').log,i0=250,i1=390,yawRate=(L.trueYaw[i1]-L.trueYaw[i0])/(L.t[i1]-L.t[i0]),speed=mean(L.trueSpeed,i0,i1);
  close(yawRate,WHEEL_RADIUS*(5-2)/(DEFAULT.width/100),.01,'yaw rate vs R(ωr-ωl)/W');assert.ok(yawRate>0,'faster right wheel turns left');
  close(mean(L.gz,i0,i1),yawRate,.002,'gyro z');
  // Rigid-body kinematics: the IMU sits on the centerline 8 cm behind the axle, so a_y = ω·v and a_x = ω²·0.08.
  close(mean(L.ay,i0,i1),yawRate*speed,.004,'centripetal a_y');close(mean(L.ax,i0,i1),yawRate*yawRate*AXLE_Z,.003,'a_x');
});

test('encoders count whole ticks of the wheel angle',()=>{
  const sim=drive('wheels(3, 6)\nwait(1.5)');
  for(const wh of sim.wheels)assert.equal(wh.count,Math.floor(wh.theta/(2*Math.PI/ENCODER_CPR))-(0));
  const L=sim.log;assert.ok(L.encR.at(-1)>L.encL.at(-1));assert.ok(L.encL.every(Number.isInteger));
});

test('on ice the rover cannot accelerate faster than μ·g, and its wheels spin',()=>{
  const ice=drive('wheels(10, 10)\nwait(1.5)','slippery').log;
  let peak=0;for(let i=2;i<ice.t.length;i++)peak=Math.max(peak,(ice.trueSpeed[i]-ice.trueSpeed[i-2])/(ice.t[i]-ice.t[i-2]));
  assert.ok(peak<=TERRAINS.slippery.muPeak*GRAVITY*1.02,`accel ${peak}`);
  assert.ok(Math.max(...ice.slipL)>.3,'wheelspin on ice');
  // A moderate start grips on concrete but spins on ice. (A full-power start spins on concrete too:
  // the load moves back onto the caster and unloads the front drive wheels.)
  const gentle='wheels(4, 4)\nwait(0.6)',slip=t=>Math.max(...drive(gentle,t).log.slipL);
  assert.ok(slip('flat')<.05,`concrete ${slip('flat')}`);assert.ok(slip('slippery')>5*slip('flat'),`ice ${slip('slippery')}`);
});

test('encoder odometry drifts more on ice than on concrete',()=>{
  const square='repeat 4\n  wheels(4, 4)\n  wait(1.4)\n  wheels(4, -4)\n  wait(1.15)\nend\nstop()';
  const flat=drive(square).summary().odomError,ice=drive(square,'slippery').summary().odomError;
  assert.ok(flat<.08,`flat ${flat}`);assert.ok(ice>3*flat,`ice ${ice} vs flat ${flat}`);
});

test('bumps tilt the rover: the gyro sees roll and pitch on rough ground only',()=>{
  assert.equal(terrainHeight('flat',.3,.7),0);
  for(let x=-2;x<=2;x+=.13)for(let z=-2;z<=2;z+=.17)assert.ok(Math.abs(terrainHeight('rough',x,z))<=.0215);
  const code='wheels(5, 5)\nwait(2)',rough=drive(code,'rough').log,flat=drive(code,'flat').log,peak=a=>Math.max(...a.map(Math.abs));
  assert.ok(peak(rough.gx)>.02&&peak(rough.gy)>.02,'roll and pitch rates on bumps');assert.equal(peak(flat.gx),0);assert.equal(peak(flat.gy),0);
});

test('hard braking with a high payload lifts the caster and stops the run',()=>{
  const tall=drive('wheels(8, 8)\nwait(1)\nwheels(-8, -8)\nwait(1)','flat',PRESETS.tall);
  assert.equal(tall.success,false);assert.match(tall.message,/caster lifted/);
  const gentle=drive('wheels(4, 4)\nwait(1)\nstop()','flat',PRESETS.tall);assert.equal(gentle.success,true);
});

test('runs are deterministic for a seed, however the frames split the time',()=>{
  const opts={design:DEFAULT,terrain:'rough',program:parseProgram('wheels(4, 5)\nwait(1.3)\nwheels(-3, 2)\nwait(0.7)'),seed:42};
  const whole=simulateRun(opts),chunked=new DriveSim(opts);let k=0;while(chunked.status==='running')chunked.advance([.016,.033,.0071,.25][k++%4]);
  for(const c of ['gz','ax','encL','trueX','range'])assert.deepEqual(chunked.log[c],whole.log[c],c);
  const other=simulateRun({...opts,seed:43});assert.notDeepEqual(other.log.gz,whole.log.gz);
});

test('drive(v, w) gives the commanded speed and yaw rate, and saturation keeps the curve',()=>{
  const L=drive('drive(0.2, 1)\nwait(4)').log,i0=250,i1=390,half=DEFAULT.width/200;
  close((L.trueYaw[i1]-L.trueYaw[i0])/(L.t[i1]-L.t[i0]),1,.01,'yaw rate');close(mean(L.trueSpeed,i0,i1),.2,.003,'speed');
  close(L.cmdR[300],(.2+1*half)/WHEEL_RADIUS,1e-12,'right target (v + w·W/2)/R');close(L.cmdL[300],(.2-1*half)/WHEEL_RADIUS,1e-12,'left target (v - w·W/2)/R');
  const fast=drive('drive(0.75, 6)\nwait(1)').log;
  assert.equal(Math.max(...fast.cmdR),10);close(fast.cmdL[50]/fast.cmdR[50],(.75-6*half)/(.75+6*half),1e-12,'wheel ratio, so the radius, is kept');
});

test('programs act on sensor samples: a gyro-guided turn and an encoder-measured wheel turn',()=>{
  const deg=180/Math.PI,turn=drive('drive(0, 1)\nwhile heading < 90\n  wait(0.05)\nend\nstop()').log,stop=turn.cmdR.findIndex((v,i)=>i>0&&v===0);
  assert.ok(turn.gyroYaw[stop]*deg>=90,'gyro had passed 90° when the stop arrived');assert.ok(turn.gyroYaw[stop-6]*deg<90,'and had not one poll earlier');
  const final=turn.trueYaw.at(-1)*deg;assert.ok(final>90&&final<105,`overshoot from polling and braking stays small: ${final}`);
  const wheel=drive('drive(0.2, 0)\nwhile encoder_left < 1920\n  wait(0.05)\nend\nstop()').log,s=wheel.cmdL.findIndex((v,i)=>i>0&&v===0);
  assert.ok(wheel.encL[s]>=ENCODER_CPR&&wheel.encL[s-6]<ENCODER_CPR,'stopped on the first poll past one revolution');
  close(wheel.trueX.at(-1),2*Math.PI*WHEEL_RADIUS,.03,'travelled about one wheel circumference');
  assert.match(drive('drive(0, 1)\nwhile heading < 90\nend').message,/instruction limit/,'a loop without waits is still stopped');
});

test('CSV export has one unit-labelled column per channel and one row per sample',()=>{
  const sim=drive('wheels(2, 2)\nwait(0.3)'),rows=toCsv(sim.log).trim().split('\n');
  assert.equal(rows.length,sim.log.t.length+1);assert.equal(rows[0].split(',').length,CHANNELS.length);
  assert.ok(rows[0].startsWith('t_s,cmd_left_rad_s'));assert.match(rows[0],/true_x_m/);
});
