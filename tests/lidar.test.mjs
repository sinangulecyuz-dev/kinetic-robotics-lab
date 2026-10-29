import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,parseProgram} from '../dist/physics.mjs';
import {DriveSim,simulateRun,lidarMeasure,rangeTo,toScanCsv,ROBOTS,LIDAR,WALL,OBSTACLE} from '../dist/drive.mjs';
const close=(a,b,t,msg='')=>assert.ok(Math.abs(a-b)<=t,`${msg} ${a} != ${b} ± ${t}`);

test('LiDAR beams hit the box and the walls where plane geometry says',()=>{
  for(const robot of ['kinetic','turtlebot3']){
    const s=new DriveSim({design:DEFAULT,robot,noise:false}),M=ROBOTS[robot].lidarMount,boxFace=OBSTACLE.z-OBSTACLE.halfZ;
    close(s.lidar.front,boxFace-M.z,.0011,`${robot} front`);close(s.lidar.left,WALL-M.x,.0011,`${robot} left`);
    close(s.lidar.back,WALL+M.z,.0011,`${robot} back`);close(s.lidar.right,WALL+M.x,.0011,`${robot} right`);
    assert.equal(s.lidar.min,s.lidar.front);assert.equal(s.lidar.minAngle,0);
  }
});

test('beam angles turn with the rover, counterclockwise from its front',()=>{
  const s=new DriveSim({design:DEFAULT,noise:false}),M=ROBOTS.kinetic.lidarMount;s.heading=Math.PI/2;
  close(s.beam(0),WALL-M.z,.0011,'after a left quarter turn the front beam meets the +x wall');
  close(s.beam(90),WALL,.0011,'and the left beam meets the -z wall');
});

test('a corner farther than 3.5 m gives no return, read as Infinity by programs and 0 in logs',()=>{
  // TurtleBot3 LiDAR sits 6.4 cm behind the axle: its 45° beam meets the +x wall first, at 2.5·√2 = 3.54 m.
  const s=new DriveSim({design:DEFAULT,robot:'turtlebot3',noise:false}),M=ROBOTS.turtlebot3.lidarMount;
  assert.ok(Math.min((WALL-M.x)*Math.SQRT2,(WALL-M.z)*Math.SQRT2)>LIDAR.max);
  assert.equal(s.scan[45],Infinity);assert.equal(s.scans[0].ranges[45],0);
});

test('LDS-01 measurement model: minimum range, maximum range, and accuracy',()=>{
  assert.equal(lidarMeasure(.05),0);assert.equal(lidarMeasure(4),Infinity);
  assert.equal(lidarMeasure(1,()=>1),1.018,'1σ at 1 m is 1.75% (±3.5% taken as 2σ), rounded to mm');assert.equal(lidarMeasure(.3,()=>1),.305,'5 mm below 0.5 m');
  const parked=simulateRun({design:DEFAULT,program:parseProgram('wait(5)'),seed:9}),front=parked.scans.slice(1).map(s=>s.ranges[0]),m=front.reduce((a,b)=>a+b,0)/front.length;
  const sd=Math.sqrt(front.reduce((a,b)=>a+(b-m)**2,0)/front.length);close(sd,.0175*m,.35*.0175*m,'beam noise while parked');
});

test('scans arrive five times per second, and a LiDAR-guided stop lands near its threshold',()=>{
  const r=simulateRun({design:DEFAULT,program:parseProgram('drive(0.25, 0)\nwhile lidar_front > 0.6\n  wait(0.05)\nend\nstop()'),seed:3});
  r.scans.slice(1).forEach((s,i,a)=>{if(i)close(s.t-a[i-1].t,1/LIDAR.rate,1e-9,'scan period');});
  const gap=OBSTACLE.z-OBSTACLE.halfZ-(r.z+ROBOTS.kinetic.lidarMount.z);assert.ok(gap<.6&&gap>.45,`true gap ${gap}: late by up to one 0.2 s scan plus braking`);
});

test('the front range sensor now sees the walls too, capped at its 3 m range',()=>{
  close(rangeTo({x:0,z:0,heading:Math.PI}),WALL-.3,1e-9);close(rangeTo({x:0,z:0,heading:Math.PI/4}),3,1e-9);
});

test('scan CSV has a time column and 360 range columns per scan',()=>{
  const r=simulateRun({design:DEFAULT,program:parseProgram('wait(0.5)'),seed:1}),rows=toScanCsv(r.scans).trim().split('\n');
  assert.equal(rows.length,r.scans.length+1);assert.equal(rows[0].split(',').length,LIDAR.beams+1);assert.ok(rows[0].startsWith('t_s,range_0deg_m'));
});
