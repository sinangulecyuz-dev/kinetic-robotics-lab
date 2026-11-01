import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {simulateRun,DriveSim,ROBOTS,TERRAINS,WALL,RANGE} from '../dist/drive.mjs';
import {MISSIONS,missionById,missionsFor} from '../dist/missions.mjs';
// Reference solutions live only here, so the lab never shows students the answer.
const SOLUTIONS={
  stop:'drive(0.3, 0)\nwhile distance > 0.35\n  wait(0.05)\nend\ndrive(0.08, 0)\nwhile distance > 0.21\n  wait(0.05)\nend\nstop()',
  turn:'drive(0, 1)\nwhile heading < 330\n  wait(0.05)\nend\ndrive(0, 0.3)\nwhile heading < 359.5\n  wait(0.05)\nend\nstop()',
  // P on speed: fast while far, slower as the gap closes.
  park:'while time < 15\n  drive(1*(distance - 0.5), 0)\n  wait(0.05)\nend\nstop()',
  // P on the perpendicular distance plus P on the angle to the wall, both from the LiDAR, so gyro drift does not bias it.
  wall:'while odom_x < 3.8\n  drive(0.2, 2*(lidar_min - 0.5) + 0.02*(lidar_min_angle - 90))\n  wait(0.05)\nend\nstop()',
  square:'drive(0.15, 0)\nwhile odom_x < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 88\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 178\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_x > 0\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 268\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y > 0\n  wait(0.05)\nend\nstop()'
};
const attempt=(m,code,seed)=>m.judge(simulateRun({design:DEFAULT,robot:m.robot,terrain:m.terrain,program:parseProgram(code),seed,start:m.start}));

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
  for(const m of MISSIONS)assert.ok([2,3].includes(m.experiment),m.id);
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
