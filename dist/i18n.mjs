// Interface language. The dictionaries hold visible text only: rover script keywords, sensor names,
// and CSV columns stay in English, like a real programming language. Decimals always use a point.
import en from './lang/en.mjs';
import tr from './lang/tr.mjs';
import fr from './lang/fr.mjs';

export const LANGUAGES={en:'English',tr:'Türkçe',fr:'Français'};
export const DICTIONARIES={en,tr,fr};
let current='en';
export const language=()=>current;
export function setLanguage(l){current=DICTIONARIES[l]?l:'en';return current;}
// The first supported language in a browser preference list such as navigator.languages.
export function preferredLanguage(list=[]){for(const l of list){const code=String(l).slice(0,2).toLowerCase();if(DICTIONARIES[code])return code;}return 'en';}
// {name} is filled from params. A key missing from a translation falls back to English.
export function t(key,params={}){
  const s=DICTIONARIES[current][key]??en[key]??String(key);
  return s.replace(/\{(\w+)\}/g,(m,k)=>k in params?String(params[k]):m);
}
