import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,PRESETS,centerOfMass,balance,criticalAngle,stepDrive,parseProgram,SENSORS} from '../dist/physics.mjs';
const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
test('mass-weighted center of mass includes chassis, battery, and payload',()=>{
  const c=centerOfMass(DEFAULT);near(c.mass,3.8);near(c.x,0);near(c.y,(1.8*.115+.5*.09+1.5*.38)/3.8);
  const noLoad=centerOfMass({...DEFAULT,mass:0,height:65,offset:20});near(noLoad.mass,2.3);near(noLoad.x,0);
});
test('ramp threshold agrees with independent triangular geometry',()=>{
  const p=DEFAULT,c=centerOfMass(p);const leftEdgeX=-(p.width/200)*(c.z+.22)/.3;
  const expected=Math.atan((c.x-leftEdgeX)/c.y)*180/Math.PI;near(criticalAngle(p),expected);
  assert.ok(balance(p,expected-.01).stable);assert.ok(!balance(p,expected+.01).stable);
});
test('balanced rover holds at 25°, high narrow rover loses support earlier',()=>{
  assert.ok(balance(PRESETS.balanced,25).stable);assert.ok(criticalAngle(PRESETS.tall)<15);
  assert.ok(criticalAngle({...PRESETS.tall,height:10})>criticalAngle(PRESETS.tall));
  assert.ok(criticalAngle({...PRESETS.tall,width:60})>criticalAngle(PRESETS.tall));
});
test('payload offset can put the gravity line outside support even at zero tilt',()=>{
  assert.equal(balance({width:24,mass:3,height:65,offset:-20,target:25},0).stable,false);
  assert.equal(criticalAngle({width:24,mass:3,height:65,offset:-20,target:25}),0);
});
test('wheel kinematics: straight motion, pure rotation, and consistent arcs',()=>{
  const start={x:0,z:0,heading:0};const straight=stepDrive(start,4,4,40,2);near(straight.x,0);near(straight.z,.6);near(straight.heading,0);
  // Left wheel forward, right wheel back: the rover spins clockwise seen from above, so yaw is negative.
  const spin=stepDrive(start,4,-4,40,1);near(spin.x,0);near(spin.z,0);near(spin.heading,-1.5);
  // A faster right wheel turns left. Forward is +z, so the robot's left is +x (up × forward).
  const left=stepDrive(start,2,5,40,1.5);assert.ok(left.heading>0);assert.ok(left.x>0);
  const a=stepDrive(start,2,5,40,2),b=stepDrive(stepDrive(start,2,5,40,1),2,5,40,1);near(a.x,b.x);near(a.z,b.z);near(a.heading,b.heading);
});
test('parser supports nested loops, sensor branches, comments, and line numbers',()=>{
  const nodes=parseProgram('# note\nrepeat 3\n if distance < 0.4\n stop()\n else\n wheels(4, 4)\n end\n wait(0.1)\nend');
  assert.equal(nodes[0].n,3);assert.equal(nodes[0].body[0].type,'if');assert.equal(nodes[0].body[0].body[0].l,0);assert.equal(nodes[0].body[0].other[0].l,4);assert.equal(nodes[0].line,2);
});
test('parser rejects unbounded or unsupported programs and malformed blocks',()=>{
  for(const source of ['','wheels(100, 0)','repeat 999\nstop()\nend','wait(0)','wait(20)','repeat 2\nstop()','end','if distance < 1\nstop()','alert(1)','fetch("https://example.com")',
    'drive(1, 0)','drive(0.2, 7)','drive(0.2)','if speed > 1\nstop()\nend','while time < 2\nwait(1)','while heading < 90\nwait(1)\nelse\nstop()\nend','while heading < 90 * 2\nwait(1)\nend','if heading = 90\nstop()\nend'])assert.throws(()=>parseProgram(source),/Line \d+:/);
});
test('parser reads drive commands and sensor conditions for if and while',()=>{
  const nodes=parseProgram('drive(0.2, -1.5)\nwhile heading < 90\n  wait(0.05)\nend\nif encoder_left >= 1920\n  stop()\nelse\n  drive(0, 0.5)\nend');
  assert.deepEqual(nodes[0],{type:'drive',v:.2,w:-1.5,line:1});
  assert.equal(nodes[1].type,'while');assert.equal(nodes[1].sensor,'heading');assert.equal(nodes[1].op,'<');assert.equal(nodes[1].value,90);assert.equal(nodes[1].body[0].type,'wait');
  assert.equal(nodes[2].type,'if');assert.equal(nodes[2].op,'>=');assert.equal(nodes[2].other[0].type,'drive');
  for(const s of SENSORS)assert.equal(parseProgram(`if ${s} > -1\nstop()\nend`)[0].sensor,s);
  assert.equal(parseProgram('if distance < 0.4\nstop()\nend')[0].value,.4,'the original sensor form still parses');
});
