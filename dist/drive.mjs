// Planar rover dynamics on selectable terrain, with simulated sensors. SI units throughout.
// Parameters are typical datasheet values for a small gear-motor rover, not measurements of a physical robot.
import {centerOfMass,WHEEL_RADIUS} from './physics.mjs';

export const DT=1e-4,CONTACT_STEPS=10,CONTROL_STEPS=100,RANGE_STEPS=500,MAX_TIME=30,SETTLE_TIME=2,GRAVITY=9.81;
// 12 V gear motor referred to the wheel: 1.36 N·m stall torque, 34.6 rad/s free speed, gearbox included.
export const MOTOR={volts:12,kt:.25,ke:.347,resistance:2.2,inertia:1.2e-3,coulomb:.03,viscous:1e-3};
// Wheel speed loop, as motor firmware would run it: feedforward plus PI on encoder speed, 100 Hz.
export const CONTROL={kp:1,ki:1.5,filter:.01};
export const ENCODER_CPR=1920;
// MEMS IMU (MPU-6050 class): ±250 °/s and ±2 g ranges, 16-bit, residual bias after a basic calibration.
export const IMU={rate:100,gyroNoise:8.7e-4,gyroBias:3.5e-3,accelNoise:.03,accelBias:.04,gyroLsb:250/32768*Math.PI/180,accelLsb:2*GRAVITY/32768,mount:{x:0,y:.17,z:0}};
export const RANGE={max:3,noise:.003,relative:.01};
export const AXLE_Z=.08,CASTER={x:0,z:-.22,radius:.031,trail:.03},PEAK_SLIP=.05;
export const TERRAINS={
  flat:{label:'Flat',surface:'Smooth concrete',muPeak:.9,muSlide:.75,crr:.015,casterCrr:.03,bumps:false},
  rough:{label:'Rough',surface:'Gravel with bumps',muPeak:.65,muSlide:.55,crr:.05,casterCrr:.09,bumps:true},
  slippery:{label:'Slippery',surface:'Ice-like surface',muPeak:.15,muSlide:.1,crr:.01,casterCrr:.015,bumps:false}
};
export const OBSTACLE={x:0,z:1.3,halfX:.28,halfZ:.16};
export const CHANNELS=['t','cmdL','cmdR','encL','encR','speedL','speedR','currentL','currentR','voltsL','voltsR','ax','ay','az','gx','gy','gz','range','odomX','odomY','odomYaw','gyroYaw','trueX','trueY','trueYaw','trueSpeed','slipL','slipR','wheelL','wheelR'];
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
// Static three-point support with load transfer. e = gravity minus acceleration in body axes (forward, left, normal).
// Local x points to the robot's left, local z forward. Contacts: left wheel, right wheel, caster.
export function contactLoads(p,e,com=centerOfMass(p)){
  const W=p.width/100,tri=[{x:W/2,z:AXLE_Z},{x:-W/2,z:AXLE_Z},{x:CASTER.x,z:CASTER.z}],[A,B,C]=tri;
  const point={x:com.x-com.y*e.l/e.n,z:com.z-com.y*e.f/e.n},det=(B.z-C.z)*(A.x-C.x)+(C.x-B.x)*(A.z-C.z);
  const a=((B.z-C.z)*(point.x-C.x)+(C.x-B.x)*(point.z-C.z))/det,b=((C.z-A.z)*(point.x-C.x)+(A.x-C.x)*(point.z-C.z))/det;
  const fractions=[a,b,1-a-b],total=-com.mass*e.n;
  const margin=Math.min(...tri.map((s,i)=>{const t=tri[(i+1)%3],dx=t.x-s.x,dz=t.z-s.z;return (dx*(point.z-s.z)-dz*(point.x-s.x))/Math.hypot(dx,dz);}));
  return {fractions,loads:fractions.map(f=>f*total),total,point,margin};
}
// Front range sensor: a horizontal ray from 30 cm ahead of the body origin to the obstacle box.
export function rangeTo(pose,obstacle=OBSTACLE){
  const dx=Math.sin(pose.heading),dz=Math.cos(pose.heading),ox=pose.x+dx*.3,oz=pose.z+dz*.3;
  let near=0,far=RANGE.max;
  for(const [o,d,min,max] of [[ox,dx,obstacle.x-obstacle.halfX,obstacle.x+obstacle.halfX],[oz,dz,obstacle.z-obstacle.halfZ,obstacle.z+obstacle.halfZ]]){
    if(Math.abs(d)<1e-8){if(o<min||o>max)return RANGE.max;continue;}
    const a=(min-o)/d,b=(max-o)/d;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
  }
  return far>=near&&far>=0?Math.max(0,near):RANGE.max;
}

export class DriveSim{
  constructor({design,terrain='flat',program=[],seed=1,noise=true}){
    this.design={...design};this.terrain=TERRAINS[terrain]?terrain:'flat';this.surface=TERRAINS[this.terrain];this.curve=frictionCurve(this.surface);
    this.com=centerOfMass(design);this.mass=this.com.mass;this.iz=yawInertia(design);this.width=design.width/100;
    this.contacts=[{x:this.width/2,z:AXLE_Z},{x:-this.width/2,z:AXLE_Z},{x:CASTER.x,z:CASTER.z}];
    this.x=0;this.z=0;this.heading=0;this.u=0;this.v=0;this.w=0;this.acc={f:0,l:0,n:0};this.transfer={f:0,l:0};
    this.wheels=[0,1].map(()=>({w:0,theta:0,ref:0,volts:0,current:0,integral:0,count:0,speed:0,slip:0}));
    this.caster={spin:0,swivel:0};
    this.steps=0;this.budget=0;this.status='running';this.success=false;this.message='';
    this.queue=[...program];this.waitSteps=0;this.instructions=0;this.sinceAdvance=0;this.line=program[0]?.line||1;this.phase='run';this.settleSteps=0;this.quietSteps=0;
    this.seed=seed;this.noise=noise;this.rand=random(seed);
    const bias=sd=>[0,1,2].map(()=>noise?gauss(this.rand)*sd:0);this.bias={gyro:bias(IMU.gyroBias),accel:bias(IMU.accelBias)};
    this.odom={x:0,y:0,yaw:0};this.gyroYaw=0;this.imuPoints=[];this.imuFrames=[];this.heightPrev=null;
    this.log=Object.fromEntries(CHANNELS.map(c=>[c,[]]));this.path=[];this.odomPath=[];
    this.updateContacts();this.start=this.axle();this.range=this.measureRange();
  }
  get time(){return this.steps*DT;}
  get speed(){return Math.hypot(this.u+this.w*this.com.x,this.v+this.w*(AXLE_Z-this.com.z));}
  get maxSlip(){return Math.max(...this.wheels.map(wh=>Math.abs(wh.slip)));}
  axle(){return {x:this.x+AXLE_Z*Math.sin(this.heading),z:this.z+AXLE_Z*Math.cos(this.heading)};}
  advance(seconds){this.budget+=seconds;while(this.budget>=DT/2&&this.status==='running'){this.step();this.budget-=DT;}}
  run(){while(this.status==='running')this.step();return this;}
  finish(success,message){if(this.status!=='running')return;this.status='done';this.success=success;this.message=message;this.wheels.forEach(wh=>{wh.ref=0;wh.volts=0;});}
  step(){
    if(this.status!=='running')return;
    this.interpret();if(this.status!=='running')return;
    if(this.steps%CONTACT_STEPS===0){this.updateContacts();if(this.status!=='running')return;}
    if(this.steps%CONTROL_STEPS===0)this.sample();
    this.dynamics();this.steps++;
    if(this.waitSteps>0){this.waitSteps--;this.sinceAdvance=0;}
    const radius=Math.hypot(this.width/2+.03,.25);
    if(Math.abs(this.x-OBSTACLE.x)<OBSTACLE.halfX+radius&&Math.abs(this.z-OBSTACLE.z)<OBSTACLE.halfZ+radius)return this.finish(false,'Stopped: rover reached the obstacle.');
    if(Math.abs(this.x)>ARENA||Math.abs(this.z)>ARENA)return this.finish(false,'Stopped at the edge of the test area.');
    if(this.time>=MAX_TIME-1e-9)return this.finish(false,'Stopped: 30-second experiment limit.');
    if(this.phase==='settle'){
      // After the last instruction the controller brakes to zero; the run ends once the rover is still.
      const [L,R]=this.wheels,quiet=Math.hypot(this.u,this.v)<.003&&Math.abs(this.w)<.01&&Math.abs(L.w)<.05&&Math.abs(R.w)<.05;
      this.quietSteps=quiet?this.quietSteps+1:0;
      if(this.quietSteps>=.2/DT||++this.settleSteps>=SETTLE_TIME/DT)this.finish(true,'Program complete. Explore your results.');
    }
  }
  interpret(){
    while(this.phase==='run'&&this.waitSteps===0){
      if(++this.sinceAdvance>500||++this.instructions>10000)return this.finish(false,'Stopped: instruction limit reached. Add waits to your loops.');
      const n=this.queue.shift();
      if(!n){this.phase='settle';this.wheels.forEach(wh=>wh.ref=0);return;}
      this.line=n.line;
      if(n.type==='wheels'){this.wheels[0].ref=n.l;this.wheels[1].ref=n.r;}
      else if(n.type==='wait')this.waitSteps=Math.max(1,Math.round(n.time/DT));
      else if(n.type==='repeat')this.queue.unshift(...Array.from({length:n.n},()=>n.body).flat());
      else if(n.type==='if')this.queue.unshift(...(this.range<n.distance?n.body:n.other));
    }
  }
  // 1 kHz: support plane from the terrain under the three contacts, gravity components, and contact loads.
  updateContacts(){
    const s=Math.sin(this.heading),c=Math.cos(this.heading);
    const [L,R,C]=this.contacts.map(({x:lx,z:lz})=>{const px=this.x+lx*c+lz*s,pz=this.z-lx*s+lz*c;return [px,terrainHeight(this.terrain,px,pz),pz];});
    const n=unit(cross(sub(R,C),sub(L,C))),ahead=[s,0,c],d=dot(ahead,n),f=unit([s-d*n[0],-d*n[1],c-d*n[2]]),l=cross(n,f);
    const y=C[1]-(n[0]*(this.x-C[0])+n[2]*(this.z-C[2]))/n[1];
    this.frame={origin:[this.x,y,this.z],f,l,n};this.gravity={f:-GRAVITY*f[1],l:-GRAVITY*l[1],n:-GRAVITY*n[1]};
    const height=y+this.com.x*l[1]+this.com.y*n[1]+this.com.z*f[1],h=DT*CONTACT_STEPS,prev=this.heightPrev;
    if(prev){const vy=(height-prev.y)/h;if(prev.vy!==null)this.acc.n+=((vy-prev.vy)/h-this.acc.n)*h/(.005+h);this.heightPrev={y:height,vy};}else this.heightPrev={y:height,vy:null};
    // Load transfer follows acceleration with a 20 ms lag, standing in for tire and chassis compliance.
    // Without it, traction and load would form an instantaneous loop that diverges for tall rovers.
    const lag=h/(.02+h);this.transfer.f+=(this.acc.f-this.transfer.f)*lag;this.transfer.l+=(this.acc.l-this.transfer.l)*lag;
    const support=contactLoads(this.design,{f:this.gravity.f-this.transfer.f,l:this.gravity.l-this.transfer.l,n:this.gravity.n-this.acc.n},this.com);
    this.loads=support.loads;this.margin=support.margin;this.point=support.point;
    const [left,right,caster]=support.fractions;
    if(support.total<=0)this.finish(false,'Stopped: the rover left the ground. Jumps are not simulated.');
    else if(Math.min(left,right,caster)<0)this.finish(false,`Stopped: ${caster<Math.min(left,right)?'the caster lifted, so the rover began to tip forward':left<0&&right<0?'both drive wheels lifted, so the rover began to tip backward':`the ${left<right?'left':'right'} wheel lifted, so the rover began to tip sideways`}. Dynamic tipping is not simulated.`);
  }
  // 10 kHz: tire forces from combined slip, motor torque, caster drag, then semi-implicit Euler.
  dynamics(){
    const {u,v,w,com,curve,surface:T,mass:m}=this,N=this.loads;
    let Ff=m*this.gravity.f,Fl=m*this.gravity.l,Mz=0;
    for(let i=0;i<2;i++){
      const wh=this.wheels[i],a=this.contacts[i].z-com.z,b=this.contacts[i].x-com.x;
      const sx=WHEEL_RADIUS*wh.w-(u-w*b),sy=-(v+w*a),s=Math.hypot(sx,sy),k=N[i]*(s>1e-9?curve.mu(s)/s:curve.stiffness),fx=k*sx,fy=k*sy;
      Ff+=fx;Fl+=fy;Mz+=a*fy-b*fx;wh.slip=sx;
      wh.current=(wh.volts-MOTOR.ke*wh.w)/MOTOR.resistance;
      const torque=MOTOR.kt*wh.current-MOTOR.coulomb*Math.tanh(wh.w/.05)-MOTOR.viscous*wh.w-T.crr*N[i]*WHEEL_RADIUS*Math.tanh(wh.w*WHEEL_RADIUS/.01)-WHEEL_RADIUS*fx;
      wh.w+=torque/MOTOR.inertia*DT;wh.theta+=wh.w*DT;
    }
    const a=CASTER.z-com.z,b=CASTER.x-com.x,cf=u-w*b,cl=v+w*a,cs=Math.hypot(cf,cl),k=-T.casterCrr*N[2]/Math.sqrt(cs*cs+2.5e-5);
    Ff+=k*cf;Fl+=k*cl;Mz+=a*k*cl-b*k*cf;
    if(cs>1e-3){const d=Math.atan2(cl,cf)-this.caster.swivel;this.caster.swivel+=Math.atan2(Math.sin(d),Math.cos(d))*Math.min(1,cs*DT/CASTER.trail);}
    this.caster.spin+=(cf*Math.cos(this.caster.swivel)+cl*Math.sin(this.caster.swivel))/CASTER.radius*DT;
    this.acc.f=Ff/m;this.acc.l=Fl/m;
    this.u+=(Ff/m+w*v)*DT;this.v+=(Fl/m-w*u)*DT;this.w+=Mz/this.iz*DT;
    const forward=this.u+this.w*com.x,lateral=this.v-this.w*com.z,sh=Math.sin(this.heading),ch=Math.cos(this.heading);
    this.x+=(forward*sh+lateral*ch)*DT;this.z+=(forward*ch-lateral*sh)*DT;this.heading+=this.w*DT;
  }
  measureRange(){
    const truth=rangeTo(this);if(truth>=RANGE.max)return RANGE.max;
    return Math.max(0,Math.min(RANGE.max,truth+(this.noise?gauss(this.rand)*(RANGE.noise+RANGE.relative*truth):0)));
  }
  // 100 Hz: encoders, firmware speed loop, odometry, IMU, range sensor, and the log.
  sample(){
    const T=CONTROL_STEPS*DT,tick=2*Math.PI/ENCODER_CPR;
    const travel=this.wheels.map(wh=>{
      const count=Math.floor(wh.theta/tick),delta=count-wh.count;wh.count=count;wh.speed+=(delta*tick/T-wh.speed)*T/(CONTROL.filter+T);
      const e=wh.ref-wh.speed,integral=wh.integral+e*T;let volts=MOTOR.ke*wh.ref+CONTROL.kp*e+CONTROL.ki*integral;
      if(Math.abs(volts)<=MOTOR.volts)wh.integral=integral;else volts=Math.sign(volts)*MOTOR.volts;wh.volts=volts;
      return delta*tick*WHEEL_RADIUS;
    });
    // Dead reckoning from encoder counts alone: right minus left gives the yaw change (positive turns left).
    const ds=(travel[0]+travel[1])/2,dyaw=(travel[1]-travel[0])/this.width,mid=this.odom.yaw+dyaw/2;
    this.odom.x+=ds*Math.cos(mid);this.odom.y+=ds*Math.sin(mid);this.odom.yaw+=dyaw;
    // IMU at its mount point: acceleration from the point's own 3D trajectory, rates from the change of the body axes.
    const F=this.frame,M=IMU.mount;
    this.imuPoints.push([0,1,2].map(i=>F.origin[i]+M.x*F.l[i]+M.y*F.n[i]+M.z*F.f[i]));this.imuFrames.push(F);
    if(this.imuPoints.length>3)this.imuPoints.shift();if(this.imuFrames.length>2)this.imuFrames.shift();
    let accel=[0,0,GRAVITY],gyro=[0,0,0];
    if(this.imuPoints.length===3){const [p0,p1,p2]=this.imuPoints,G=this.imuFrames[0],a=[0,1,2].map(i=>(p2[i]-2*p1[i]+p0[i])/(T*T));a[1]+=GRAVITY;accel=[dot(a,G.f),dot(a,G.l),dot(a,G.n)];}
    if(this.imuFrames.length===2){const [A,B]=this.imuFrames;gyro=[(dot(A.n,B.l)-dot(A.l,B.n))/(2*T),(dot(A.f,B.n)-dot(A.n,B.f))/(2*T),(dot(A.l,B.f)-dot(A.f,B.l))/(2*T)];}
    const read=(v,bias,sd,lsb)=>Math.round((v+bias+(this.noise?gauss(this.rand)*sd:0))/lsb)*lsb;
    accel=accel.map((v,i)=>read(v,this.bias.accel[i],IMU.accelNoise,IMU.accelLsb));gyro=gyro.map((v,i)=>read(v,this.bias.gyro[i],IMU.gyroNoise,IMU.gyroLsb));
    this.gyroYaw+=gyro[2]*T;
    if(this.steps%RANGE_STEPS===0)this.range=this.measureRange();
    const axle=this.axle(),[L,R]=this.wheels,trueX=axle.z-this.start.z,trueY=axle.x-this.start.x;
    const row=[this.time,L.ref,R.ref,L.count,R.count,L.speed,R.speed,L.current,R.current,L.volts,R.volts,...accel,...gyro,this.range,this.odom.x,this.odom.y,this.odom.yaw,this.gyroYaw,trueX,trueY,this.heading,this.speed,L.slip,R.slip,L.w,R.w];
    CHANNELS.forEach((c,i)=>this.log[c].push(row[i]));
    const track=(list,x,z)=>{const last=list.at(-1);if(!last||Math.hypot(x-last.x,z-last.z)>.018)list.push({x,z});};
    track(this.path,axle.x,axle.z);track(this.odomPath,this.start.x+this.odom.y,this.start.z+this.odom.x);
  }
  summary(){
    const n=this.log.t.length-1,L=this.log;if(n<0)return {odomError:0,headingError:0,distance:0};
    return {odomError:Math.hypot(L.odomX[n]-L.trueX[n],L.odomY[n]-L.trueY[n]),headingError:(L.odomYaw[n]-L.trueYaw[n])*180/Math.PI,distance:this.path.reduce((s,p,i,a)=>i?s+Math.hypot(p.x-a[i-1].x,p.z-a[i-1].z):0,0)};
  }
}
export function simulateRun(options){return new DriveSim(options).run();}
// Column names carry units and mark simulator-only values as true_*. MATLAB: T = readtable('file.csv').
const CSV_NAMES={t:'t_s',cmdL:'cmd_left_rad_s',cmdR:'cmd_right_rad_s',encL:'encoder_left_counts',encR:'encoder_right_counts',speedL:'speed_left_rad_s',speedR:'speed_right_rad_s',currentL:'current_left_A',currentR:'current_right_A',voltsL:'voltage_left_V',voltsR:'voltage_right_V',ax:'accel_x_m_s2',ay:'accel_y_m_s2',az:'accel_z_m_s2',gx:'gyro_x_rad_s',gy:'gyro_y_rad_s',gz:'gyro_z_rad_s',range:'range_m',odomX:'odom_x_m',odomY:'odom_y_m',odomYaw:'odom_yaw_rad',gyroYaw:'gyro_yaw_rad',trueX:'true_x_m',trueY:'true_y_m',trueYaw:'true_yaw_rad',trueSpeed:'true_speed_m_s',slipL:'true_slip_left_m_s',slipR:'true_slip_right_m_s',wheelL:'true_wheel_left_rad_s',wheelR:'true_wheel_right_rad_s'};
export function toCsv(log){
  return [CHANNELS.map(c=>CSV_NAMES[c]).join(','),...log.t.map((_,i)=>CHANNELS.map(c=>{const v=log[c][i];return Number.isInteger(v)?v:+v.toFixed(6);}).join(','))].join('\n')+'\n';
}
