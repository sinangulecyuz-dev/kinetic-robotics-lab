import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {simulateRun,DriveSim,ROBOTS,TERRAINS,WALL,RANGE} from '../dist/drive.mjs';
import {MISSIONS,missionById,missionsFor,missionText,diagnose} from '../dist/missions.mjs';
// Reference solutions live only here, so the lab never shows students the answer.
const SOLUTIONS={
  stop:'drive(0.3, 0)\nwhile distance > 0.35\n  wait(0.05)\nend\ndrive(0.08, 0)\nwhile distance > 0.21\n  wait(0.05)\nend\nstop()',
  turn:'drive(0, 1)\nwhile heading < 330\n  wait(0.05)\nend\ndrive(0, 0.3)\nwhile heading < 359.5\n  wait(0.05)\nend\nstop()',
  // P on speed: fast while far, slower as the gap closes.
  park:'while time < 15\n  drive(1*(distance - 0.5), 0)\n  wait(0.05)\nend\nstop()',
  // P on the perpendicular distance plus P on the angle to the wall, both from the LiDAR, so gyro drift does not bias it.
  wall:'while odom_x < 3.8\n  drive(0.2, 2*(lidar_min - 0.5) + 0.02*(lidar_min_angle - 90))\n  wait(0.05)\nend\nstop()',
  // PID: the P-and-D wall follower plus a running sum of the error, which cancels the steady push of the wind.
  wind:'let sum = 0\nwhile odom_x < 3.8\n  let e = lidar_min - 0.5\n  let sum = sum + e*0.05\n  drive(0.2, 2*e + 0.02*(lidar_min_angle - 90) + 1*sum)\n  wait(0.05)\nend\nstop()',
  square:'drive(0.15, 0)\nwhile odom_x < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 88\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 178\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_x > 0\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 268\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y > 0\n  wait(0.05)\nend\nstop()'
};
const attempt=(m,code,seed)=>m.judge(simulateRun({design:DEFAULT,robot:m.robot,terrain:m.terrain,program:parseProgram(code),seed,start:m.start,wind:m.wind??null}));

test('missions name a real robot and terrain, and their starters parse',()=>{
  for(const m of MISSIONS){assert.ok(ROBOTS[m.robot]&&TERRAINS[m.terrain],m.id);assert.ok(parseProgram(m.starter).length>0);assert.equal(missionById(m.id),m);assert.ok(SOLUTIONS[m.id],`reference solution for ${m.id}`);}
});

for(const m of MISSIONS){
  test(`mission "${m.title}": the starter falls short and a sensor-based solution passes, for every seed`,()=>{
    for(const seed of [1,2,3,4]){
      const first=attempt(m,m.starter,seed),good=attempt(m,SOLUTIONS[m.id],seed);
      assert.equal(first.pass,false,`starter, seed ${seed}: ${first.text}`);assert.equal(good.pass,true,`solution, seed ${seed}: ${good.text}`);
      assert.ok(first.text.length>0&&good.text.length>0);
    }
  });
}

test('a run that never moves cannot pass the square, and a crash cannot pass the stop',()=>{
  assert.equal(attempt(missionById('square'),'wait(1)',1).pass,false);
  assert.match(attempt(missionById('stop'),'drive(0.3, 0)\nwait(5)',1).text,/stopped early/);
});

test('every experiment with missions lists them, and Experiment 03 starts the rover near a wall',()=>{
  assert.deepEqual(missionsFor(2).map(m=>m.id),['stop','turn','square']);
  assert.deepEqual(missionsFor(3).map(m=>m.id),['park','wall']);
  assert.deepEqual(missionsFor(4).map(m=>m.id),['wind']);
  for(const m of MISSIONS)assert.ok([2,3,4].includes(m.experiment),m.id);
  // Independent geometry, noise off: the walls stand at ±2.5 m, the Kinetic LiDAR sits on the body's center line,
  // and the front range sensor looks from 0.3 m ahead of the body origin.
  const s=new DriveSim({design:DEFAULT,terrain:'flat',noise:false,start:missionById('wall').start});
  assert.ok(Math.abs(s.sensor('lidar_left')-(WALL-1.7))<.002,`lidar_left ${s.sensor('lidar_left')}`);
  assert.ok(Math.abs(s.sensor('lidar_right')-(WALL+1.7))<.002||s.sensor('lidar_right')===Infinity);
  assert.equal(s.sensor('distance'),RANGE.max,'the wall ahead is 4.2 m away, past the 3 m range');
  assert.deepEqual(s.origin,{x:1.7,z:-2});
  // A start outside the arena is pulled back inside, and no start means the center.
  assert.deepEqual(new DriveSim({design:DEFAULT,start:{x:9,z:-9}}).origin,{x:2,z:-2});
  assert.deepEqual(new DriveSim({design:DEFAULT}).origin,{x:0,z:0});
});

test('following the wall on distance alone hits the wall for every gain tried, as the hint says',()=>{
  const wall=missionById('wall');
  for(const sensor of ['lidar_left','lidar_min'])for(const k of [0.2,1,4]){
    const r=attempt(wall,`while odom_x < 3.8\n  drive(0.2, ${k}*(${sensor} - 0.5))\n  wait(0.05)\nend\nstop()`,1);
    assert.equal(r.pass,false,`${sensor}, gain ${k}: ${r.text}`);assert.equal(r.key,'judge.early',`${sensor}, gain ${k}: ${r.text}`);
  }
  // Driving straight without steering stays 0.8 m from the wall: it finishes, but misses by 30 cm.
  const straight=attempt(wall,'drive(0.2, 0)\nwhile odom_x < 3.8\n  wait(0.05)\nend\nstop()',1);
  assert.equal(straight.key,'judge.wall');assert.equal(straight.pass,false);assert.ok(Math.abs(+straight.params.miss-30)<1,straight.text);
  // Steering back toward the gyro heading also passes, despite gyro drift.
  for(const seed of [1,2,3,4])assert.equal(attempt(wall,'while odom_x < 3.8\n  drive(0.2, 2*(lidar_left - 0.5) - 0.02*heading)\n  wait(0.05)\nend\nstop()',seed).pass,true,`gyro version, seed ${seed}`);
});

test('in the wind, P and D settle off the line and the integral removes it, over twelve seeds',()=>{
  // Over 40 seeds when this mission was made: the starter averaged 2.6–6.5 cm off, the reference PID at most 2.2 cm (9.1 cm at worst).
  const m=missionById('wind');
  for(let seed=1;seed<=12;seed++){
    const pd=attempt(m,m.starter,seed),pid=attempt(m,SOLUTIONS.wind,seed);
    assert.equal(pd.key,'judge.windMean');assert.ok(+pd.params.mean>2.4,`starter, seed ${seed}: ${pd.text}`);
    assert.equal(pid.pass,true,`PID, seed ${seed}: ${pid.text}`);
  }
  // The wind adds to the starter's steady error: over seeds 1–4 it averaged 3.4 cm with wind, 1.5 cm without.
  const avg=wind=>[1,2,3,4].reduce((a,seed)=>a+ +m.judge(simulateRun({design:DEFAULT,robot:m.robot,terrain:m.terrain,program:parseProgram(m.starter),seed,start:m.start,wind})).params.mean,0)/4;
  assert.ok(avg(m.wind)>avg(null)+1);
});

test('lidar_min reads short, because it is the smallest of many noisy beams; lidar_left does not',()=>{
  // A parked rover 0.5 m from the wall. About ten beams near the perpendicular all see about 0.5 m with σ near 9 mm,
  // and the smallest of ten such readings is about 1.5σ low. No controller can remove a sensor's bias.
  const L=simulateRun({design:DEFAULT,terrain:'flat',program:parseProgram('stop()\nwait(5)'),seed:1,start:{x:2,z:-1}}).log;
  const mean=a=>{const v=a.filter(x=>x>0);return v.reduce((s,x)=>s+x,0)/v.length;};
  assert.ok(mean(L.lidarMin)>.475&&mean(L.lidarMin)<.495,`lidar_min ${mean(L.lidarMin)}`);
  assert.ok(Math.abs(mean(L.lidarLeft)-.5)<.005,`lidar_left ${mean(L.lidarLeft)}`);
});

// The sensors and variables a script uses, the way the lab's "what the robot reads" card finds them.
const names=src=>{const sensors=new Set(),variables=new Set();const walk=e=>{if(!e||typeof e!=='object')return;if(Array.isArray(e))return e.forEach(walk);if(e.sensor)sensors.add(e.sensor);if(e.variable)variables.add(e.variable);if(e.type==='let')variables.add(e.name);for(const k of ['a','b','args','l','r','v','w','value','body','other'])walk(e[k]);};walk(parseProgram(src));return {sensors:[...sensors],variables:[...variables]};};
const why=(m,code,seed=1)=>diagnose(m,simulateRun({design:DEFAULT,robot:m.robot,terrain:m.terrain,program:parseProgram(code),seed,start:m.start,wind:m.wind??null}),names(code)).map(d=>d.key);

test('feedback says why a run fell short: a blind script, a missing sensor or sum, and which way it missed',()=>{
  const blind='wheels(4, 4)\nwait(1)\nwheels(5.1, 5)\nwait(10)\nstop()';
  for(const m of MISSIONS)assert.ok(why(m,blind).includes('diag.blind'),m.id);
  assert.ok(why(missionById('wall'),'while time < 5\n  drive(0.1, 0.01*heading)\n  wait(0.05)\nend').includes('diag.needSensor'));
  assert.deepEqual(why(missionById('stop'),missionById('stop').starter),['diag.over'],'the stop starter brakes too late');
  assert.deepEqual(why(missionById('park'),missionById('park').starter),['diag.over'],'the park starter brakes too late');
  assert.deepEqual(why(missionById('turn'),missionById('turn').starter),['diag.encoders','diag.turnShort']);
  assert.deepEqual(why(missionById('wind'),missionById('wind').starter),['diag.noSum','diag.far'],'the wind pushes the starter away from the wall');
  assert.deepEqual(why(missionById('wind'),SOLUTIONS.wind),[],'the reference solution leaves nothing to explain');
});

test('every mission has graded hints in every language, and the code hint leaves blanks',()=>{
  for(const m of MISSIONS)for(const lang of ['en','tr','fr']){
    const x=missionText(m,lang);
    assert.ok(x.lesson&&x.tool&&x.skeleton,`${m.id} ${lang}`);
    assert.ok(x.skeleton.includes('___'),`${m.id} ${lang}: the code hint must leave blanks`);
    if(lang!=='en')assert.notEqual(x.tool,missionText(m,'en').tool,`${m.id} ${lang} is translated`);
  }
});
