// Math in wheels() and drive(): grammar, limits, hostile input, and run-time behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,WHEEL_RADIUS,parseProgram,parseValues,evaluate,SENSORS,MATH_LIMITS} from '../dist/physics.mjs';
import {simulateRun,ROBOTS} from '../dist/drive.mjs';

const KEYS=new Set(['exprSyntax','exprName','exprArity','exprLong','exprDepth','exprValue','args','wheelRange','driveV','driveW','unknown']);
const keyOf=fn=>{try{fn();}catch(e){return e.key;}return null;};
// A small seeded generator, so every run tests the same cases.
const random=seed=>{let s=seed>>>0;return ()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/2**32;};
const run=(code,extra={})=>simulateRun({design:DEFAULT,terrain:'flat',program:parseProgram(code),noise:false,seed:1,...extra});

test('number-only commands keep their exact form, and constant math is computed before the run',()=>{
  assert.deepEqual(parseProgram('drive(0.2, -1.5)')[0],{type:'drive',v:.2,w:-1.5,line:1});
  assert.deepEqual(parseProgram('wheels(4, -4)')[0],{type:'wheels',l:4,r:-4,line:1});
  assert.deepEqual(parseProgram('drive(0.1 * 2, -(3 - 1.5))')[0],{type:'drive',v:.2,w:-1.5,line:1});
  assert.deepEqual(parseProgram('wheels(abs(-4), max(1, min(2, 3)))')[0],{type:'wheels',l:4,r:2,line:1});
  // Range errors still appear before the run when the value does not depend on a sensor.
  assert.equal(keyOf(()=>parseProgram('drive(0.5 + 0.5, 0)')),'driveV');
  assert.equal(keyOf(()=>parseProgram('drive(0, 2 * 3.5)')),'driveW');
  assert.equal(keyOf(()=>parseProgram('wheels(5 * 3, 0)')),'wheelRange');
  assert.equal(keyOf(()=>parseProgram('drive(1 / 0, 0)')),'exprValue');
  assert.equal(keyOf(()=>parseProgram('wheels(0 / 0, 0)')),'exprValue');
  // A value that reads a sensor stays a tree for the run.
  const n=parseProgram('drive(0, 0.05*(90 - heading))')[0];
  assert.equal(n.v,0);assert.deepEqual(n.w,{op:'*',a:.05,b:{op:'-',a:90,b:{sensor:'heading'}}});
  for(const s of SENSORS)assert.deepEqual(parseProgram(`drive(0, ${s})`)[0].w,{sensor:s});
});

test('precedence and associativity match JavaScript on 3000 generated expressions',()=>{
  // JavaScript's own parser is the independent reference. Divisors are nonzero numbers, so both sides stay finite.
  const r=random(2026),num=()=>String(Math.floor(r()*1000)/100),nonzero=()=>String(1+Math.floor(r()*899)/100);
  const gen=d=>{
    const c=r();
    if(d>=3||c<.3)return num();
    if(c<.4)return '- '+gen(d+1);
    if(c<.5)return `(${gen(d+1)})`;
    if(c<.57)return `abs(${gen(d+1)})`;
    if(c<.64)return `${r()<.5?'min':'max'}(${gen(d+1)}, ${gen(d+1)})`;
    const op='+-*/'[Math.floor(r()*4)];
    return `${gen(d+1)} ${op} ${op==='/'?nonzero():gen(d+1)}`;
  };
  const js=src=>new Function('abs','min','max',`return ${src};`)(Math.abs,Math.min,Math.max);
  let compared=0,tooLong=0;
  for(let i=0;i<3000;i++){
    const src=gen(0);let ours;
    try{[ours]=parseValues(src);}catch(e){if(e.key==='exprLong'){tooLong++;continue;}throw new Error(`${src}: ${e.message}`);}
    assert.equal(ours,js(src),src);compared++;
  }
  assert.ok(compared>2000,`only ${compared} compared (${tooLong} too long)`);
});

test('hostile or malformed math is refused with a line number and a known message',()=>{
  const cases={
    'drive(alert(1), 0)':'exprName','drive(constructor(1), 0)':'exprName','drive(__proto__, 0)':'exprName','drive(0, hasownproperty(1))':'exprName',
    'drive(0, speed)':'exprName','drive(0, sin(1))':'exprName','drive(0, abs)':'exprName','drive(0, distance(1))':'exprName',
    'drive(0, heading.x)':'exprSyntax','drive(0, "1")':'exprSyntax','drive(0, [1])':'exprSyntax','drive(0, 1;2)':'exprSyntax','drive(0, x=1)':'exprSyntax',
    'drive(0, 1e3)':'exprSyntax','drive(0, .5)':'exprSyntax','drive(0, 2**2)':'exprSyntax','drive(0, 1 2)':'exprSyntax','drive(0, (1)':'exprSyntax',
    'drive(0, 1))':'exprSyntax','drive(0, )':'exprSyntax','drive(,)':'exprSyntax','drive()':'exprSyntax','drive(0, Heading)':'exprSyntax','drive(0, 1 +)':'exprSyntax',
    'drive(0.2)':'args','drive(0.2, 1, 3)':'args','wheels(1)':'args',
    'drive(0, abs(1, 2))':'exprArity','drive(0, min(1))':'exprArity','drive(0, max(1, 2, 3))':'exprArity',
    'drive(0, ((((((1))))))':'exprDepth','drive(0, abs(abs(abs(abs(abs(abs(1)))))))':'exprDepth',
    [`drive(0, ${Array(21).fill('1').join('+')})`]:'exprLong',
    'drive (0, 1)':'unknown','Drive(0, 1)':'unknown','wait(1 + 1)':'unknown',
  };
  for(const [source,key] of Object.entries(cases)){
    let error;try{parseProgram(source);}catch(e){error=e;}
    assert.ok(error,`${source} was accepted`);assert.equal(error.key,key,source);assert.match(error.message,/^Line 1: /,source);
  }
  // Limits: five nested parentheses and 40 symbols are allowed, one more is not.
  assert.equal(parseValues('((((('+'1'+')))))')[0],1);
  assert.equal(parseValues('-'.repeat(MATH_LIMITS.symbols-1)+'1')[0],-1);
  assert.equal(keyOf(()=>parseValues('-'.repeat(MATH_LIMITS.symbols)+'1')),'exprLong');
  // Huge input stops at the symbol limit instead of recursing.
  assert.equal(keyOf(()=>parseProgram(`drive(0, ${'('.repeat(1e5)}1${')'.repeat(1e5)})`)),'exprLong');
  // if and while still compare one sensor with one number.
  assert.equal(keyOf(()=>parseProgram('while heading < 90 * 2\nwait(1)\nend')),'unknown');
});

test('random text never escapes the parser as anything but a line-numbered message',()=>{
  const r=random(7),alphabet='0123456789.+-*/(),  abcdhilmnstx_e=;"[]{}<>!?#',words=['abs(','min(','max(','heading','distance','time','gyro_z','lidar_left'];
  for(let i=0;i<20000;i++){
    let s='';const n=Math.floor(r()*50);
    for(let j=0;j<n;j++)s+=r()<.15?words[Math.floor(r()*words.length)]:alphabet[Math.floor(r()*alphabet.length)];
    for(const source of [`drive(${s}, 0)`,`wheels(1, ${s})`]){
      try{parseProgram(source);}
      catch(e){assert.ok(KEYS.has(e.key),`${JSON.stringify(source)}: ${e.message}`);assert.match(e.message,/^Line 1: /);}
    }
  }
});

test('evaluate reads sensors through the given function only',()=>{
  const seen=[];const tree=parseValues('max(heading, 2 * lidar_left) - abs(time)')[0];
  assert.equal(evaluate(tree,name=>{seen.push(name);return {heading:10,lidar_left:7,time:-3}[name];}),11);
  assert.deepEqual(seen,['heading','lidar_left','time']);
  assert.ok(Number.isNaN(evaluate(parseValues('1 / (time - time)')[0],()=>5)),'division by zero has no value');
  assert.equal(evaluate(parseValues('2 * lidar_left')[0],()=>Infinity),Infinity,'a LiDAR beam with no return stays infinite, and the run clips it');
});

test('math on sensors runs like the same numbers, and values past the limits are clipped',()=>{
  // With noise off, time and heading read exactly 0 at the start, so these must match the number form bit for bit.
  const same=(a,b)=>{const x=run(a),y=run(b);assert.equal(x.success,true,x.message);assert.deepEqual(x.log,y.log,`${a} vs ${b}`);};
  same('drive(0.2 + 0*time, 0*heading)\nwait(1)\nstop()','drive(0.2, 0)\nwait(1)\nstop()');
  same('wheels(20 + time, -20 - time)\nwait(0.5)\nstop()','wheels(10, -10)\nwait(0.5)\nstop()');
  same('drive(100*distance, -100*distance)\nwait(0.5)\nstop()','drive(0.75, -6)\nwait(0.5)\nstop()');
  // The TurtleBot3 firmware limit still applies after the parser limit.
  same('drive(0, 10 + time)\nwait(0.5)\nstop()','drive(0, 6)\nwait(0.5)\nstop()');
  const tb=c=>run(c,{robot:'turtlebot3'}).log;
  assert.deepEqual(tb('drive(1 + time, 0)\nwait(0.5)\nstop()'),tb('drive(0.75, 0)\nwait(0.5)\nstop()'));
});

test('a division by zero during the run stops on its line',()=>{
  const s=run('drive(0.2, 0)\nwait(0.5)\ndrive(0.2, 1/(time - time))\nwait(1)');
  assert.equal(s.success,false);assert.equal(s.messageKey,'sim.noValue');assert.deepEqual(s.messageParams,{line:3});
  assert.ok(Math.abs(s.time-.5)<.02,`stopped at ${s.time} s`);
});

test('a P-controlled turn follows the sampled-data model: small gain falls short, large gain overshoots',()=>{
  // Independent model: the command is held for each 0.1 s wait, so the heading error shrinks by (1 - k·0.1·180/π) per step,
  // with the turn rate capped where a wheel reaches 10 rad/s: w_max = 10·R/(W/2). Motor lag is left out on purpose.
  const deg=180/Math.PI,wMax=ROBOTS.kinetic.maxWheel*WHEEL_RADIUS/(DEFAULT.width/100/2);
  const model=k=>{let h=0,peak=0;for(let i=0;i<20;i++){h+=Math.max(-wMax,Math.min(wMax,k*(90-h)))*.1*deg;peak=Math.max(peak,h);}return {end:h,peak};};
  const sim=k=>{const s=run(`repeat 20\n  drive(0, ${k}*(90 - heading))\n  wait(0.1)\nend\nstop()`);assert.equal(s.success,true,s.message);
    const y=s.log.trueYaw.map(v=>v*deg);return {end:y.at(-1),peak:Math.max(...y)};};
  // k = 0.02 stays below the rate cap, so the model is linear: 90·(1 - (1 - 0.02·0.1·180/π)^20) ≈ 82.1°.
  const low=sim(.02),lowModel=model(.02);
  assert.ok(Math.abs(lowModel.end-82.1)<.1,`model ${lowModel.end}`);
  assert.ok(Math.abs(low.end-lowModel.end)<1.5,`k = 0.02 ends at ${low.end.toFixed(1)}°, model ${lowModel.end.toFixed(1)}°`);
  // k = 0.05, the example's gain, settles near 90° without a large overshoot.
  const mid=sim(.05);assert.ok(Math.abs(mid.end-90)<2&&mid.peak<93,`k = 0.05: peak ${mid.peak.toFixed(1)}°, end ${mid.end.toFixed(1)}°`);
  // k = 0.3: the model's error multiplier per step is negative, so it overshoots; so must the rover.
  const high=sim(.3),highModel=model(.3);
  assert.ok(highModel.peak>95,`model peak ${highModel.peak}`);
  assert.ok(high.peak>95&&Math.abs(high.end-90)<3,`k = 0.3: peak ${high.peak.toFixed(1)}°, end ${high.end.toFixed(1)}°`);
});
