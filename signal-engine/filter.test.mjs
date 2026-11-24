
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRelevantJobs } from './filter.mjs';

test('identifies workflow automation signals', () => {
  const result = filterRelevantJobs([
    { title: 'Administrative Coordinator' }
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
