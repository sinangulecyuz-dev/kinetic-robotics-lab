// Replay of a finished drive run: the rover as it was at any moment, rebuilt from the run's 100 Hz log.
// The scene, the telemetry, and the "what the robot reads" card draw a replay exactly as they draw a live run.
// Pure and DOM-free. A replay never steps the physics: it only reads what the run recorded.
import {DriveSim,DT,CONTROL_STEPS,LIDAR} from './drive.mjs';

const RATE=1/(CONTROL_STEPS*DT);
// One path point every 5 samples (20 Hz) is finer than the scene needs.
const PATH_STRIDE=5;

export class Replay{
  constructor(run){
    this.run=run;this.log=run.log;this.samples=run.log.t.length;
    // A puppet of the same robot on the same ground. Only its pose and readings are set, then its contact geometry is recomputed.
    this.puppet=new DriveSim({design:run.design,terrain:run.terrain,robot:run.robot,noise:false,start:run.origin});
    this.puppet.seed=run.seed;this.puppet.windOption=run.windOption;
    const L=this.log,S=run.start,pts=(fx,fy)=>{const out=[];for(let i=0;i<this.samples;i+=PATH_STRIDE)out.push({x:S.x+fy[i],z:S.z+fx[i]});return out;};
    this.paths={true:pts(L.trueX,L.trueY),odom:pts(L.odomX,L.odomY),fused:pts(L.fusedX,L.fusedY)};
  }
  get duration(){return this.samples?this.log.t[this.samples-1]:0;}
  index(time){return Math.max(0,Math.min(this.samples-1,Math.round(time*RATE)));}
  // The rover at `time` seconds into the run, as an object the interface reads like a simulation.
  at(time){
    const L=this.log,i=this.index(time),v=this.puppet,S=this.run.start,tick=2*Math.PI/v.spec.encoderCpr;
    if(!this.samples)return v;
    // The log holds the axle point in the start frame (x forward, y left); the body origin lies axleZ behind it.
    const h=L.trueYaw[i],ax=S.x+L.trueY[i],az=S.z+L.trueX[i];
    v.heading=h;v.x=ax-v.axleZ*Math.sin(h);v.z=az-v.axleZ*Math.cos(h);
    // Body rates chosen so the speed reading equals the logged axle speed, and gyro_z its logged value.
    v.steps=Math.round(L.t[i]/DT);v.w=L.gz[i];v.u=L.trueSpeed[i]-v.w*v.com.x;v.v=-v.w*(v.axleZ-v.com.z);
    [['encL','speedL','slipL','wheelL','cmdL','currentL','voltsL'],['encR','speedR','slipR','wheelR','cmdR','currentR','voltsR']].forEach(([enc,speed,slip,w,ref,current,volts],k)=>{
      Object.assign(v.wheels[k],{count:L[enc][i],theta:L[enc][i]*tick,speed:L[speed][i],slip:L[slip][i],w:L[w][i],ref:L[ref][i],current:L[current][i],volts:L[volts][i]});});
    v.odom={x:L.odomX[i],y:L.odomY[i],yaw:L.odomYaw[i]};v.fusion={...v.fusion,x:L.fusedX[i],y:L.fusedY[i],yaw:L.fusedYaw[i]};
    v.gyroYaw=L.gyroYaw[i];v.gyroZ=L.gz[i];v.range=L.range[i];v.windSpeed=L.windSpeed[i];v.windToward=L.windToward[i];
    // The latest complete LiDAR scan at that moment. The log stores a missing return as 0.
    const scans=this.run.scans;let lo=0,hi=scans.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(scans[mid].t<=L.t[i]+1e-9)lo=mid;else hi=mid-1;}
    const ranges=scans[lo].ranges.map(r=>r>0?r:Infinity),q=LIDAR.beams/4;let min=Infinity,at=0;ranges.forEach((r,k)=>{if(r<min){min=r;at=k;}});
    v.scan=ranges;v.lidar={front:ranges[0],left:ranges[q],back:ranges[2*q],right:ranges[3*q],min,minAngle:at*360/LIDAR.beams};
    // Load transfer from the logged body acceleration, so the support point leans as it did. The IMU's noise and offset come with it.
    v.acc={f:L.ax[i],l:L.ay[i],n:0};v.transfer={f:L.ax[i],l:L.ay[i]};v.heightPrev=null;v.status='running';v.updateContacts();v.status='running';
    const n=Math.floor(i/PATH_STRIDE)+1,now={x:ax,z:az},cut=p=>[...p.slice(0,n),now];
    v.path=cut(this.paths.true);v.odomPath=[...this.paths.odom.slice(0,n),{x:S.x+L.odomY[i],z:S.z+L.odomX[i]}];v.fusedPath=[...this.paths.fused.slice(0,n),{x:S.x+L.fusedY[i],z:S.z+L.fusedX[i]}];
    return v;
  }
}

// The earlier run a new run is compared with: the most recent one on the same robot from the same start.
// `runs` is newest first; each has {robot, start}.
export function previousRun(runs,current){
  const key=r=>JSON.stringify([r.robot||'kinetic',r.start?.x||0,r.start?.z||0]),want=key(current);
  return runs.find(r=>r!==current&&key(r)===want)||null;
}
