// Quadcopter model of the ME 425 slides "Motion Control of a Quadcopter I-II". Pure functions, SI units, no DOM.
// Frames (deck I, slides 4 and 10): E-frame fixed, Z up. B-frame on the vehicle: X_B to the FRONT rotor, Y_B to the LEFT rotor, Z_B up.
// Rotors: 1 FRONT, 2 RIGHT, 3 REAR, 4 LEFT. Front and rear turn counterclockwise, left and right clockwise.
// State s = [X, Y, Z, phi, theta, psi, p, q, r, Xdot, Ydot, Zdot].

export const DT=1/240;
// U1 [N], U2-U4 [N m]; b [N s^2], d [N m s^2], l [m], I [kg m^2], Jtp [kg m^2].
export const DEFAULTS={m:.486,l:.25,Ixx:3.8278e-3,Iyy:3.8278e-3,Izz:7.6566e-3,b:2.9842e-5,d:3.2320e-7,Jtp:2.8385e-5,g:9.81,omegaMax:400};
export const FULL={fullT:true,gyro:true};
// The singularity of T_Theta at theta = +-90 deg: 1/cos(theta) is held at this bound so the state never becomes NaN.
export const COS_MIN=.02,SINGULAR_WARN=.1;

export const hoverSpeed=P=>Math.sqrt(P.m*P.g/(4*P.b));
export const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// Deck II, slide 28: inputs from rotor speeds.
export function inputsFromOmegas([w1,w2,w3,w4],P){
  const a=w1*w1,b=w2*w2,c=w3*w3,e=w4*w4;
  return {U:[P.b*(a+b+c+e),P.l*P.b*(-b+e),P.l*P.b*(-a+c),P.d*(-a+b-c+e)],Om:-w1+w2-w3+w4};
}
// The same four equations solved for the squared speeds. A negative square is clipped to 0 and a speed above omegaMax to omegaMax.
export function omegasFromInputs([U1,U2,U3,U4],P){
  const A=U1/(4*P.b),B=U2/(2*P.l*P.b),C=U3/(2*P.l*P.b),D=U4/(4*P.d),max=P.omegaMax??Infinity;
  let low=false,high=false;
  const W=[A-C-D,A-B+D,A+C-D,A+B+D].map(sq=>{if(sq<0){low=true;return 0;}const w=Math.sqrt(sq);if(w>max){high=true;return max;}return w;});
  return {W,low,high};
}

// R_Theta = Rz(psi) Ry(theta) Rx(phi), deck I slide 12, as rows.
export function rotation(phi,theta,psi){
  const sp=Math.sin(phi),cp=Math.cos(phi),st=Math.sin(theta),ct=Math.cos(theta),ss=Math.sin(psi),cs=Math.cos(psi);
  return [[cs*ct,-ss*cp+cs*st*sp,ss*sp+cs*st*cp],[ss*ct,cs*cp+ss*st*sp,-cs*sp+ss*st*cp],[-st,ct*sp,ct*cp]];
}
// T_Theta, deck I slide 12, with 1/cos(theta) bounded near the singularity.
export function eulerRates(phi,theta,p,q,r,fullT=true){
  if(!fullT)return {rates:[p,q,r],singular:false};
  const sp=Math.sin(phi),cp=Math.cos(phi),raw=Math.cos(theta),st=Math.sin(theta);
  const ct=Math.abs(raw)<COS_MIN?(raw<0?-COS_MIN:COS_MIN):raw,tt=st/ct;
  return {rates:[p+sp*tt*q+cp*tt*r,cp*q-sp*r,(sp*q+cp*r)/ct],singular:Math.abs(raw)<SINGULAR_WARN};
}

// Every term of the six equations of motion (deck I slide 26), kept apart so the interface can show each one.
export function terms(s,U,Om,P,model=FULL){
  const [,,,phi,theta,psi,p,q,r]=s,[U1,U2,U3,U4]=U,G=model.gyro?1:0,R=rotation(phi,theta,psi),a=U1/P.m;
  return {
    X:{dir:R[0][2],thrust:R[0][2]*a},Y:{dir:R[1][2],thrust:R[1][2]*a},Z:{dir:R[2][2],gravity:-P.g,thrust:R[2][2]*a},
    p:{inertia:G*(P.Iyy-P.Izz)/P.Ixx*q*r,rotor:-G*P.Jtp/P.Ixx*q*Om,input:U2/P.Ixx},
    q:{inertia:G*(P.Izz-P.Ixx)/P.Iyy*p*r,rotor:G*P.Jtp/P.Iyy*p*Om,input:U3/P.Iyy},
    r:{inertia:G*(P.Ixx-P.Iyy)/P.Izz*p*q,input:U4/P.Izz}
  };
}
export function derivative(s,U,Om,P,model=FULL){
  const T=terms(s,U,Om,P,model),{rates}=eulerRates(s[3],s[4],s[6],s[7],s[8],model.fullT);
  return [s[9],s[10],s[11],...rates,T.p.inertia+T.p.rotor+T.p.input,T.q.inertia+T.q.rotor+T.q.input,T.r.inertia+T.r.input,T.X.thrust,T.Y.thrust,T.Z.gravity+T.Z.thrust];
}
// One RK4 step with the inputs held constant over the step.
export function rk4(s,U,Om,P,model=FULL,h=DT){
  const add=(v,c)=>s.map((x,i)=>x+c*v[i]),k1=derivative(s,U,Om,P,model),k2=derivative(add(k1,h/2),U,Om,P,model),k3=derivative(add(k2,h/2),U,Om,P,model),k4=derivative(add(k3,h),U,Om,P,model);
  return s.map((x,i)=>x+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}

// PID in the form of deck II slides 30-31. With `improved` the derivative acts on the process output (plus the reference rate,
// when one is known) and a saturator limits the integral term; without it this is the traditional PID with both drawbacks.
export class PID{
  constructor({kp=0,ki=0,kd=0,iMax=Infinity,angle=false}={}){Object.assign(this,{kp,ki,kd,iMax,angle});this.reset();}
  reset(){this.integral=0;this.last=null;}
  update(ref,y,ydot,dt,{improved=true,refRate=0}={}){
    const e=this.angle?wrap(ref-y):ref-y;
    this.integral+=e*dt;
    if(improved&&this.ki>0){const lim=this.iMax/this.ki;this.integral=Math.max(-lim,Math.min(lim,this.integral));}
    const de=improved?refRate-ydot:this.last===null?0:(e-this.last)/dt;this.last=e;
    return this.kp*e+this.ki*this.integral+this.kd*de;
  }
}
// Gains act on accelerations (m/s^2 or rad/s^2); U2-U4 are scaled by the inertias as on deck II slides 41-42.
export const GAINS={
  hover:{Z:{kp:12,ki:2,kd:7,iMax:.3},phi:{kp:60,ki:5,kd:14,iMax:.5},theta:{kp:60,ki:5,kd:14,iMax:.5},psi:{kp:10,ki:1,kd:5,iMax:.3}},
  traj:{X:{kp:4,ki:.5,kd:3.5,iMax:.3},Y:{kp:4,ki:.5,kd:3.5,iMax:.3},Z:{kp:12,ki:2,kd:7,iMax:.3},phi:{kp:120,ki:0,kd:22,iMax:8},theta:{kp:120,ki:0,kd:22,iMax:8},psi:{kp:10,ki:1,kd:5,iMax:.3}}
};
export const TILT_LIMIT=.6;

// Desired trajectories for the trajectory mode: position, velocity, and acceleration at time t, starting from `from`.
export function trajectory({type='circle',radius=1,speed=.5,length=3},t,from=[0,0,1]){
  const [x0,y0,z0]=from;
  if(type==='line'){const T=length/speed,on=t<T;return {pos:[x0+speed*Math.min(t,T),y0,z0],vel:[on?speed:0,0,0],acc:[0,0,0]};}
  const w=speed/radius,a=w*t;
  return {pos:[x0+radius*Math.sin(a),y0+radius*(1-Math.cos(a)),z0],vel:[speed*Math.cos(a),speed*Math.sin(a),0],acc:[-speed*w*Math.sin(a),speed*w*Math.cos(a),0]};
}

// The simulated vehicle with its controller. cmd selects the mode:
//   {mode:'manual', U:[U1,U2,U3,U4]}
//   {mode:'hover', Zd, phid, thetad, psid}
//   {mode:'traj', traj:{type,radius,speed,length}, psid}
export class Sim{
  constructor({params=DEFAULTS,model=FULL,improvedPID=true,floor=false,gains=GAINS,state}={}){
    this.P={...params};this.model={...model};this.improvedPID=improvedPID;this.floor=floor;this.gains=gains;this.reset(state);
  }
  reset(state){
    this.s=state?state.slice():[0,0,0,0,0,0,0,0,0,0,0,0];this.t=0;this.crashed=false;this.origin=this.s.slice(0,3);this.trajStart=null;
    const mk=g=>Object.fromEntries(Object.entries(g).map(([k,v])=>[k,new PID({...v,angle:k==='phi'||k==='theta'||k==='psi'})]));
    this.pid={hover:mk(this.gains.hover),traj:mk(this.gains.traj)};this.ref={phi:null,theta:null};
    this.last=null;return this;
  }
  // Euler rates as the controller measures them.
  rates(){return eulerRates(this.s[3],this.s[4],this.s[6],this.s[7],this.s[8],this.model.fullT);}
  control(cmd){
    const P=this.P,s=this.s,opt={improved:this.improvedPID},[phiDot,thetaDot,psiDot]=this.rates().rates;
    if(cmd.mode==='manual')return {U:cmd.U.slice(),des:null};
    if(cmd.mode==='hover'){
      const c=this.pid.hover,tilt=Math.max(.5,Math.cos(s[3])*Math.cos(s[4]));
      // Altitude: Zddot = -g + cos(theta)cos(phi) U1/m, solved for U1 (deck II slide 29).
      const U1=P.m*(P.g+c.Z.update(cmd.Zd,s[2],s[11],DT,opt))/tilt;
      return {U:[U1,P.Ixx*c.phi.update(cmd.phid,s[3],phiDot,DT,opt),P.Iyy*c.theta.update(cmd.thetad,s[4],thetaDot,DT,opt),P.Izz*c.psi.update(cmd.psid,s[5],psiDot,DT,opt)],
        des:{Z:cmd.Zd,phi:cmd.phid,theta:cmd.thetad,psi:cmd.psid}};
    }
    // Trajectory control with virtual inputs (deck II slides 35-39).
    if(this.trajStart===null){this.trajStart=this.t;this.origin=s.slice(0,3);}
    const c=this.pid.traj,d=trajectory(cmd.traj,this.t-this.trajStart,this.origin);
    const mu=['X','Y','Z'].map((k,i)=>d.acc[i]+c[k].update(d.pos[i],s[i],s[9+i],DT,{...opt,refRate:d.vel[i]}));
    // Slide 39 writes mu_y without its square; the three equations of slide 38 give the squared form used here.
    const U1=P.m*Math.hypot(mu[0],mu[1],mu[2]+P.g),a=U1/P.m,psid=cmd.psid??0,ss=Math.sin(psid),cs=Math.cos(psid);
    // Small angles (sin x = x, cos phi_d = 1) in the first two equations of slide 38.
    const lim=v=>Math.max(-TILT_LIMIT,Math.min(TILT_LIMIT,v)),phid=lim((ss*mu[0]-cs*mu[1])/a),thetad=lim((cs*mu[0]+ss*mu[1])/a);
    // Feedforward for the attitude loops: rates of phi_d and theta_d by a filtered difference.
    const rate=(k,v)=>{const r=this.ref,prev=r[k];r[k]=v;const raw=prev===null?0:(v-prev)/DT;r[k+'Rate']=(r[k+'Rate']??0)+(raw-(r[k+'Rate']??0))*DT/(.05+DT);return r[k+'Rate'];};
    const U2=P.Ixx*c.phi.update(phid,s[3],phiDot,DT,{...opt,refRate:rate('phi',phid)}),U3=P.Iyy*c.theta.update(thetad,s[4],thetaDot,DT,{...opt,refRate:rate('theta',thetad)});
    return {U:[U1,U2,U3,P.Izz*c.psi.update(psid,s[5],psiDot,DT,opt)],des:{X:d.pos[0],Y:d.pos[1],Z:d.pos[2],phi:phid,theta:thetad,psi:psid},mu};
  }
  // Advances one fixed step and returns what happened in it.
  step(cmd){
    const P=this.P,{U:asked,des,mu}=this.control(cmd),{W,low,high}=omegasFromInputs(asked,P),{U,Om}=inputsFromOmegas(W,P);
    const T=terms(this.s,U,Om,P,this.model),singular=this.rates().singular;
    if(!this.crashed)this.s=rk4(this.s,U,Om,P,this.model,DT);
    if(this.floor&&this.s[2]<0){this.s[2]=0;for(const i of [6,7,8,9,10,11])this.s[i]=0;this.crashed=Math.abs(this.s[3])>.5||Math.abs(this.s[4])>.5||this.crashed;}
    this.t+=DT;
    return this.last={t:this.t,s:this.s,U,asked,W,Om,terms:T,des,mu,low,high,singular,crashed:this.crashed};
  }
}
