// SI units throughout. Quasi-static support test, not a contact dynamics engine.
export const DEFAULT = {width:44,mass:1.5,height:18,offset:0,target:25};
export const PRESETS = {
  balanced:{...DEFAULT},
  tall:{width:26,mass:3,height:65,offset:0,target:25},
  offset:{width:36,mass:2.5,height:35,offset:-16,target:25}
};
export function centerOfMass(p) {
  const parts = [
    {m:1.8,x:0,y:0.115,z:-0.03},
    {m:0.5,x:0,y:0.09,z:-0.15},
    {m:p.mass,x:p.offset/100,y:0.20+p.height/100,z:-0.06}
  ];
  const mass=parts.reduce((s,c)=>s+c.m,0);
  return {mass,...Object.fromEntries(['x','y','z'].map(k=>[k,parts.reduce((s,c)=>s+c.m*c[k],0)/mass]))};
}
export function contacts(p) {return [{x:-p.width/200,z:0.08},{x:0,z:-0.22},{x:p.width/200,z:0.08}];}
export function balance(p,angle=0) {
  const com=centerOfMass(p),polygon=contacts(p);
  const projection={x:com.x-com.y*Math.tan(angle*Math.PI/180),z:com.z};
  const distances=polygon.map((a,i)=>{
    const b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dz=b.z-a.z;
    return (dx*(projection.z-a.z)-dz*(projection.x-a.x))/Math.hypot(dx,dz);
  });
  const margin=Math.min(...distances);
  return {com,polygon,projection,margin,stable:margin>0};
}
export function criticalAngle(p) {
  if(!balance(p,0).stable)return 0;
  let lo=0,hi=89;
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(balance(p,mid).stable)lo=mid;else hi=mid;}
  return hi;
}
export const WHEEL_RADIUS=0.075;
export function wheelVelocity(left,right,width) {
  return {v:WHEEL_RADIUS*(left+right)/2,omega:WHEEL_RADIUS*(left-right)/(width/100)};
}
export function stepDrive(pose,left,right,width,dt) {
  const {v,omega}=wheelVelocity(left,right,width);
  if(Math.abs(omega)<1e-8)return {...pose,x:pose.x+v*Math.sin(pose.heading)*dt,z:pose.z+v*Math.cos(pose.heading)*dt};
  const next=pose.heading+omega*dt;
  return {x:pose.x+v/omega*(Math.cos(pose.heading)-Math.cos(next)),z:pose.z+v/omega*(Math.sin(next)-Math.sin(pose.heading)),heading:next};
}
// Bounded parser: no eval, arbitrary JavaScript, imports, or network access.
export function parseProgram(source) {
  const lines=source.split('\n');let count=0,index=0;
  const fail=(line,msg)=>{throw new Error(`Line ${line}: ${msg}`);};
  const parseBlock=(depth=0)=>{
    if(depth>5)fail(index+1,'Use at most five nested blocks.');
    const nodes=[];
    while(index<lines.length){
      const lineNo=index+1,s=lines[index].split('#')[0].trim();index++;
      if(!s)continue;
      if(++count>300)fail(lineNo,'Keep your program under 300 instructions.');
      if(s==='end'||s==='else')return {nodes,closing:s,line:lineNo};
      let m;
      if((m=s.match(/^wheels\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/))){
        const l=+m[1],r=+m[2];if(Math.abs(l)>10||Math.abs(r)>10)fail(lineNo,'Wheel speeds must be between -10 and 10 rad/s.');
        nodes.push({type:'wheels',l,r,line:lineNo});
      }else if((m=s.match(/^wait\(\s*(\d+(?:\.\d+)?)\s*\)$/))){
        const time=+m[1];if(time<0.05||time>10)fail(lineNo,'Wait between 0.05 and 10 seconds.');
        nodes.push({type:'wait',time,line:lineNo});
      }else if(s==='stop()')nodes.push({type:'wheels',l:0,r:0,line:lineNo});
      else if((m=s.match(/^repeat\s+(\d+)\s*:?$/))){
        const n=+m[1];if(n<1||n>20)fail(lineNo,'Repeat between 1 and 20 times.');
        const block=parseBlock(depth+1);if(block.closing!=='end')fail(lineNo,'Close your repeat block with end.');
        nodes.push({type:'repeat',n,body:block.nodes,line:lineNo});
      }else if((m=s.match(/^if\s+distance\s*<\s*(\d+(?:\.\d+)?)\s*:?$/))){
        const block=parseBlock(depth+1);let other=[];
        if(block.closing==='else'){const b=parseBlock(depth+1);if(b.closing!=='end')fail(lineNo,'Close your if block with end.');other=b.nodes;}
        else if(block.closing!=='end')fail(lineNo,'Close your if block with end.');
        nodes.push({type:'if',distance:+m[1],body:block.nodes,other,line:lineNo});
      }else fail(lineNo,'Try wheels(left, right), wait(seconds), stop(), repeat N, or if distance < N.');
    }
    return {nodes,closing:null};
  };
  const result=parseBlock();if(result.closing)fail(result.line,`Unexpected ${result.closing}.`);
  if(!result.nodes.length)fail(1,'Add at least one instruction.');
  return result.nodes;
}
