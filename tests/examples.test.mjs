import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {simulateRun} from '../dist/drive.mjs';
import {EXAMPLES} from '../dist/examples.mjs';
const designs=[['Kinetic, 24 cm',{...DEFAULT,width:24},'kinetic'],['Kinetic, 44 cm',DEFAULT,'kinetic'],['Kinetic, 60 cm',{...DEFAULT,width:60},'kinetic'],['TurtleBot3',DEFAULT,'turtlebot3']];

test('every example parses and finishes on flat ground without hitting anything, on both robots',()=>{
  for(const [name,code] of Object.entries(EXAMPLES))for(const [label,design,robot] of designs){
    const s=simulateRun({design,robot,terrain:'flat',program:parseProgram(code),seed:1});
    assert.equal(s.success,true,`${name} on ${label}: ${s.message}`);
  }
});

test('"Repeat a square" turns about 90° per corner and closes, whatever the robot or wheel spacing',()=>{
  for(const [label,design,robot] of designs){
    const L=simulateRun({design,robot,terrain:'flat',program:parseProgram(EXAMPLES.square),seed:1}).log,n=L.t.length-1;
    const perCorner=L.trueYaw[n]*180/Math.PI/4,miss=Math.hypot(L.trueX[n],L.trueY[n]);
    assert.ok(Math.abs(perCorner-90)<=3,`${label}: ${perCorner.toFixed(1)}° per corner`);assert.ok(miss<.06,`${label}: ends ${(miss*100).toFixed(1)} cm from the start`);
  }
});
