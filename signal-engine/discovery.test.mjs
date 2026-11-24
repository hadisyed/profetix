
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySignal, discover } from './discovery.mjs';

test('identifies hiring signals', () => {
  assert.equal(classifySignal('Hiring administrative staff'), 'hiring');
});

test('identifies expansion signals', () => {
  assert.equal(classifySignal('Expanding into a new location'), 'expansion');
});

test('identifies launch signals', () => {
  assert.equal(classifySignal('Launching a new product'), 'launch');
});

test('ignores irrelevant or invalid text', () => {
  assert.equal(classifySignal('General company information'), null);
  assert.equal(classifySignal(null), null);
  assert.equal(classifySignal(''), null);
});

test('discovered signals require verification', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');

  const result = discover([
    {
      company: 'Example Realty',
      title: 'Hiring administrative staff',
      source: 'https://example.com/hiring',
      date: '2026-11-24T10:00:00Z'
    }
  ], now);

  assert.equal(result.opportunities.length, 1);

  const opportunity = result.opportunities[0];

  assert.equal(opportunity.score, 60);
  assert.equal(opportunity.priority, 'verify or refresh');
  assert.equal(opportunity.outreachAuthorized, false);
  assert.equal(result.rejected.length, 0);
});
