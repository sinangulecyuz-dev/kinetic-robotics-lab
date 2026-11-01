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
// Forward is +z and the robot's left is +x. Positive omega turns left (counterclockwise seen from above).
export function wheelVelocity(left,right,width) {
  return {v:WHEEL_RADIUS*(left+right)/2,omega:WHEEL_RADIUS*(right-left)/(width/100)};
}
export function stepDrive(pose,left,right,width,dt) {
  const {v,omega}=wheelVelocity(left,right,width);
  if(Math.abs(omega)<1e-8)return {...pose,x:pose.x+v*Math.sin(pose.heading)*dt,z:pose.z+v*Math.cos(pose.heading)*dt};
  const next=pose.heading+omega*dt;
  return {x:pose.x+v/omega*(Math.cos(pose.heading)-Math.cos(next)),z:pose.z+v/omega*(Math.sin(next)-Math.sin(pose.heading)),heading:next};
}
// Readings a program can test. Units: distance m, heading and odom_heading degrees (positive turns left),
// gyro_z rad/s, encoders counts since the start, odom_x and odom_y m, time s.
// LiDAR beams in m at 0° (front), 90° (left), 180° (back), 270° (right): 0 when too close, Infinity with no return.
// lidar_min is the closest return in m and lidar_min_angle its direction in degrees, counterclockwise from the front.
// fused_heading (degrees), fused_x and fused_y (m) come from the complementary filter set by filter(alpha).
export const SENSORS=['distance','heading','odom_heading','gyro_z','encoder_left','encoder_right','odom_x','odom_y','time','lidar_front','lidar_left','lidar_back','lidar_right','lidar_min','lidar_min_angle','fused_heading','fused_x','fused_y'];
// Math inside wheels() and drive(): numbers, sensor names, + - * /, parentheses, abs(x), min(a, b), max(a, b).
// A tokenizer and a recursive-descent parser build a small tree, and evaluate() walks it: no eval, no JavaScript.
// A tree is a number, {sensor}, {op:'neg',a}, {op:'+'|'-'|'*'|'/',a,b}, or {fn,args}.
export const MATH_FUNCTIONS=new Map([['abs',1],['min',2],['max',2]]);
export const MATH_LIMITS={symbols:40,depth:5};
// Division by zero has no value (NaN), even where IEEE would give infinity, so a student sees it instead of a silent saturation.
export function evaluate(e,read){
  if(typeof e==='number')return e;
  if(e.sensor)return read(e.sensor);
  if(e.fn){const x=e.args.map(a=>evaluate(a,read));return e.fn==='abs'?Math.abs(x[0]):e.fn==='min'?Math.min(x[0],x[1]):Math.max(x[0],x[1]);}
  const a=evaluate(e.a,read);if(e.op==='neg')return -a;
  const b=evaluate(e.b,read);
  return e.op==='+'?a+b:e.op==='-'?a-b:e.op==='*'?a*b:b===0?NaN:a/b;
}
// Parser errors carry a key and params as well as English text, so the interface can explain them in the student's language.
const fail=(line,msg,key,params={})=>{const e=new Error(`Line ${line}: ${msg}`);e.line=line;e.key=key;e.params=params;throw e;};
const usesSensor=e=>typeof e!=='number'&&(!!e.sensor||(e.args||[e.a,e.b]).some(x=>x!==undefined&&usesSensor(x)));
// Parses the comma-separated values between the parentheses of one instruction.
// A value without sensors is computed here, so range errors still appear before the run.
export function parseValues(text,line=1){
  const tokens=[],re=/\s*(?:(\d+(?:\.\d+)?)|([a-z_]+)|([-+*/(),]))/y;
  for(re.lastIndex=0;re.lastIndex<text.length&&text.slice(re.lastIndex).trim();){
    const m=re.exec(text);if(!m)fail(line,'Check the math. Use numbers, sensor names, + - * /, parentheses, abs(x), min(a, b), and max(a, b).','exprSyntax');
    if(tokens.push(m[1]!==undefined?{num:+m[1]}:m[2]!==undefined?{name:m[2]}:{sym:m[3]})>MATH_LIMITS.symbols)fail(line,'Keep the math in one instruction under 40 symbols.','exprLong');
  }
  let i=0,depth=0;
  const syntax=()=>fail(line,'Check the math. Use numbers, sensor names, + - * /, parentheses, abs(x), min(a, b), and max(a, b).','exprSyntax');
  const is=sym=>tokens[i]?.sym===sym,expect=sym=>{if(!is(sym))syntax();i++;};
  const open=()=>{if(++depth>MATH_LIMITS.depth)fail(line,'Use at most five nested parentheses.','exprDepth');};
  const sum=()=>{let a=product();while(is('+')||is('-')){const op=tokens[i++].sym;a={op,a,b:product()};}return a;};
  const product=()=>{let a=unary();while(is('*')||is('/')){const op=tokens[i++].sym;a={op,a,b:unary()};}return a;};
  const unary=()=>{if(is('-')){i++;return {op:'neg',a:unary()};}return primary();};
  const primary=()=>{
    const t=tokens[i++];if(!t)syntax();
    if(t.num!==undefined)return t.num;
    if(t.sym==='('){open();const e=sum();expect(')');depth--;return e;}
    if(t.name===undefined)syntax();
    const name=t.name,call=is('(');
    if(call?!MATH_FUNCTIONS.has(name):!SENSORS.includes(name))fail(line,`${name} is not a sensor or a math function. Sensors: ${SENSORS.join(', ')}.`,'exprName',{name,list:SENSORS.join(', ')});
    if(!call)return {sensor:name};
    i++;open();const args=[sum()];while(is(',')){i++;args.push(sum());}expect(')');depth--;
    if(args.length!==MATH_FUNCTIONS.get(name))fail(line,'abs(x) takes one value; min(a, b) and max(a, b) take two.','exprArity');
    return {fn:name,args};
  };
  const values=[sum()];while(is(',')){i++;values.push(sum());}
  if(i<tokens.length)syntax();
  return values.map(e=>{
    if(usesSensor(e))return e;
    const v=evaluate(e,()=>NaN);if(!Number.isFinite(v))fail(line,'This math has no value, for example a division by zero.','exprValue');
    return v;
  });
}
// Bounded parser: no eval, arbitrary JavaScript, imports, or network access.
export function parseProgram(source) {
  const lines=source.split('\n');let count=0,index=0;
  const parseBlock=(depth=0)=>{
    if(depth>5)fail(index+1,'Use at most five nested blocks.','nesting');
    const nodes=[];
    while(index<lines.length){
      const lineNo=index+1,s=lines[index].split('#')[0].trim();index++;
      if(!s)continue;
      if(++count>300)fail(lineNo,'Keep your program under 300 instructions.','tooLong');
      if(s==='end'||s==='else')return {nodes,closing:s,line:lineNo};
      let m;
      if((m=s.match(/^(wheels|drive)\((.*)\)$/))){
        // A value is a number, or a tree computed from sensors at run time and clipped to the same limits there.
        const name=m[1],values=parseValues(m[2],lineNo),over=(x,limit)=>typeof x==='number'&&Math.abs(x)>limit;
        if(values.length!==2)fail(lineNo,`${name} needs two values, like ${name}(a, b).`,'args',{name});
        if(name==='wheels'){
          const [l,r]=values;if(over(l,10)||over(r,10))fail(lineNo,'Wheel speeds must be between -10 and 10 rad/s.','wheelRange');
          nodes.push({type:'wheels',l,r,line:lineNo});
        }else{
          const [v,w]=values;if(over(v,.75))fail(lineNo,'Forward speed v must be between -0.75 and 0.75 m/s.','driveV');if(over(w,6))fail(lineNo,'Turn rate w must be between -6 and 6 rad/s.','driveW');
          nodes.push({type:'drive',v,w,line:lineNo});
        }
      }else if((m=s.match(/^filter\(\s*(\d+(?:\.\d+)?)\s*\)$/))){
        const alpha=+m[1];if(alpha>1)fail(lineNo,'The filter weight alpha must be between 0 and 1.','filterRange');
        nodes.push({type:'filter',alpha,line:lineNo});
      }else if((m=s.match(/^wait\(\s*(\d+(?:\.\d+)?)\s*\)$/))){
        const time=+m[1];if(time<0.05||time>10)fail(lineNo,'Wait between 0.05 and 10 seconds.','waitRange');
        nodes.push({type:'wait',time,line:lineNo});
      }else if(s==='stop()')nodes.push({type:'wheels',l:0,r:0,line:lineNo});
      else if((m=s.match(/^repeat\s+(\d+)\s*:?$/))){
        const n=+m[1];if(n<1||n>20)fail(lineNo,'Repeat between 1 and 20 times.','repeatRange');
        const block=parseBlock(depth+1);if(block.closing!=='end')fail(lineNo,'Close your repeat block with end.','closeRepeat');
        nodes.push({type:'repeat',n,body:block.nodes,line:lineNo});
      }else if((m=s.match(/^(if|while)\s+([a-z_]+)\s*(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)\s*:?$/))){
        const [,kind,sensor,op,value]=m;if(!SENSORS.includes(sensor))fail(lineNo,`Unknown sensor ${sensor}. Use ${SENSORS.join(', ')}.`,'unknownSensor',{sensor,list:SENSORS.join(', ')});
        const block=parseBlock(depth+1);let other=[];
        if(kind==='if'&&block.closing==='else'){const b=parseBlock(depth+1);if(b.closing!=='end')fail(lineNo,'Close your if block with end.','closeIf');other=b.nodes;}
        else if(block.closing!=='end')fail(lineNo,`Close your ${kind} block with end.`,'closeBlock',{kind});
        nodes.push({type:kind,sensor,op,value:+value,body:block.nodes,other,line:lineNo});
      }else fail(lineNo,'Try wheels(left, right), drive(v, w), wait(seconds), stop(), filter(alpha), repeat N, or if/while sensor < N.','unknown');
    }
    return {nodes,closing:null};
  };
  const result=parseBlock();if(result.closing)fail(result.line,`Unexpected ${result.closing}.`,'unexpected',{word:result.closing});
  if(!result.nodes.length)fail(1,'Add at least one instruction.','empty');
  return result.nodes;
}
