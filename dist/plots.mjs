// MATLAB-style line figures on canvas: white axes, box, grid, inward ticks, legend.
// Colors are MATLAB colororder slots 1, 2 and 4; slot 3 (#EDB120) fails contrast on a white background.
export const COLORS=['#0072BD','#D95319','#7E2F8E'];
const INK='#262626',GRID='#e1e1e1',FONT='Helvetica, Arial, sans-serif';

function niceStep(span,count){const raw=span/count,mag=10**Math.floor(Math.log10(raw)),n=raw/mag;return (n<1.5?1:n<3?2:n<7?5:10)*mag;}
function limits(lo,hi,count){
  if(!Number.isFinite(lo)){lo=0;hi=1;}
  if(hi-lo<1e-9){const pad=Math.abs(lo)*.1||1;lo-=pad;hi+=pad;}
  const step=niceStep(hi-lo,count);return {lo:Math.floor(lo/step+1e-9)*step,hi:Math.ceil(hi/step-1e-9)*step,step};
}
function ticks({lo,hi,step}){const out=[];for(let v=Math.ceil(lo/step-1e-9)*step;v<=hi+step*1e-6;v+=step)out.push(Math.abs(v)<step*1e-6?0:v);return out;}
// dash: false for solid, true for dashed (MATLAB '--'), or an explicit pattern such as [2, 3] for dotted (':').
const pattern=d=>Array.isArray(d)?d:d?[6,4]:[];
const tickLabel=(v,step)=>v.toFixed(Math.min(4,Math.max(0,Math.ceil(-Math.log10(step)-1e-9))));
function extent(spec,key){
  let lo=Infinity,hi=-Infinity;
  for(const s of spec.series)for(const v of s[key])if(Number.isFinite(v)){if(v<lo)lo=v;if(v>hi)hi=v;}
  for(const p of spec.patches||[]){lo=Math.min(lo,p[key+'0']);hi=Math.max(hi,p[key+'1']);}
  return [lo,hi];
}

export class Figure{
  constructor(container){
    this.root=document.createElement('figure');this.root.className='plot';
    this.canvas=document.createElement('canvas');this.canvas.tabIndex=0;
    this.tip=document.createElement('div');this.tip.className='plot-tip';this.tip.hidden=true;
    this.root.append(this.canvas,this.tip);container.append(this.root);
    this.ctx=this.canvas.getContext('2d');this.cursor=null;this.cursorSeries=0;this.spec=null;
    new ResizeObserver(()=>this.draw()).observe(this.canvas);
    this.canvas.addEventListener('pointermove',e=>this.hover(e));
    this.canvas.addEventListener('pointerleave',()=>{if(document.activeElement!==this.canvas)this.setCursor(null);});
    this.canvas.addEventListener('focus',()=>{if(this.cursor===null&&this.length())this.setCursor(this.length()-1);});
    this.canvas.addEventListener('blur',()=>this.setCursor(null));
    this.canvas.addEventListener('keydown',e=>this.key(e));
  }
  set(spec){
    this.spec=spec;if(this.cursor!==null&&this.cursor>=this.length())this.cursor=this.length()?this.length()-1:null;
    this.canvas.setAttribute('aria-label',`${spec.title}. ${spec.series.map(s=>s.label).join(', ')}. Use the arrow keys to read values.`);
    this.draw();
  }
  length(){return this.spec?.series[this.spec.kind==='xy'?this.cursorSeries:0]?.x.length||0;}
  draw(){
    const {canvas,ctx,spec}=this,w=canvas.clientWidth,h=canvas.clientHeight;if(!spec||!w||!h)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    if(spec.kind==='polar')return this.drawPolar(w,h);
    const box={l:58,r:w-20,t:28,b:h-40},pw=box.r-box.l,ph=box.b-box.t;let xr,yr;
    if(spec.kind==='xy'){
      // axis equal: one meter is the same length on both axes.
      const [x0,x1]=extent(spec,'x'),[y0,y1]=extent(spec,'y'),scale=Math.max((x1-x0)/pw,(y1-y0)/ph,.5/Math.min(pw,ph))*1.12,cx=(x0+x1)/2,cy=(y0+y1)/2;
      xr={lo:cx-scale*pw/2,hi:cx+scale*pw/2};yr={lo:cy-scale*ph/2,hi:cy+scale*ph/2};
      xr.step=yr.step=niceStep(scale*Math.min(pw,ph),Math.max(3,Math.round(Math.min(pw,ph)/45)));
    }else{const [x0,x1]=extent(spec,'x'),[y0,y1]=extent(spec,'y');xr=limits(x0,x1,Math.max(3,Math.round(pw/80)));yr=limits(y0,y1,Math.max(3,Math.round(ph/42)));}
    const X=v=>box.l+(v-xr.lo)/(xr.hi-xr.lo)*pw,Y=v=>box.b-(v-yr.lo)/(yr.hi-yr.lo)*ph;
    this.map={X,Y,xr,yr,box};
    ctx.lineWidth=1;ctx.strokeStyle=GRID;ctx.beginPath();
    for(const v of ticks(xr)){const x=Math.round(X(v))+.5;ctx.moveTo(x,box.t);ctx.lineTo(x,box.b);}
    for(const v of ticks(yr)){const y=Math.round(Y(v))+.5;ctx.moveTo(box.l,y);ctx.lineTo(box.r,y);}
    ctx.stroke();
    ctx.save();ctx.beginPath();ctx.rect(box.l,box.t,pw,ph);ctx.clip();
    for(const p of spec.patches||[]){const x=X(p.x0),y=Y(p.y1),pw2=X(p.x1)-x,ph2=Y(p.y0)-y;ctx.fillStyle='#d9d9d9';ctx.fillRect(x,y,pw2,ph2);ctx.strokeStyle='#a6a6a6';ctx.strokeRect(x+.5,y+.5,pw2-1,ph2-1);}
    ctx.lineJoin='round';ctx.lineWidth=1.5;
    for(const s of spec.series){ctx.strokeStyle=s.color;ctx.setLineDash(pattern(s.dash));ctx.beginPath();this.trace(s,X,Y,pw);ctx.stroke();}
    ctx.setLineDash([]);
    if(this.cursor!==null)this.drawCursor(X,Y,box);
    ctx.restore();
    ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.strokeRect(box.l+.5,box.t+.5,pw-1,ph-1);
    ctx.font=`10px ${FONT}`;ctx.fillStyle=INK;ctx.beginPath();
    ctx.textAlign='center';ctx.textBaseline='top';
    for(const v of ticks(xr)){const x=Math.round(X(v))+.5;ctx.moveTo(x,box.b);ctx.lineTo(x,box.b-4);ctx.moveTo(x,box.t);ctx.lineTo(x,box.t+4);ctx.fillText(tickLabel(v,xr.step),x,box.b+5);}
    ctx.textAlign='right';ctx.textBaseline='middle';
    for(const v of ticks(yr)){const y=Math.round(Y(v))+.5;ctx.moveTo(box.l,y);ctx.lineTo(box.l+4,y);ctx.moveTo(box.r,y);ctx.lineTo(box.r-4,y);ctx.fillText(tickLabel(v,yr.step),box.l-5,y);}
    ctx.stroke();
    ctx.font=`11px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(spec.xlabel,(box.l+box.r)/2,h-8);
    ctx.save();ctx.translate(14,(box.t+box.b)/2);ctx.rotate(-Math.PI/2);ctx.textBaseline='top';ctx.fillText(spec.ylabel,0,0);ctx.restore();
    ctx.font=`bold 11px ${FONT}`;ctx.textBaseline='alphabetic';ctx.fillText(spec.title,(box.l+box.r)/2,18);
    this.legend(X,Y,box);this.updateTip();
  }
  drawPolar(w,h){
    const {ctx,spec}=this,s=spec.series[0],rmax=spec.rmax,cx=w/2,R=Math.max(20,Math.min(w-90,h-84)/2),cy=42+R,step=niceStep(rmax,4);
    const box={l:cx-R,r:cx+R,t:cy-R,b:cy+R};this.map={polar:true,cx,cy,R,rmax,box};
    ctx.lineWidth=1;ctx.strokeStyle=GRID;ctx.beginPath();
    for(let r=step;r<=rmax+1e-9;r+=step){ctx.moveTo(cx+R*r/rmax,cy);ctx.arc(cx,cy,R*r/rmax,0,Math.PI*2);}
    for(let a=0;a<360;a+=30){const t=a*Math.PI/180;ctx.moveTo(cx,cy);ctx.lineTo(cx+R*Math.cos(t),cy-R*Math.sin(t));}
    ctx.stroke();ctx.strokeStyle=INK;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();
    ctx.font=`10px ${FONT}`;ctx.fillStyle=INK;ctx.textAlign='center';ctx.textBaseline='middle';
    for(let a=0;a<360;a+=30){const t=a*Math.PI/180;ctx.fillText(`${a}°`,cx+(R+16)*Math.cos(t),cy-(R+12)*Math.sin(t));}
    ctx.textAlign='left';for(let r=step;r<=rmax+1e-9;r+=step){const t=80*Math.PI/180;ctx.fillText(tickLabel(r,step),cx+R*r/rmax*Math.cos(t)+3,cy-R*r/rmax*Math.sin(t));}
    ctx.fillStyle=s.color;for(let i=0;i<s.x.length;i++){const t=s.x[i]*Math.PI/180,q=R*s.y[i]/rmax;ctx.fillRect(cx+q*Math.cos(t)-1.5,cy-q*Math.sin(t)-1.5,3,3);}
    if(this.cursor!==null&&this.cursor<s.x.length){const t=s.x[this.cursor]*Math.PI/180,q=R*s.y[this.cursor]/rmax;ctx.beginPath();ctx.arc(cx+q*Math.cos(t),cy-q*Math.sin(t),4,0,Math.PI*2);ctx.fillStyle=s.color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
    ctx.fillStyle=INK;ctx.font=`bold 11px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(spec.title,cx,18);
    if(spec.caption){ctx.font=`10px ${FONT}`;ctx.fillStyle='#6b6b6b';ctx.textAlign='left';ctx.fillText(spec.caption,8,h-8);}
    this.updateTip();
  }
  // Dense series keep their spikes: each pixel column draws its first, min, max and last value.
  trace(s,X,Y,pw){
    const {ctx}=this,n=s.x.length;if(!n)return;
    if(this.spec.kind==='xy'||n<=pw*2||!s.y.every(Number.isFinite)){let pen=false;for(let i=0;i<n;i++){if(!Number.isFinite(s.y[i])){pen=false;continue;}const px=X(s.x[i]),py=Y(s.y[i]);pen?ctx.lineTo(px,py):ctx.moveTo(px,py);pen=true;}return;}
    let col=null,lo,hi,first,last;const flush=()=>{if(col===null)return;ctx.lineTo(col,first);ctx.lineTo(col,lo);ctx.lineTo(col,hi);ctx.lineTo(col,last);};
    ctx.moveTo(X(s.x[0]),Y(s.y[0]));
    for(let i=0;i<n;i++){const c=Math.round(X(s.x[i])),py=Y(s.y[i]);if(c!==col){flush();col=c;lo=hi=first=last=py;}else{if(py<lo)lo=py;if(py>hi)hi=py;last=py;}}
    flush();
  }
  legend(X,Y,box){
    const {ctx,spec}=this,items=[...spec.series,...(spec.patches||[]).map(p=>({label:p.label,patch:true}))];if(items.length<2)return;
    ctx.font=`10px ${FONT}`;const lw=Math.max(...items.map(i=>ctx.measureText(i.label).width))+40,lh=items.length*15+8;
    const corners=[[box.r-lw-7,box.t+7],[box.l+7,box.t+7],[box.r-lw-7,box.b-lh-7],[box.l+7,box.b-lh-7]];let best=corners[0],fewest=Infinity;
    for(const [x,y] of corners){let hits=0;
      for(const p of spec.patches||[])if(X(p.x0)<x+lw&&X(p.x1)>x&&Y(p.y1)<y+lh&&Y(p.y0)>y)hits+=500;
      for(const s of spec.series){const step=Math.max(1,Math.floor(s.x.length/300));for(let i=0;i<s.x.length;i+=step){const px=X(s.x[i]),py=Y(s.y[i]);if(px>=x&&px<=x+lw&&py>=y&&py<=y+lh)hits++;}}if(hits<fewest){fewest=hits;best=[x,y];}}
    const [x,y]=best;ctx.fillStyle='#fff';ctx.fillRect(x,y,lw,lh);ctx.strokeStyle=INK;ctx.lineWidth=.75;ctx.strokeRect(x+.5,y+.5,lw,lh);
    items.forEach((it,i)=>{const cy=y+11+i*15;
      if(it.patch){ctx.fillStyle='#d9d9d9';ctx.fillRect(x+8,cy-4,20,8);ctx.strokeStyle='#a6a6a6';ctx.lineWidth=1;ctx.strokeRect(x+8.5,cy-3.5,19,7);}
      else{ctx.strokeStyle=it.color;ctx.lineWidth=1.5;ctx.setLineDash(pattern(it.dash));ctx.beginPath();ctx.moveTo(x+8,cy);ctx.lineTo(x+28,cy);ctx.stroke();ctx.setLineDash([]);}
      ctx.fillStyle=INK;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(it.label,x+34,cy);});
  }
  drawCursor(X,Y,box){
    const {ctx,spec}=this,i=this.cursor,marks=spec.kind==='xy'?[[spec.series[this.cursorSeries],i]]:spec.series.map(s=>[s,i]);
    if(spec.kind!=='xy'){const x=Math.round(X(spec.series[0].x[i]))+.5;ctx.strokeStyle='#26262699';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,box.t);ctx.lineTo(x,box.b);ctx.stroke();}
    for(const [s,j] of marks){if(!s||j>=s.x.length||!Number.isFinite(s.y[j]))continue;ctx.beginPath();ctx.arc(X(s.x[j]),Y(s.y[j]),4,0,Math.PI*2);ctx.fillStyle=s.color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
  }
  updateTip(){
    const {tip,spec,map}=this;if(this.cursor===null||!map||!spec){tip.hidden=true;return;}
    const i=this.cursor,digits=spec.digits??3,row=(s,value)=>{const r=document.createElement('div'),key=document.createElement('i'),b=document.createElement('b'),name=document.createElement('span');key.style.borderTopColor=s.color;if(s.dash)key.className=Array.isArray(s.dash)?'dot':'dash';b.textContent=value;name.textContent=s.label;r.append(key,b,name);return r;};
    const head=document.createElement('div');head.className='plot-tip-head';let px,rows;
    if(spec.kind==='polar'){const s=spec.series[0];if(!s||i>=s.x.length){tip.hidden=true;return;}head.textContent=`θ = ${s.x[i]}°`;rows=[row(s,`${s.y[i].toFixed(digits)} m`)];px=map.cx+map.R*s.y[i]/map.rmax*Math.cos(s.x[i]*Math.PI/180);}
    else if(spec.kind==='xy'){const s=spec.series[this.cursorSeries];if(!s||i>=s.x.length){tip.hidden=true;return;}head.textContent=`t = ${s.t[i].toFixed(2)} s`;rows=[row(s,`${s.x[i].toFixed(digits)}, ${s.y[i].toFixed(digits)} m`)];px=map.X(s.x[i]);}
    else{const t=spec.series[0].x[i];head.textContent=`t = ${t.toFixed(2)} s`;rows=spec.series.map(s=>row(s,Number.isFinite(s.y[i])?`${s.y[i].toFixed(digits)}${spec.unit?' '+spec.unit:''}`:'no return'));px=map.X(t);}
    tip.replaceChildren(head,...rows);tip.hidden=false;
    const width=tip.offsetWidth;tip.style.left=`${px+14+width>map.box.r?px-14-width:px+14}px`;tip.style.top=`${map.box.t+6}px`;
  }
  setCursor(i){if(i===this.cursor)return;this.cursor=i;this.draw();if(i===null)this.tip.hidden=true;}
  hover(e){
    if(!this.map||!this.spec)return;const r=this.canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,{X,Y,box,xr}=this.map;
    if(this.spec.kind==='polar'){const s=this.spec.series[0],{cx,cy,R,rmax}=this.map;let best=null,bd=Infinity;for(let i=0;i<s.x.length;i++){const a=s.x[i]*Math.PI/180,d=(cx+R*s.y[i]/rmax*Math.cos(a)-px)**2+(cy-R*s.y[i]/rmax*Math.sin(a)-py)**2;if(d<bd){bd=d;best=i;}}return this.setCursor(bd<900?best:null);}
    if(px<box.l-8||px>box.r+8||py<box.t-8||py>box.b+8)return this.setCursor(null);
    if(this.spec.kind==='xy'){
      // Nearest point on any path, so the pointer only has to be closest, not on the line.
      let best=null,bd=Infinity;this.spec.series.forEach((s,si)=>{for(let i=0;i<s.x.length;i++){const d=(X(s.x[i])-px)**2+(Y(s.y[i])-py)**2;if(d<bd){bd=d;best=[si,i];}}});
      if(best){const changed=best[0]!==this.cursorSeries;this.cursorSeries=best[0];if(changed)this.cursor=null;this.setCursor(best[1]);}return;
    }
    const t=this.spec.series[0].x;if(!t.length)return;const target=xr.lo+(px-box.l)/(box.r-box.l)*(xr.hi-xr.lo);let lo=0,hi=t.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(t[mid]<target)lo=mid;else hi=mid;}
    this.setCursor(Math.abs(t[lo]-target)<=Math.abs(t[hi]-target)?lo:hi);
  }
  key(e){
    const n=this.length();if(!n)return;const step=e.shiftKey?10:1,i=this.cursor??n-1;let next=null;
    if(e.key==='ArrowRight')next=Math.min(n-1,i+step);else if(e.key==='ArrowLeft')next=Math.max(0,i-step);else if(e.key==='Home')next=0;else if(e.key==='End')next=n-1;
    else if(e.key==='Escape'){this.setCursor(null);return;}else return;
    e.preventDefault();this.setCursor(next);
  }
}
