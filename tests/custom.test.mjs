import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {simulateRun,DriveSim,ROBOTS,CUSTOM,customDesign,MOTOR,TERRAINS,GRAVITY} from '../dist/drive.mjs';
import {Replay} from '../dist/replay.mjs';

// "Build your own robot": an invented design, checked against what its own numbers imply, not against a real robot.
const away={x:-1.6,z:-2},run=(d,src,terrain='flat')=>simulateRun({design:{...DEFAULT,...d},robot:'custom',terrain,program:parseProgram(src),seed:2,start:away});
const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b} (±${tol})`);
const ends=k=>[CUSTOM[k].min,CUSTOM[k].value,CUSTOM[k].max];

test('every corner of the design range drives on every terrain without tipping or NaN',()=>{
  const gentle='drive(0.3, 0)\nwait(2)\ndrive(0.2, 1.5)\nwait(2)\nstop()',hard='wheels(10, 10)\nwait(1)\nwheels(-10, 10)\nwait(1)\nwheels(-10, -10)\nwait(0.8)\nstop()';
  for(const wheel of ends('wheel'))for(const motor of ends('motor'))for(const chassis of ends('chassis'))for(const width of [24,60])for(const terrain of Object.keys(TERRAINS))for(const src of [gentle,hard]){
    const s=run({wheel,motor,chassis,width},src,terrain),what=`wheel ${wheel}, motor ${motor}, chassis ${chassis}, width ${width}, ${terrain}`;
    assert.ok(s.success,`${what}: ${s.message}`);assert.ok([s.x,s.z,s.heading,s.margin,...s.log.trueX.slice(-5)].every(Number.isFinite),what);
  }
});

test('the design sets the mass, and out-of-range or missing choices fall back inside the range',()=>{
  for(const [motor,chassis] of [[.1,1],[1,1.8],[2,4]])close(run({motor,chassis},'wait(0.1)').mass,chassis+CUSTOM.battery+2*CUSTOM.motorMass*motor,1e-12,'mass = frame + battery + two motors');
  assert.deepEqual(customDesign({}),{wheel:15,motor:1,chassis:1.8});assert.deepEqual(customDesign({wheel:99,motor:-3,chassis:'x'}),{wheel:CUSTOM.wheel.max,motor:CUSTOM.motor.min,chassis:CUSTOM.chassis.value});
  // The other robots do not read these choices.
  const a=simulateRun({design:DEFAULT,robot:'kinetic',program:parseProgram('drive(0.3, 0.4)\nwait(1)'),seed:1}),b=simulateRun({design:{...DEFAULT,wheel:24,motor:2,chassis:4},robot:'kinetic',program:parseProgram('drive(0.3, 0.4)\nwait(1)'),seed:1});
  assert.deepEqual(a.log.trueX,b.log.trueX);assert.equal(ROBOTS.kinetic.build,undefined);
});

test('wheel size: the same wheel speed gives a ground speed of omega times the radius',()=>{
  for(const wheel of ends('wheel')){const s=run({wheel},'wheels(8, 8)\nwait(3)\nstop()');close(s.log.trueSpeed[250],8*wheel/200,.02*8*wheel/200,`wheel ${wheel} cm`);
    close(s.log.odomX[250]/s.log.trueX[250],1,.03,'odometry uses the same radius');}
});

test('motor strength: a weak motor on a big wheel cannot beat rolling resistance on grass, as its stall force says',()=>{
  // Stall force at the ground: two motors, kt * V / (resistance / strength), over the wheel radius.
  const force=(motor,wheel)=>2*MOTOR.kt*MOTOR.volts/(MOTOR.resistance/motor)/(wheel/200);
  const weak={wheel:24,motor:.1,chassis:4},strong={...weak,motor:.5},mass=4+CUSTOM.battery+2*CUSTOM.motorMass*.1,drag=TERRAINS.grass.crr*mass*GRAVITY;
  assert.ok(force(.1,24)<drag&&force(.5,24)>2*drag,`stall force ${force(.1,24).toFixed(1)} N and ${force(.5,24).toFixed(1)} N against ${drag.toFixed(1)} N of rolling resistance`);
  const go='wheels(10, 10)\nwait(5)\nstop()',stuck=run(weak,go,'grass'),moves=run(strong,go,'grass');
  assert.ok(stuck.log.trueX[400]<.3,`the weak one moved ${stuck.log.trueX[400].toFixed(2)} m`);assert.ok(moves.log.trueX[400]>2,`the strong one moved ${moves.log.trueX[400].toFixed(2)} m`);
});

test('motor strength: more torque brakes shorter and, on ice, slips more',()=>{
  const sprint='wheels(10, 10)\nwhile odom_x < 2\n  wait(0.05)\nend\nstop()',over=[.1,.5,2].map(motor=>{const s=run({motor,chassis:4},sprint);return s.log.trueX.at(-1)-2;});
  assert.ok(over[0]>over[1]+.1&&over[1]>over[2],`overshoot past 2 m: ${over.map(v=>v.toFixed(2))} m`);
  const slip=[.25,2].map(motor=>Math.max(...run({motor,wheel:24},sprint,'slippery').log.slipL.map(Math.abs)));assert.ok(slip[1]>2*slip[0],`peak slip on ice: ${slip.map(v=>v.toFixed(2))} m/s`);
  // On ice the strong design's odometry says 2 m while the rover is well short: the wheels spun.
  const s=run({motor:2,wheel:24},sprint,'slippery');assert.ok(s.log.odomX.at(-1)>=2&&s.log.trueX.at(-1)<1.8,`odometry ${s.log.odomX.at(-1).toFixed(2)} m, truth ${s.log.trueX.at(-1).toFixed(2)} m`);
});

test('a heavier frame takes longer to reach speed, and a run of a built robot replays',()=>{
  const reach=chassis=>{const s=run({chassis,motor:.25},'drive(0.6, 0)\nwait(3)\nstop()');return s.log.trueSpeed.findIndex(v=>v>.5);},light=reach(1),heavy=reach(4);
  assert.ok(light>0&&heavy>1.3*light,`samples to 0.5 m/s: ${light} light, ${heavy} heavy`);
  const cfg={design:{...DEFAULT,wheel:22,motor:.4,chassis:3},robot:'custom',terrain:'flat',program:parseProgram('drive(0.3, 0.5)\nwait(2)\nstop()'),seed:9,start:away},replay=new Replay(simulateRun(cfg)),live=new DriveSim(cfg);live.advance(1.2001);
  const got=replay.at(1.2);close(got.x,live.x,.003,'x');close(got.z,live.z,.003,'z');close(got.R,.11,1e-12,'the replay keeps the wheel radius');close(got.mass,live.mass,1e-12,'and the mass');
});
