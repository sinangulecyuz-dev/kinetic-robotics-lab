// Outdoor wind and the grass terrain: independent force checks, symmetry, determinism, and no effect when off.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {DriveSim,simulateRun,terrainHeight,TERRAINS,ENVIRONMENTS,AIR,WIND,CHANNELS} from '../dist/drive.mjs';

const OLD=CHANNELS.filter(c=>!c.startsWith('wind'));
const sameRun=(a,b,label)=>{for(const c of OLD)assert.deepEqual(a.log[c],b.log[c],`${label}: ${c}`);};
const drive='drive(0.3, 0.4)\nwait(2)\nstop()';

test('wind off changes nothing, and a still wind adds only still-air drag without touching the sensor noise',()=>{
  const base=simulateRun({design:DEFAULT,terrain:'grass',program:parseProgram(drive),seed:5});
  sameRun(base,simulateRun({design:DEFAULT,terrain:'grass',program:parseProgram(drive),seed:5,wind:null}),'null');
  assert.ok(base.log.windSpeed.every(v=>v===0));
  // With the wind model on, even still air drags on the moving rover: about 0.005 N at 0.3 m/s, under a millimetre here.
  const opts={design:DEFAULT,terrain:'grass',program:parseProgram(drive),seed:5},a=new DriveSim(opts),b=new DriveSim({...opts,wind:{speed:0,toward:0,gust:.3}});a.run();b.run();
  assert.ok(Math.abs(a.log.trueX.at(-1)-b.log.trueX.at(-1))<1e-3&&Math.abs(a.log.trueY.at(-1)-b.log.trueY.at(-1))<1e-3);
  // Gusts draw from their own random stream: after the same run, the sensor-noise stream is at the same place.
  assert.equal(a.rand(),b.rand());
});

test('the first push of a steady wind on a rover at rest is 0.5·ρ·Cd·A·U² over its mass',()=>{
  // At rest the tires carry no force yet, so the body's first acceleration is the drag alone, on the axis the wind meets.
  for(const [toward,axis,area] of [[90,'l','side'],[-90,'l','side'],[180,'f','front'],[0,'f','front']])for(const robot of ['kinetic','turtlebot3']){
    const s=new DriveSim({design:DEFAULT,robot,noise:false,program:parseProgram('wait(1)'),wind:{speed:8,toward,gust:0}});s.step();
    const A=robot==='kinetic'?{front:(DEFAULT.width/100+.06)*.14+.0144,side:.5*.14+.0144}:{front:.281*.141,side:.306*.141};
    const sign=toward===90||toward===0?1:-1,expected=sign*.5*1.2*1.1*A[area]*64/s.mass;
    assert.ok(Math.abs(s.acc[axis]-expected)<1e-9,`${robot}, toward ${toward}: ${s.acc[axis]} vs ${expected}`);
    assert.ok(Math.abs(s.acc[axis==='l'?'f':'l'])<1e-9,`${robot}, toward ${toward}: no push on the other axis`);
  }
  assert.equal(AIR.density,1.2);assert.equal(AIR.cd,1.1);
});

test('a wind from the other side pushes the other way, by the same amount',()=>{
  const go=toward=>simulateRun({design:DEFAULT,terrain:'slippery',noise:false,program:parseProgram('stop()\nwait(3)'),wind:{speed:6,toward,gust:0}}).log;
  const a=go(90),b=go(-90);
  assert.ok(a.trueY.at(-1)>.01,'pushed toward +x, the rover’s left');
  assert.ok(Math.abs(a.trueY.at(-1)+b.trueY.at(-1))<1e-9&&Math.abs(a.trueYaw.at(-1)+b.trueYaw.at(-1))<1e-9);
});

test('random wind is 2–9 m/s, repeats for a seed, and does not depend on how frames split the time',()=>{
  const means=Array.from({length:100},(_,i)=>new DriveSim({design:DEFAULT,seed:i+1,wind:true}).wind.mean);
  assert.ok(Math.min(...means)>=WIND.minMean&&Math.max(...means)<=WIND.maxMean);
  assert.ok(new Set(means.map(m=>m.toFixed(6))).size>90,'seeds give different winds');
  const opts={design:DEFAULT,terrain:'grass',program:parseProgram(drive),seed:9,wind:true};
  const once=simulateRun(opts),split=new DriveSim(opts);
  for(let i=0;i<4000&&split.status==='running';i++)split.advance([.013,.007,.021][i%3]);
  assert.deepEqual(split.log.windSpeed,once.log.windSpeed);assert.deepEqual(split.log.trueX,once.log.trueX);
  // Gusts move the speed around its mean.
  const w=once.log.windSpeed,mean=w.reduce((a,b)=>a+b,0)/w.length;
  assert.ok(Math.max(...w)-Math.min(...w)>.1*mean,'gusty');
});

test('grass is gravel’s bump pattern at half height, and each environment lists real terrains',()=>{
  for(const [x,z] of [[.3,-1.2],[1.7,.4],[-2,2]])assert.equal(terrainHeight('grass',x,z),.5*terrainHeight('rough',x,z));
  assert.equal(terrainHeight('flat',1,1),0);
  for(const list of Object.values(ENVIRONMENTS))for(const id of list)assert.ok(TERRAINS[id],id);
  assert.ok(TERRAINS.grass.muPeak<TERRAINS.flat.muPeak&&TERRAINS.grass.crr>TERRAINS.rough.crr);
});
