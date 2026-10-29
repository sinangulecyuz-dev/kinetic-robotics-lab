import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {simulateRun,ROBOTS,TERRAINS} from '../dist/drive.mjs';
import {MISSIONS,missionById} from '../dist/missions.mjs';
// Reference solutions live only here, so the lab never shows students the answer.
const SOLUTIONS={
  stop:'drive(0.3, 0)\nwhile distance > 0.35\n  wait(0.05)\nend\ndrive(0.08, 0)\nwhile distance > 0.21\n  wait(0.05)\nend\nstop()',
  turn:'drive(0, 1)\nwhile heading < 330\n  wait(0.05)\nend\ndrive(0, 0.3)\nwhile heading < 359.5\n  wait(0.05)\nend\nstop()',
  square:'drive(0.15, 0)\nwhile odom_x < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 88\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 178\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_x > 0\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 268\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y > 0\n  wait(0.05)\nend\nstop()'
};
const attempt=(m,code,seed)=>m.judge(simulateRun({design:DEFAULT,robot:m.robot,terrain:m.terrain,program:parseProgram(code),seed}));

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
