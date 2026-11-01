// A decorative sky for outdoor scenes: the sun and the moon cross it by the visitor's local clock.
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

// The sky color at the top of the band: night, day, and a warm twilight blended by the sun's height.
export function skyColor(sky){
  const mix=(a,b,k)=>a.map((v,i)=>Math.round(v+(b[i]-v)*k)),day=Math.min(1,sky.sun.altitude*4);
  return mix(mix([34,46,74],[196,219,236],sky.sun.up?.35+.65*day:0),[240,190,150],.55*sky.twilight);
}
const isDark=c=>c[0]*.299+c[1]*.587+c[2]*.114<120;
// Draws the sky as a band over the top h pixels of a scene, fading to transparent at its lower edge, so far ground melts into it.
// Call it after the ground and before any object, so nothing the lab measures is covered. Returns whether the sky is dark.
export function drawSky(ctx,w,h,sky){
  const c=skyColor(sky),g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,`rgb(${c})`);g.addColorStop(.55,`rgba(${c},.85)`);g.addColorStop(1,`rgba(${c},0)`);
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  const place=b=>({x:w*(.06+.88*b.t),y:h*(.72-.55*b.altitude)}),dark=isDark(c);
  if(dark){
    // Fixed stars, so they do not flicker between redraws.
    let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
    ctx.fillStyle='rgba(255,255,255,.75)';for(let i=0;i<60;i++){const x=r()*w,y=r()*h*.6,z=r()<.2?2:1.2;ctx.fillRect(x,y,z,z);}
  }
  if(sky.sun.up){
    const {x,y}=place(sky.sun),g2=ctx.createRadialGradient(x,y,0,x,y,34);
    g2.addColorStop(0,'rgba(255,226,150,.9)');g2.addColorStop(.3,'rgba(255,210,120,.45)');g2.addColorStop(1,'rgba(255,200,110,0)');
    ctx.fillStyle=g2;ctx.beginPath();ctx.arc(x,y,34,0,2*Math.PI);ctx.fill();
    ctx.fillStyle='#ffe3a1';ctx.beginPath();ctx.arc(x,y,10,0,2*Math.PI);ctx.fill();
  }
  if(sky.moon.up&&sky.moon.lit>.02){
    // Opaque colors, so the lit half and the terminator can overlap without a seam.
    const {x,y}=place(sky.moon),R=11,light='#eef1f6',shade=`rgb(${c.map(v=>Math.round(v*.8+10))})`,waxing=sky.moon.phase<.5,k=Math.cos(2*Math.PI*sky.moon.phase);
    ctx.fillStyle=shade;ctx.beginPath();ctx.arc(x,y,R,0,2*Math.PI);ctx.fill();
    // Lit half (right while waxing, left while waning, as seen from the north), then the terminator ellipse adds or removes light.
    ctx.fillStyle=light;ctx.beginPath();ctx.arc(x,y,R,-Math.PI/2,Math.PI/2,!waxing);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.ellipse(x,y,R*Math.abs(k),R,0,0,2*Math.PI);ctx.fillStyle=k>0?shade:light;ctx.fill();
  }
  return dark;
}
