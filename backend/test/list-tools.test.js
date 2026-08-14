import test from 'node:test';
import assert from 'node:assert/strict';
import { compareText, matchesSearch, normalizeSearch, stableSort } from '../../frontend/app/utils/listTools.mjs';

test('search is case-insensitive, token-based, and ignores accents and spacing', () => {
  assert.equal(normalizeSearch('  LÉO   BB  '), 'leo bb');
  assert.equal(matchesSearch(['Leo BB', 'iPhone 16 Pro Max'], 'leo iphone'), true);
  assert.equal(matchesSearch(['Leo BB', 'iPhone 16 Pro Max'], 'leo samsung'), false);
  assert.equal(matchesSearch([0, 'Unpaid'], '0 unpaid'), true);
});

test('Ethiopian phone searches match local and international formats', () => {
  assert.equal(matchesSearch('+251 923 712 644', '0923712644'), true);
  assert.equal(matchesSearch('0923712644', '+251923712644'), true);
});

test('natural comparison and stable sorting keep deterministic results', () => {
  const tickets = [{ id: 'REP-10', rank: 1 }, { id: 'REP-2', rank: 1 }, { id: 'REP-1', rank: 0 }];
  const sorted = stableSort(tickets, (a, b) => a.rank - b.rank, (item) => item.id);
  assert.deepEqual(sorted.map((item) => item.id), ['REP-1', 'REP-2', 'REP-10']);
  assert.equal(compareText('REP-2', 'REP-10') < 0, true);
});
