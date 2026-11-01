// The notebook CSV a student hands in: header, one row per run, and quoting that spreadsheets and MATLAB read back.
import test from 'node:test';
import assert from 'node:assert/strict';
import {toResultsCsv,RESULT_COLUMNS} from '../dist/results.mjs';

// A small RFC 4180 reader, written independently of the writer, to check the round trip.
function readCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\r'&&text[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}else cell+=c;}
  return rows;
}

test('the results file has the column header and one row per run, in column order',()=>{
  const csv=toResultsCsv([{student:'Ada',run:1,mode:'tilt',outcome:'Balanced at 25°. Nice work.'},{student:'Ada',run:2,mode:'drive',time_s:'3.10'}]);
  const rows=readCsv(csv);
  assert.deepEqual(rows[0],RESULT_COLUMNS);assert.equal(rows.length,3);
  assert.equal(rows[1][RESULT_COLUMNS.indexOf('outcome')],'Balanced at 25°. Nice work.');
  assert.equal(rows[2][RESULT_COLUMNS.indexOf('time_s')],'3.10');
  assert.equal(rows[1][RESULT_COLUMNS.indexOf('code')],'','missing values are empty cells');
  assert.equal(toResultsCsv([]),RESULT_COLUMNS.join(',')+'\r\n');
});

test('commas, quotes, and multi-line rover scripts survive the round trip',()=>{
  const code='# say "hi", then go\nwhile distance > 0.2\n  drive(0.2, 0)\n  wait(0.05)\nend';
  const outcome='Stopped at line 3: the rover touched the box. Slow down earlier, or turn away sooner.';
  const rows=readCsv(toResultsCsv([{student:'Çağrı, "Ç"',code,outcome}]));
  assert.equal(rows[1][0],'Çağrı, "Ç"');assert.equal(rows[1][RESULT_COLUMNS.indexOf('code')],code);assert.equal(rows[1][RESULT_COLUMNS.indexOf('outcome')],outcome);
  assert.equal(rows[1].length,RESULT_COLUMNS.length);
});
