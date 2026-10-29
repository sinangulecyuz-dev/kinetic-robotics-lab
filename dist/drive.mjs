// Planar rover dynamics on selectable terrain, with simulated sensors. SI units throughout.
// The Kinetic rover uses typical datasheet values, not measurements of a physical robot.
// The TurtleBot3 preset uses datasheet values plus two parameters fitted to one robot's lab measurements.
import {centerOfMass,WHEEL_RADIUS} from './physics.mjs';

export const DT=1e-4,CONTACT_STEPS=10,CONTROL_STEPS=100,RANGE_STEPS=500,MAX_TIME=30,SETTLE_TIME=2,GRAVITY=9.81;
// 12 V gear motor referred to the wheel: 1.36 N·m stall torque, 34.6 rad/s free speed, gearbox included.
export const MOTOR={volts:12,kt:.25,ke:.347,resistance:2.2,inertia:1.2e-3,coulomb:.03,viscous:1e-3};
// Wheel speed loop, as motor firmware would run it: feedforward plus PI on encoder speed, 100 Hz.
export const CONTROL={kp:1,ki:1.5,filter:.01};
export const ENCODER_CPR=1920;
// MEMS IMU (MPU-6050 class): ±250 °/s and ±2 g ranges, 16-bit, residual bias after a basic calibration.
export const IMU={rate:100,gyroNoise:[8.7e-4,8.7e-4,8.7e-4],gyroBias:3.5e-3,accelNoise:[.03,.03,.03],accelBias:.04,accelOffset:[0,0,0],gyroLsb:250/32768*Math.PI/180,accelLsb:2*GRAVITY/32768,mount:{x:0,y:.17,z:0}};
export const RANGE={max:3,noise:.003,relative:.01};
export const AXLE_Z=.08,CASTER={x:0,z:-.22,radius:.031,trail:.03},PEAK_SLIP=.05;
export const TERRAINS={
  flat:{label:'Flat',surface:'Smooth concrete',muPeak:.9,muSlide:.75,crr:.015,casterCrr:.03,bumps:false},
  rough:{label:'Rough',surface:'Gravel with bumps',muPeak:.65,muSlide:.55,crr:.05,casterCrr:.09,bumps:true},
  slippery:{label:'Slippery',surface:'Ice-like surface',muPeak:.15,muSlide:.1,crr:.01,casterCrr:.015,bumps:false}
};
// 2D LiDAR, LDS-01 datasheet: 360 beams at 1°, 5 scans/s, 0.12–3.5 m, accuracy ±10 mm below 0.5 m and ±3.5% beyond (taken as 2σ).
// Readings are in mm. A beam closer than min reads 0; a beam with nothing within max has no return.
export const LIDAR={rate:5,beams:360,min:.12,max:3.5};
// Complementary filter on heading, run at 100 Hz: gyro for quick changes, encoders over the long run.
// Crossover time constant tau = alpha·T/(1 − alpha). Both sensors err slowly here (wheel slip and caster drag, gyro bias),
// so a slow crossover works best: alpha = 0.999 (tau ≈ 10 s) beat the textbook 0.98 (tau ≈ 0.5 s) on every test in the README.
// Programs can change it with filter(alpha).
export const FUSION_ALPHA=.999;
export const WALL=2.5;
// TurtleBot3 parameters fitted to the lab data in tests/fixtures/turtlebot3-lab.json (see README).
export const TB3_FIT={battery:10.93,ballFriction:.261};
// Local x is the robot's left, z is forward, y is up. Wheels sit at ±track/2 on the axle line axleZ.
export const ROBOTS={
  kinetic:{
    label:'Kinetic rover',wheelRadius:WHEEL_RADIUS,axleZ:AXLE_Z,motor:MOTOR,control:CONTROL,encoderCpr:ENCODER_CPR,imu:IMU,
    maxWheel:10,limits:null,rangeAhead:.3,lidarMount:{x:0,y:.205,z:.05},casters:[{...CASTER,swivel:true}],casterCrr:t=>t.casterCrr,
    body:p=>({com:centerOfMass(p),iz:yawInertia(p),track:p.width/100}),
    footprint:track=>({z:0,radius:Math.hypot(track/2+.03,.25)})
  },
  // Dynamixel XM430-W210 (3.0 N·m stall at 2.3 A and 77 rpm no-load at 12 V) referred to the wheel, 4096-count encoder,
  // two ball casters, firmware limits 0.26 m/s and 1.82 rad/s. Mass and footprint from the ROBOTIS datasheet, centre of mass estimated.
  turtlebot3:{
    label:'TurtleBot3 Waffle Pi',wheelRadius:.033,axleZ:0,
    motor:{volts:TB3_FIT.battery,kt:3/2.3,ke:12/(77*2*Math.PI/60),resistance:12/2.3,inertia:2e-3,coulomb:.02,viscous:1e-3},
    control:{kp:.3,ki:1,filter:.01},encoderCpr:4096,maxWheel:Infinity,limits:{v:.26,w:1.82},rangeAhead:.08,lidarMount:{x:0,y:.155,z:-.064},
    imu:{rate:100,gyroNoise:[.003,.003,.003],gyroBias:5e-4,accelNoise:[.04,.04,.2],accelBias:.01,accelOffset:[-.16,0,.09],gyroLsb:IMU.gyroLsb,accelLsb:IMU.accelLsb,mount:{x:0,y:.06,z:-.064}},
    casters:[{x:.064,z:-.177,radius:.01,swivel:false},{x:-.064,z:-.177,radius:.01,swivel:false}],
    // Ball casters drag like sliding friction in their sockets, but never more than the ground can hold.
    casterCrr:t=>Math.min(TB3_FIT.ballFriction,t.muSlide),
    body:()=>({com:{mass:1.8,x:0,y:.065,z:-.064},iz:1.8*(.281*.281+.306*.306)/12,track:.287}),
    footprint:()=>({z:-.064,radius:Math.hypot(.153,.141)})
  }
};
export const OBSTACLE={x:0,z:1.3,halfX:.28,halfZ:.16};
export const CHANNELS=['t','cmdL','cmdR','encL','encR','speedL','speedR','currentL','currentR','voltsL','voltsR','ax','ay','az','gx','gy','gz','range','odomX','odomY','odomYaw','gyroYaw','trueX','trueY','trueYaw','trueSpeed','slipL','slipR','wheelL','wheelR','desX','desY','desYaw','lidarFront','lidarLeft','lidarBack','lidarRight','lidarMin','fusedX','fusedY','fusedYaw'];
const ARENA=2.3;

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);return [a[0]/l,a[1]/l,a[2]/l];};
function random(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(r){let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r());}

// Deterministic bumps up to about ±2 cm, so every run on the rough floor meets the same terrain.
export function terrainHeight(terrain,x,z){
  if(!TERRAINS[terrain]?.bumps)return 0;const k=2*Math.PI;
  return .009*Math.sin(k*x/.9+.7)*Math.sin(k*z/1.1+1.9)+.006*Math.sin(k*(.8*x+.6*z)/.45+2.3)+.0025*Math.sin(k*(-.5*x+.87*z)/.3+.4)+.0015*Math.sin(k*x/.23+1.1)*Math.cos(k*z/.27+.3);
}
// Friction coefficient versus slip speed: a Pacejka-style curve that peaks at PEAK_SLIP and settles at the sliding value.
export function frictionCurve(t){
  const C=2-2/Math.PI*Math.asin(t.muSlide/t.muPeak),B=Math.tan(Math.PI/(2*C))/PEAK_SLIP;
  return {B,C,mu:s=>t.muPeak*Math.sin(C*Math.atan(B*s)),stiffness:t.muPeak*C*B};
}
export function yawInertia(p){
  const com=centerOfMass(p),size=.115+p.mass*.017;
  return [{m:1.8,x:0,z:-.03,w:p.width/100*.9,l:.47},{m:.5,x:0,z:-.15,w:.17,l:.135},{m:p.mass,x:p.offset/100,z:-.06,w:size,l:size}]
    .reduce((s,c)=>s+c.m*((c.w*c.w+c.l*c.l)/12+(c.x-com.x)**2+(c.z-com.z)**2),0);
}
// Static support with load transfer. e = gravity minus acceleration in body axes (forward, left, normal).
// tri = left wheel, right wheel, and the casters' midpoint; casters share their load equally, which keeps moment balance.
export function supportLoads(tri,polygon,e,com){
  const [A,B,C]=tri,point={x:com.x-com.y*e.l/e.n,z:com.z-com.y*e.f/e.n},det=(B.z-C.z)*(A.x-C.x)+(C.x-B.x)*(A.z-C.z);
  const a=((B.z-C.z)*(point.x-C.x)+(C.x-B.x)*(point.z-C.z))/det,b=((C.z-A.z)*(point.x-C.x)+(A.x-C.x)*(point.z-C.z))/det;
  const fractions=[a,b,1-a-b],total=-com.mass*e.n;
  const margin=Math.min(...polygon.map((s,i)=>{const t=polygon[(i+1)%polygon.length],dx=t.x-s.x,dz=t.z-s.z;return (dx*(point.z-s.z)-dz*(point.x-s.x))/Math.hypot(dx,dz);}));
  return {fractions,loads:fractions.map(f=>f*total),total,point,margin};
}
// The Kinetic rover's three-point support (left wheel, right wheel, caster), kept for tests and callers that hold a design.
export function contactLoads(p,e,com=centerOfMass(p)){
  const W=p.width/100,tri=[{x:W/2,z:AXLE_Z},{x:-W/2,z:AXLE_Z},{x:CASTER.x,z:CASTER.z}];
  return supportLoads(tri,tri,e,com);
}
// Distance along a horizontal ray to the first hit: the obstacle box (slab test) or the arena walls at ±WALL.
export function castRay(ox,oz,dx,dz,obstacle=OBSTACLE){
  let best=Infinity;
  for(const [o,d] of [[ox,dx],[oz,dz]])if(Math.abs(d)>1e-12)best=Math.min(best,((d>0?WALL:-WALL)-o)/d);
  let near=0,far=Infinity;
  for(const [o,d,min,max] of [[ox,dx,obstacle.x-obstacle.halfX,obstacle.x+obstacle.halfX],[oz,dz,obstacle.z-obstacle.halfZ,obstacle.z+obstacle.halfZ]]){
    if(Math.abs(d)<1e-12){if(o<min||o>max){near=Infinity;break;}continue;}
    const a=(min-o)/d,b=(max-o)/d;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
  }
  return far>=near&&near<best?Math.max(0,near):best;
}
// Front range sensor: a horizontal ray from `ahead` meters in front of the body origin, capped at its 3 m range.
export function rangeTo(pose,obstacle=OBSTACLE,ahead=.3){
  const dx=Math.sin(pose.heading),dz=Math.cos(pose.heading);
  return Math.min(RANGE.max,castRay(pose.x+dx*ahead,pose.z+dz*ahead,dx,dz,obstacle));
}
// One LiDAR return for a true distance d: 0 when too close, Infinity with no return, else noisy millimetres.
export function lidarMeasure(d,draw=()=>0,lidar=LIDAR){
  if(d<lidar.min)return 0;if(d>lidar.max)return Infinity;
  return Math.round((d+draw()*(d<.5?.005:.0175*d))*1000)/1000;
}

export class DriveSim{
  constructor({design,terrain='flat',robot='kinetic',program=[],seed=1,noise=true}){
    this.design={...design};this.terrain=TERRAINS[terrain]?terrain:'flat';this.surface=TERRAINS[this.terrain];this.curve=frictionCurve(this.surface);
    this.robot=ROBOTS[robot]?robot:'kinetic';const spec=this.spec=ROBOTS[this.robot],body=spec.body(design);
    this.com=body.com;this.mass=this.com.mass;this.iz=body.iz;this.width=body.track;this.R=spec.wheelRadius;this.axleZ=spec.axleZ;this.motor=spec.motor;
    this.wheelContacts=[{x:this.width/2,z:this.axleZ},{x:-this.width/2,z:this.axleZ}];this.casters=spec.casters;
    const mid=this.casters.length===1?this.casters[0]:{x:this.casters.reduce((s,c)=>s+c.x,0)/this.casters.length,z:this.casters.reduce((s,c)=>s+c.z,0)/this.casters.length};
    this.tri=[...this.wheelContacts,{x:mid.x,z:mid.z}];this.polygon=this.casters.length===1?this.tri:[...this.wheelContacts,...[...this.casters].sort((a,b)=>a.x-b.x)];
    this.foot=spec.footprint(this.width);
    this.x=0;this.z=0;this.heading=0;this.u=0;this.v=0;this.w=0;this.acc={f:0,l:0,n:0};this.transfer={f:0,l:0};
    this.wheels=[0,1].map(()=>({w:0,theta:0,ref:0,volts:0,current:0,integral:0,count:0,speed:0,slip:0}));
    this.caster={spin:0,swivel:0};
    this.steps=0;this.budget=0;this.status='running';this.success=false;this.message='';
    this.queue=[...program];this.waitSteps=0;this.instructions=0;this.sinceAdvance=0;this.line=program[0]?.line||1;this.phase='run';this.settleSteps=0;this.quietSteps=0;
    this.seed=seed;this.noise=noise;this.rand=random(seed);this.lidarRand=random(seed^0x9E3779B9);
    const imu=spec.imu,bias=(sd,offset)=>[0,1,2].map(i=>(noise?gauss(this.rand)*sd:0)+offset[i]);this.bias={gyro:bias(imu.gyroBias,[0,0,0]),accel:bias(imu.accelBias,imu.accelOffset)};
    this.odom={x:0,y:0,yaw:0};this.desired={x:0,y:0,yaw:0,v:0,w:0};this.fusion={alpha:FUSION_ALPHA,x:0,y:0,yaw:0};this.gyroYaw=0;this.gyroZ=0;this.imuPoints=[];this.imuFrames=[];this.heightPrev=null;
    this.log=Object.fromEntries(CHANNELS.map(c=>[c,[]]));this.path=[];this.odomPath=[];this.fusedPath=[];
    this.updateContacts();this.start=this.axle();this.range=this.measureRange();
    this.scanBuffer=[];this.scans=[];this.publishScan(Array.from({length:LIDAR.beams},(_,i)=>this.beam(i)));
  }
  get time(){return this.steps*DT;}
  get speed(){return Math.hypot(this.u+this.w*this.com.x,this.v+this.w*(this.axleZ-this.com.z));}
  get maxSlip(){return Math.max(...this.wheels.map(wh=>Math.abs(wh.slip)));}
  axle(){return {x:this.x+this.axleZ*Math.sin(this.heading),z:this.z+this.axleZ*Math.cos(this.heading)};}
  advance(seconds){this.budget+=seconds;while(this.budget>=DT/2&&this.status==='running'){this.step();this.budget-=DT;}}
  run(){while(this.status==='running')this.step();return this;}
  // message is English; key and params let the interface show it in the student's language.
  finish(success,message,key,params={}){if(this.status!=='running')return;this.status='done';this.success=success;this.message=message;this.messageKey=key;this.messageParams=params;this.wheels.forEach(wh=>{wh.ref=0;wh.volts=0;});}
  setTargets(l,r){this.wheels[0].ref=l;this.wheels[1].ref=r;}
  // The commanded motion, before any limit: what Lab 1 calls the desired trajectory.
  command(v,w){this.desired.v=v;this.desired.w=w;}
  step(){
    if(this.status!=='running')return;
    this.interpret();if(this.status!=='running')return;
    if(this.steps%CONTACT_STEPS===0){this.updateContacts();if(this.status!=='running')return;}
    if(this.steps%CONTROL_STEPS===0)this.sample();
    this.dynamics();this.steps++;
    const D=this.desired,mid=D.yaw+D.w*DT/2;D.x+=D.v*DT*Math.cos(mid);D.y+=D.v*DT*Math.sin(mid);D.yaw+=D.w*DT;
    if(this.waitSteps>0){this.waitSteps--;this.sinceAdvance=0;}
    const fx=this.x+this.foot.z*Math.sin(this.heading),fz=this.z+this.foot.z*Math.cos(this.heading),radius=this.foot.radius;
    if(Math.abs(fx-OBSTACLE.x)<OBSTACLE.halfX+radius&&Math.abs(fz-OBSTACLE.z)<OBSTACLE.halfZ+radius)return this.finish(false,'Stopped: rover reached the obstacle.','sim.obstacle');
    if(Math.abs(this.x)>ARENA||Math.abs(this.z)>ARENA)return this.finish(false,'Stopped at the edge of the test area.','sim.edge');
    if(this.time>=MAX_TIME-1e-9)return this.finish(false,'Stopped: 30-second experiment limit.','sim.timeLimit');
    if(this.phase==='settle'){
      // After the last instruction the controller brakes to zero; the run ends once the rover is still.
      const [L,R]=this.wheels,quiet=Math.hypot(this.u,this.v)<.003&&Math.abs(this.w)<.01&&Math.abs(L.w)<.05&&Math.abs(R.w)<.05;
      this.quietSteps=quiet?this.quietSteps+1:0;
      if(this.quietSteps>=.2/DT||++this.settleSteps>=SETTLE_TIME/DT)this.finish(true,'Program complete. Explore your results.','sim.complete');
    }
  }
  interpret(){
    while(this.phase==='run'&&this.waitSteps===0){
      if(++this.sinceAdvance>500||++this.instructions>10000)return this.finish(false,'Stopped: instruction limit reached. Add waits to your loops.','sim.instructions');
      const n=this.queue.shift();
      if(!n){this.phase='settle';this.setTargets(0,0);this.command(0,0);return;}
      this.line=n.line;
      if(n.type==='wheels'){this.setTargets(n.l,n.r);this.command(this.R*(n.l+n.r)/2,this.R*(n.r-n.l)/this.width);}
      else if(n.type==='drive'){
        // Unicycle command to wheel targets (v ± w·W/2)/R. Firmware limits clip v and w first, where the robot has them.
        // If a wheel would pass maxWheel, both slow together so the curve keeps its radius.
        const lim=this.spec.limits,v=lim?Math.max(-lim.v,Math.min(lim.v,n.v)):n.v,w=lim?Math.max(-lim.w,Math.min(lim.w,n.w)):n.w;
        const half=this.width/2,l=(v-w*half)/this.R,r=(v+w*half)/this.R,k=Math.min(1,this.spec.maxWheel/Math.max(Math.abs(l),Math.abs(r),1e-9));
        this.setTargets(l*k,r*k);this.command(n.v,n.w);
      }
      else if(n.type==='filter')this.fusion.alpha=n.alpha;
      else if(n.type==='wait')this.waitSteps=Math.max(1,Math.round(n.time/DT));
      else if(n.type==='repeat')this.queue.unshift(...Array.from({length:n.n},()=>n.body).flat());
      else if(n.type==='if')this.queue.unshift(...(this.test(n)?n.body:n.other));
      else if(n.type==='while'&&this.test(n))this.queue.unshift(...n.body,n);
    }
  }
  // What a program sees: the latest sensor samples, never the simulator's ground truth.
  sensor(name){
    const deg=180/Math.PI;
    return {distance:this.range,heading:this.gyroYaw*deg,odom_heading:this.odom.yaw*deg,gyro_z:this.gyroZ,encoder_left:this.wheels[0].count,encoder_right:this.wheels[1].count,odom_x:this.odom.x,odom_y:this.odom.y,time:this.time,lidar_front:this.lidar.front,lidar_left:this.lidar.left,lidar_back:this.lidar.back,lidar_right:this.lidar.right,lidar_min:this.lidar.min,lidar_min_angle:this.lidar.minAngle,fused_heading:this.fusion.yaw*deg,fused_x:this.fusion.x,fused_y:this.fusion.y}[name];
  }
  test(n){const v=this.sensor(n.sensor);return n.op==='<'?v<n.value:n.op==='>'?v>n.value:n.op==='<='?v<=n.value:v>=n.value;}
  // 1 kHz: support plane from the terrain under the wheels and casters, gravity components, and contact loads.
  updateContacts(){
    const s=Math.sin(this.heading),c=Math.cos(this.heading),at=({x:lx,z:lz})=>{const px=this.x+lx*c+lz*s,pz=this.z-lx*s+lz*c;return [px,terrainHeight(this.terrain,px,pz),pz];};
    const [L,R]=this.wheelContacts.map(at),cs=this.casters.map(at),C=cs.length===1?cs[0]:[0,1,2].map(i=>cs.reduce((t,p)=>t+p[i],0)/cs.length);
    const n=unit(cross(sub(R,C),sub(L,C))),ahead=[s,0,c],d=dot(ahead,n),f=unit([s-d*n[0],-d*n[1],c-d*n[2]]),l=cross(n,f);
    const y=C[1]-(n[0]*(this.x-C[0])+n[2]*(this.z-C[2]))/n[1];
    this.frame={origin:[this.x,y,this.z],f,l,n};this.gravity={f:-GRAVITY*f[1],l:-GRAVITY*l[1],n:-GRAVITY*n[1]};
    const height=y+this.com.x*l[1]+this.com.y*n[1]+this.com.z*f[1],h=DT*CONTACT_STEPS,prev=this.heightPrev;
    if(prev){const vy=(height-prev.y)/h;if(prev.vy!==null)this.acc.n+=((vy-prev.vy)/h-this.acc.n)*h/(.005+h);this.heightPrev={y:height,vy};}else this.heightPrev={y:height,vy:null};
    // Load transfer follows acceleration with a 20 ms lag, standing in for tire and chassis compliance.
    // Without it, traction and load would form an instantaneous loop that diverges for tall rovers.
    const lag=h/(.02+h);this.transfer.f+=(this.acc.f-this.transfer.f)*lag;this.transfer.l+=(this.acc.l-this.transfer.l)*lag;
    const support=supportLoads(this.tri,this.polygon,{f:this.gravity.f-this.transfer.f,l:this.gravity.l-this.transfer.l,n:this.gravity.n-this.acc.n},this.com);
    const [left,right,caster]=support.fractions;
    this.loads=this.casters.length===1?support.loads:[support.loads[0],support.loads[1],...this.casters.map(()=>support.loads[2]/this.casters.length)];
    this.margin=support.margin;this.point=support.point;
    const casterName=this.casters.length===1?'the caster lifted':'the casters lifted';
    if(support.total<=0)this.finish(false,'Stopped: the rover left the ground. Jumps are not simulated.','sim.airborne');
    else if(Math.min(left,right,caster)<0){const key=caster<Math.min(left,right)?(this.casters.length===1?'sim.tipCaster':'sim.tipCasters'):left<0&&right<0?'sim.tipBack':left<right?'sim.tipLeft':'sim.tipRight';
      this.finish(false,`Stopped: ${caster<Math.min(left,right)?`${casterName}, so the rover began to tip forward`:left<0&&right<0?'both drive wheels lifted, so the rover began to tip backward':`the ${left<right?'left':'right'} wheel lifted, so the rover began to tip sideways`}. Dynamic tipping is not simulated.`,key);}
  }
  // 10 kHz: tire forces from combined slip, motor torque, caster drag, then semi-implicit Euler.
  dynamics(){
    const {u,v,w,com,curve,surface:T,mass:m,motor:M,R:radius}=this,N=this.loads;
    let Ff=m*this.gravity.f,Fl=m*this.gravity.l,Mz=0;
    for(let i=0;i<2;i++){
      const wh=this.wheels[i],a=this.wheelContacts[i].z-com.z,b=this.wheelContacts[i].x-com.x;
      const sx=radius*wh.w-(u-w*b),sy=-(v+w*a),s=Math.hypot(sx,sy),k=N[i]*(s>1e-9?curve.mu(s)/s:curve.stiffness),fx=k*sx,fy=k*sy;
      Ff+=fx;Fl+=fy;Mz+=a*fy-b*fx;wh.slip=sx;
      wh.current=(wh.volts-M.ke*wh.w)/M.resistance;
      const torque=M.kt*wh.current-M.coulomb*Math.tanh(wh.w/.05)-M.viscous*wh.w-T.crr*N[i]*radius*Math.tanh(wh.w*radius/.01)-radius*fx;
      wh.w+=torque/M.inertia*DT;wh.theta+=wh.w*DT;
    }
    const crr=this.spec.casterCrr(T);
    this.casters.forEach((c,j)=>{
      const a=c.z-com.z,b=c.x-com.x,cf=u-w*b,cl=v+w*a,cs=Math.hypot(cf,cl),k=-crr*N[2+j]/Math.sqrt(cs*cs+2.5e-5);
      Ff+=k*cf;Fl+=k*cl;Mz+=a*k*cl-b*k*cf;
      if(j)return;
      if(c.swivel&&cs>1e-3){const d=Math.atan2(cl,cf)-this.caster.swivel;this.caster.swivel+=Math.atan2(Math.sin(d),Math.cos(d))*Math.min(1,cs*DT/c.trail);}
      this.caster.spin+=(cf*Math.cos(this.caster.swivel)+cl*Math.sin(this.caster.swivel))/c.radius*DT;
    });
    this.acc.f=Ff/m;this.acc.l=Fl/m;
    this.u+=(Ff/m+w*v)*DT;this.v+=(Fl/m-w*u)*DT;this.w+=Mz/this.iz*DT;
    const forward=this.u+this.w*com.x,lateral=this.v-this.w*com.z,sh=Math.sin(this.heading),ch=Math.cos(this.heading);
    this.x+=(forward*sh+lateral*ch)*DT;this.z+=(forward*ch-lateral*sh)*DT;this.heading+=this.w*DT;
  }
  // A rotating LiDAR: each 10 ms sample adds the next slice of beams from the pose at that moment, so a moving rover sees a slightly smeared scan.
  beam(i){
    const M=this.spec.lidarMount,s=Math.sin(this.heading),c=Math.cos(this.heading),ox=this.x+M.x*c+M.z*s,oz=this.z-M.x*s+M.z*c,a=this.heading+i*2*Math.PI/LIDAR.beams;
    return lidarMeasure(castRay(ox,oz,Math.sin(a),Math.cos(a)),this.noise?()=>gauss(this.lidarRand):()=>0);
  }
  publishScan(ranges){
    const finite=ranges.map((r,i)=>[r,i]).filter(([r])=>r<Infinity),[min,at]=finite.length?finite.reduce((b,x)=>x[0]<b[0]?x:b):[Infinity,0],q=LIDAR.beams/4;
    this.scan=ranges;this.lidar={front:ranges[0],left:ranges[q],back:ranges[2*q],right:ranges[3*q],min,minAngle:at*360/LIDAR.beams};
    this.scans.push({t:this.time,ranges:ranges.map(r=>r<Infinity?r:0)});
  }
  measureRange(){
    const truth=rangeTo(this,OBSTACLE,this.spec.rangeAhead);if(truth>=RANGE.max)return RANGE.max;
    return Math.max(0,Math.min(RANGE.max,truth+(this.noise?gauss(this.rand)*(RANGE.noise+RANGE.relative*truth):0)));
  }
  // 100 Hz: encoders, firmware speed loop, odometry, IMU, range sensor, and the log.
  sample(){
    const T=CONTROL_STEPS*DT,tick=2*Math.PI/this.spec.encoderCpr,ctl=this.spec.control,M=this.motor,imu=this.spec.imu;
    const travel=this.wheels.map(wh=>{
      const count=Math.floor(wh.theta/tick),delta=count-wh.count;wh.count=count;wh.speed+=(delta*tick/T-wh.speed)*T/(ctl.filter+T);
      const e=wh.ref-wh.speed,integral=wh.integral+e*T;let volts=M.ke*wh.ref+ctl.kp*e+ctl.ki*integral;
      if(Math.abs(volts)<=M.volts)wh.integral=integral;else volts=Math.sign(volts)*M.volts;wh.volts=volts;
      return delta*tick*this.R;
    });
    // Dead reckoning from encoder counts alone: right minus left gives the yaw change (positive turns left).
    const ds=(travel[0]+travel[1])/2,dyaw=(travel[1]-travel[0])/this.width,mid=this.odom.yaw+dyaw/2;
    this.odom.x+=ds*Math.cos(mid);this.odom.y+=ds*Math.sin(mid);this.odom.yaw+=dyaw;
    // IMU at its mount point: acceleration from the point's own 3D trajectory, rates from the change of the body axes.
    const F=this.frame,P=imu.mount;
    this.imuPoints.push([0,1,2].map(i=>F.origin[i]+P.x*F.l[i]+P.y*F.n[i]+P.z*F.f[i]));this.imuFrames.push(F);
    if(this.imuPoints.length>3)this.imuPoints.shift();if(this.imuFrames.length>2)this.imuFrames.shift();
    let accel=[0,0,GRAVITY],gyro=[0,0,0];
    if(this.imuPoints.length===3){const [p0,p1,p2]=this.imuPoints,G=this.imuFrames[0],a=[0,1,2].map(i=>(p2[i]-2*p1[i]+p0[i])/(T*T));a[1]+=GRAVITY;accel=[dot(a,G.f),dot(a,G.l),dot(a,G.n)];}
    if(this.imuFrames.length===2){const [A,B]=this.imuFrames;gyro=[(dot(A.n,B.l)-dot(A.l,B.n))/(2*T),(dot(A.f,B.n)-dot(A.n,B.f))/(2*T),(dot(A.l,B.f)-dot(A.f,B.l))/(2*T)];}
    const read=(v,bias,sd,lsb)=>Math.round((v+bias+(this.noise?gauss(this.rand)*sd:0))/lsb)*lsb;
    accel=accel.map((v,i)=>read(v,this.bias.accel[i],imu.accelNoise[i],imu.accelLsb));gyro=gyro.map((v,i)=>read(v,this.bias.gyro[i],imu.gyroNoise[i],imu.gyroLsb));
    this.gyroYaw+=gyro[2]*T;this.gyroZ=gyro[2];
    // Filtered odometry: encoder distance along the fused heading.
    const fu=this.fusion,before=fu.yaw;fu.yaw=fu.alpha*(fu.yaw+gyro[2]*T)+(1-fu.alpha)*this.odom.yaw;const fm=(before+fu.yaw)/2;fu.x+=ds*Math.cos(fm);fu.y+=ds*Math.sin(fm);
    if(this.steps%RANGE_STEPS===0)this.range=this.measureRange();
    for(let k=0;k<LIDAR.beams*LIDAR.rate*T;k++){this.scanBuffer.push(this.beam(this.scanBuffer.length));if(this.scanBuffer.length===LIDAR.beams){this.publishScan(this.scanBuffer);this.scanBuffer=[];}}
    const axle=this.axle(),[L,R]=this.wheels,trueX=axle.z-this.start.z,trueY=axle.x-this.start.x;
    const row=[this.time,L.ref,R.ref,L.count,R.count,L.speed,R.speed,L.current,R.current,L.volts,R.volts,...accel,...gyro,this.range,this.odom.x,this.odom.y,this.odom.yaw,this.gyroYaw,trueX,trueY,this.heading,this.speed,L.slip,R.slip,L.w,R.w,this.desired.x,this.desired.y,this.desired.yaw,...['front','left','back','right','min'].map(k=>this.lidar[k]<Infinity&&this.lidar[k]>=LIDAR.min?this.lidar[k]:0),this.fusion.x,this.fusion.y,this.fusion.yaw];
    CHANNELS.forEach((c,i)=>this.log[c].push(row[i]));
    const track=(list,x,z)=>{const last=list.at(-1);if(!last||Math.hypot(x-last.x,z-last.z)>.018)list.push({x,z});};
    track(this.path,axle.x,axle.z);track(this.odomPath,this.start.x+this.odom.y,this.start.z+this.odom.x);track(this.fusedPath,this.start.x+this.fusion.y,this.start.z+this.fusion.x);
  }
  summary(){
    const n=this.log.t.length-1,L=this.log;if(n<0)return {odomError:0,headingError:0,distance:0};
    return {odomError:Math.hypot(L.odomX[n]-L.trueX[n],L.odomY[n]-L.trueY[n]),headingError:(L.odomYaw[n]-L.trueYaw[n])*180/Math.PI,distance:this.path.reduce((s,p,i,a)=>i?s+Math.hypot(p.x-a[i-1].x,p.z-a[i-1].z):0,0)};
  }
}
export function simulateRun(options){return new DriveSim(options).run();}
// Column names carry units and mark simulator-only values as true_*. MATLAB: T = readtable('file.csv').
const CSV_NAMES={t:'t_s',cmdL:'cmd_left_rad_s',cmdR:'cmd_right_rad_s',encL:'encoder_left_counts',encR:'encoder_right_counts',speedL:'speed_left_rad_s',speedR:'speed_right_rad_s',currentL:'current_left_A',currentR:'current_right_A',voltsL:'voltage_left_V',voltsR:'voltage_right_V',ax:'accel_x_m_s2',ay:'accel_y_m_s2',az:'accel_z_m_s2',gx:'gyro_x_rad_s',gy:'gyro_y_rad_s',gz:'gyro_z_rad_s',range:'range_m',odomX:'odom_x_m',odomY:'odom_y_m',odomYaw:'odom_yaw_rad',gyroYaw:'gyro_yaw_rad',trueX:'true_x_m',trueY:'true_y_m',trueYaw:'true_yaw_rad',trueSpeed:'true_speed_m_s',slipL:'true_slip_left_m_s',slipR:'true_slip_right_m_s',wheelL:'true_wheel_left_rad_s',wheelR:'true_wheel_right_rad_s',desX:'desired_x_m',desY:'desired_y_m',desYaw:'desired_yaw_rad',lidarFront:'lidar_front_m',lidarLeft:'lidar_left_m',lidarBack:'lidar_back_m',lidarRight:'lidar_right_m',lidarMin:'lidar_min_m',fusedX:'fused_x_m',fusedY:'fused_y_m',fusedYaw:'fused_yaw_rad'};
export function toCsv(log){
  return [CHANNELS.map(c=>CSV_NAMES[c]).join(','),...log.t.map((_,i)=>CHANNELS.map(c=>{const v=log[c][i];return Number.isInteger(v)?v:+v.toFixed(6);}).join(','))].join('\n')+'\n';
}
// One row per LiDAR scan: time, then the 360 ranges from 0° (forward) counterclockwise. 0 means no valid return, as on the LDS-01.
export function toScanCsv(scans){
  return [['t_s',...Array.from({length:LIDAR.beams},(_,i)=>`range_${i}deg_m`)].join(','),...scans.map(s=>[+s.t.toFixed(4),...s.ranges].join(','))].join('\n')+'\n';
}
