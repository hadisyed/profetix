
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, assessRelevance } from './scoring.mjs';

test('calculates maximum score correctly', () => {
  assert.equal(calculateScore({
    signal: 30,
    fit: 30,
    recency: 20,
    evidence: 20
  }), 100);
});

test('calculates conservative score correctly', () => {
  assert.equal(calculateScore({
    signal: 30,
    fit: 25,
    recency: 0,
    evidence: 0
  }), 55);
});

test('rejects invalid scoring components', () => {
  const valid = {
    signal: 30,
    fit: 10,
    recency: 0,
    evidence: 0
  };

  for (const fit of [-1, 31, 1.5, '10', undefined]) {
    assert.throws(
      () => calculateScore({ ...valid, fit }),
      /Invalid scoring component/
    );
  }
});

test('differentiates relevance by job title', () => {
  assert.equal(assessRelevance('Administrative Coordinator'), 25);
  assert.equal(assessRelevance('Customer Support Specialist'), 20);
  assert.equal(assessRelevance('Marketing Manager'), 15);
  assert.equal(assessRelevance('Operations Manager'), 10);
});

test('assigns zero relevance to unrelated titles', () => {
  assert.equal(assessRelevance('Software Engineer'), 0);
  assert.equal(assessRelevance(null), 0);
  assert.equal(assessRelevance(''), 0);
});
