// The French review document must match the lab's current texts, so a reviewer never reads stale French.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frenchReview} from '../scripts/french-review.mjs';
import {DICTIONARIES} from '../dist/i18n.mjs';

test('docs/french-review.html is up to date; run npm run review:fr after changing French text',()=>{
  assert.equal(readFileSync(new URL('../docs/french-review.html',import.meta.url),'utf8'),frenchReview());
});

test('the review lists every interface key, and plain texts are escaped',()=>{
  const html=frenchReview();
  for(const key of Object.keys(DICTIONARIES.fr))assert.ok(html.includes(`<td class="key">${key}</td>`),key);
  assert.ok(!html.includes('sensor < N.'),'a plain "<" is escaped');
});
