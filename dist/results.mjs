// The experiment notebook as a CSV file a teacher can collect: one row per run, oldest first.
// Column names stay English, like the lab's other CSV files; MATLAB: T = readtable('file.csv').
export const RESULT_COLUMNS=['student','run','date','experiment','mission','mission_passed','prediction','mode','robot','terrain','environment','wind','outcome','time_s','odom_error_m','code'];
// RFC 4180: a cell with a comma, quote, or line break is quoted, and quotes inside it are doubled.
const cell=v=>{if(v===null||v===undefined)return '';const s=String(v);return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
export function toResultsCsv(rows){return [RESULT_COLUMNS.join(','),...rows.map(r=>RESULT_COLUMNS.map(c=>cell(r[c])).join(','))].join('\r\n')+'\r\n';}
