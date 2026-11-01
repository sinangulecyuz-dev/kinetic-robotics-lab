// The header sky: sun and moon by the local clock, and the moon's phase against known dates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {skyAt,moonPhase,dayLength,drawSky} from '../dist/sky.mjs';

test('the moon phase matches known new and full moons',()=>{
  // New moon 2024-01-11 11:57 UTC, full moon 2024-01-25 17:54 UTC.
  for(const [date,phase] of [[Date.UTC(2024,0,11,11,57),0],[Date.UTC(2024,0,25,17,54),.5]]){
    const m=moonPhase(new Date(date)),d=Math.min(Math.abs(m.phase-phase),1-Math.abs(m.phase-phase));
    assert.ok(d<.02,`${new Date(date).toISOString()}: phase ${m.phase.toFixed(3)}, expected ${phase}`);
  }
  assert.ok(moonPhase(new Date(Date.UTC(2024,0,11,12))).lit<.01&&moonPhase(new Date(Date.UTC(2024,0,25,18))).lit>.99);
});

test('the sun is up at noon and down at midnight, highest near noon, with longer days in June',()=>{
  const at=(m,h,min=0)=>skyAt(new Date(2026,m,15,h,min));
  assert.ok(at(5,12).sun.up&&!at(5,0).sun.up&&at(11,12).sun.up&&!at(11,23).sun.up);
  assert.ok(Math.abs(at(2,12).sun.altitude-1)<.01,'highest at noon');
  assert.ok(at(5,10).sun.altitude<at(5,12).sun.altitude&&at(5,14).sun.altitude<at(5,12).sun.altitude);
  assert.ok(dayLength(new Date(2026,5,21))>15&&dayLength(new Date(2026,11,21))<9);
  assert.ok(at(5,12).sun.t>.45&&at(5,12).sun.t<.55,'noon is mid-arc');
  assert.equal(at(5,0).night,true);
});

test('the full moon is up at midnight and the new moon is not',()=>{
  const full=skyAt(new Date(2024,0,25,23,30)),fresh=skyAt(new Date(2024,0,11,23,30));
  assert.ok(full.moon.up&&full.moon.lit>.95);assert.equal(fresh.moon.up,false);
});

test('drawing works on a minimal canvas at any hour, and reports a dark sky only at night',()=>{
  const calls=[],ctx=new Proxy({},{get:(_,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>calls.push(k),set:()=>true});
  const dark=Array.from({length:24},(_,h)=>drawSky(ctx,800,160,skyAt(new Date(2024,5,21,h,10))));
  assert.ok(calls.includes('arc'));
  assert.equal(dark[13],false,'midday is light');assert.equal(dark[1],true,'1 am is dark');
});
