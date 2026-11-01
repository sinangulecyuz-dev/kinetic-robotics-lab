// A decorative sky for the header: the sun and the moon cross it by the visitor's local clock.
// It is an approximation for a mid-northern latitude (about 43° N), not an astronomical model, and it touches no lab data.
// Pure functions, so tests can check them: skyAt(date) returns where to draw, drawSky draws it on a 2D canvas.

const DAY=864e5,SYNODIC=29.530588853;
// A known new moon: 2000-01-06 18:14 UTC.
const NEW_MOON=Date.UTC(2000,0,6,18,14);

// Moon phase from 0 (new) through 0.5 (full) to 1, and the lit fraction of its disc.
export function moonPhase(date){
  const p=(((date.getTime()-NEW_MOON)/DAY/SYNODIC)%1+1)%1;
  return {phase:p,lit:(1-Math.cos(2*Math.PI*p))/2};
}

// Day length swings ±3.4 h around 12 h over the year, longest near 21 June; solar noon is taken as 12:00 local time.
export function dayLength(date){
  const start=new Date(date.getFullYear(),0,1),doy=(date-start)/DAY;
  return 12+3.4*Math.sin(2*Math.PI*(doy-80)/365.25);
}

// Where a body is on its arc: t runs 0 (rising, left) to 1 (setting, right), altitude is sin(πt) while up.
const arc=(hour,rise,length)=>{const t=(((hour-rise)%24)+24)%24/length;return t>=0&&t<=1?{up:true,t,altitude:Math.sin(Math.PI*t)}:{up:false,t,altitude:0};};

export function skyAt(date){
  const hour=date.getHours()+date.getMinutes()/60+date.getSeconds()/3600,L=dayLength(date);
  const sun=arc(hour,12-L/2,L),moon=moonPhase(date);
  // The moon crosses the sky about 50 minutes later each day: due south at 12:00 when new, at 00:00 when full.
  const transit=(12+24*moon.phase)%24,moonArc=arc(hour,transit-6,12);
  // Twilight: how close the sun is to the horizon, 1 at rising or setting, 0 an hour or more away.
  const fromEdge=Math.min(Math.abs(hour-(12-L/2)),Math.abs(hour-(12+L/2))),twilight=Math.max(0,1-fromEdge);
  return {hour,sun,moon:{...moonArc,...moon},night:!sun.up,twilight};
}

// Draws on a canvas that covers the header. Colors stay soft so the logo and controls keep their contrast.
export function drawSky(ctx,w,h,sky){
  ctx.clearRect(0,0,w,h);
  if(sky.twilight>0){const g=ctx.createLinearGradient(0,h,0,h*.2);g.addColorStop(0,`rgba(244,158,104,${.22*sky.twilight})`);g.addColorStop(1,'rgba(244,158,104,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  const place=b=>({x:w*(.04+.92*b.t),y:h*.92-b.altitude*h*.62});
  if(sky.night){
    // A few faint stars at fixed places, so they do not flicker between redraws.
    let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
    ctx.fillStyle='rgba(255,255,255,.35)';for(let i=0;i<40;i++){const x=r()*w,y=r()*h*.8;ctx.fillRect(x,y,1,1);}
  }
  if(sky.sun.up){
    const {x,y}=place(sky.sun),g=ctx.createRadialGradient(x,y,0,x,y,22);
    g.addColorStop(0,'rgba(255,214,128,.55)');g.addColorStop(.35,'rgba(255,200,110,.35)');g.addColorStop(1,'rgba(255,190,100,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,22,0,2*Math.PI);ctx.fill();
    ctx.fillStyle='rgba(255,220,140,.85)';ctx.beginPath();ctx.arc(x,y,6,0,2*Math.PI);ctx.fill();
  }
  if(sky.moon.up&&sky.moon.lit>.02){
    // Opaque colors, so the lit half and the terminator can overlap without a seam.
    const {x,y}=place(sky.moon),R=7,light='#dfe4ee',dark='#273046',waxing=sky.moon.phase<.5,k=Math.cos(2*Math.PI*sky.moon.phase);
    ctx.fillStyle=dark;ctx.beginPath();ctx.arc(x,y,R,0,2*Math.PI);ctx.fill();
    // Lit half (right while waxing, left while waning, as seen from the north), then the terminator ellipse adds or removes light.
    ctx.fillStyle=light;ctx.beginPath();ctx.arc(x,y,R,-Math.PI/2,Math.PI/2,!waxing);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.ellipse(x,y,R*Math.abs(k),R,0,0,2*Math.PI);
    if(k>0){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fill();ctx.restore();ctx.fillStyle=dark;ctx.fill();}else{ctx.fillStyle=light;ctx.fill();}
  }
}
