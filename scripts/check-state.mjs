import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { pearson } from '../src/data.js';

const events = {};
globalThis.location = { hash: '#year=2025&c=URY,URY,FIN' };
globalThis.history = { replaceState: (_, __, hash) => { location.hash = hash; } };
globalThis.window = { addEventListener: (type, fn) => { events[type] = fn; } };
const store = createStore({ year: 2025, x: 'social', sel: ['URY', 'FIN'] }, {
  years: new Set([2011, 2025]), factors: new Set(['social', 'gdp']),
  regions: new Set(['sas']), countries: new Set(['URY', 'FIN', 'ARG', 'BRA']),
});
assert.deepEqual(store.get().sel, ['URY', 'FIN']);
assert.equal(store.add('ARG'), true);
assert.equal(store.add('BRA'), false);
assert.deepEqual(store.get().sel, ['URY', 'FIN', 'ARG']);
assert.match(store.get().selectionMessage, /Remove one/);
store.toggle('URY');
assert.equal(store.add('BRA'), true);
assert.equal(store.get().selectionMessage, '');
store.set({ year: 2011, x: 'gdp', regions: ['sas'], trails: true });
store.flushUrl();
assert.match(location.hash, /year=2011&x=gdp&r=sas&c=FIN,ARG,BRA&trails=1/);
location.hash = '#year=2025&c=';
events.hashchange();
assert.deepEqual(store.get().sel, []);
store.flushUrl();
assert.equal(Number.isFinite(pearson([1, 1, 1], [2, 3, 4])), false);
assert.equal(Number.isFinite(pearson([1, 2], [2, 3])), false);
console.log('State regression checks passed: selection limit, URL deduplication, immediate sharing, empty selection, undefined correlations.');
