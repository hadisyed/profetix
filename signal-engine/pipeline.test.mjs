
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLiveJobs } from './pipeline.mjs';

const sample = {
  company: 'Example Company',
  jobId: 123,
  title: 'Operations Manager',
  source: 'https://example.com/jobs/123',
  updatedAt: '2026-11-24T10:00:00Z'
};

test('assigns conservative preliminary score', () => {
  const result = scoreLiveJobs([sample]);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 40);
});

test('does not confuse update and publication dates', () => {
  const result = scoreLiveJobs([sample]);

  assert.equal(result[0].publicationDate, null);
  assert.equal(result[0].breakdown.recency, 0);
});

test('removes duplicate job listings', () => {
  const result = scoreLiveJobs([sample, sample]);

  assert.equal(result.length, 1);
});

test('rejects unsafe sources and missing identifiers', () => {
  const result = scoreLiveJobs([
    { ...sample, source: 'http://example.com' },
    { ...sample, source: 'invalid-url' },
    { ...sample, jobId: null }
  ]);

  assert.equal(result.length, 0);
});

test('excludes irrelevant job listings', () => {
  const result = scoreLiveJobs([
    { ...sample, title: 'Software Engineer' }
  ]);

  assert.equal(result.length, 0);
});

test('preserves manual verification safeguards', () => {
  const result = scoreLiveJobs([sample]);

  assert.equal(result[0].outreachAuthorized, false);
  assert.equal(result[0].status, 'manual review required');
  assert.equal(result[0].priority, 'verify or refresh');
  assert.equal(result[0].breakdown.evidence, 0);
});
