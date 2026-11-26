
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRelevantJobs } from './filter.mjs';

test('identifies workflow automation signals', () => {
  const result = filterRelevantJobs([
    { title: 'Operations Manager' }
  ]);

  assert.equal(result.length, 1);
  assert.equal(
    result[0].suggestedOpportunity,
    'Workflow automation'
  );
});

test('identifies customer support signals', () => {
  const result = filterRelevantJobs([
    { title: 'Customer Support Specialist' }
  ]);

  assert.equal(
    result[0].suggestedOpportunity,
    'Customer support automation'
  );
});

test('identifies marketing signals', () => {
  const result = filterRelevantJobs([
    { title: 'Marketing Manager' }
  ]);

  assert.equal(
    result[0].suggestedOpportunity,
    'Marketing automation'
  );
});

test('excludes irrelevant and invalid titles', () => {
  const result = filterRelevantJobs([
    { title: 'Software Engineer' },
    { title: 'Security Engineer' },
    { title: null },
    { title: '' }
  ]);

  assert.equal(result.length, 0);
});

test('preserves manual review safeguards', () => {
  const result = filterRelevantJobs([
    {
      company: 'Example Company',
      title: 'Operations Manager'
    }
  ]);

  assert.equal(result[0].company, 'Example Company');
  assert.equal(result[0].status, 'manual review required');
  assert.equal(result[0].outreachAuthorized, false);
});

test('prioritizes specific administrative roles', () => {
  const result = filterRelevantJobs([
    { title: 'Administrative Coordinator' }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].fit, 25);
  assert.equal(
    result[0].suggestedOpportunity,
    'Administrative automation'
  );
});

test('aligns overlapping marketing and operations rules', () => {
  const result = filterRelevantJobs([
    { title: 'Marketing Operations Manager' }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].fit, 15);
  assert.equal(
    result[0].suggestedOpportunity,
    'Marketing automation'
  );
});

test('handles malformed job records safely', () => {
  const result = filterRelevantJobs([
    null,
    undefined,
    123,
    {},
    { title: null },
    { title: 456 }
  ]);

  assert.equal(result.length, 0);
});

test('rejects invalid collection inputs', () => {
  assert.throws(
    () => filterRelevantJobs(null),
    /Jobs must be an array/
  );

  assert.throws(
    () => filterRelevantJobs({}),
    /Jobs must be an array/
  );
});
