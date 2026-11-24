
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectJobs } from './collector.mjs';

test('rejects invalid board identifiers', async () => {
  await assert.rejects(
    collectJobs('../invalid', 'Example'),
    /Invalid board identifier/
  );
});

test('normalizes valid job listings', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      jobs: [{
        id: 123,
        title: 'Operations Manager',
        absolute_url: 'https://example.com/jobs/123',
        updated_at: '2026-11-24T10:00:00Z'
      }]
    })
  }));

  const jobs = await collectJobs('example', 'Example');

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Example');
  assert.equal(jobs[0].jobId, 123);
  assert.equal(jobs[0].type, 'hiring');
  assert.equal(jobs[0].evidence, 'unverified');
  assert.equal(jobs[0].date, undefined);
});

test('handles API failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 503
  }));

  await assert.rejects(
    collectJobs('example', 'Example'),
    /API request failed: 503/
  );
});

test('rejects malformed API responses', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ invalid: true })
  }));

  await assert.rejects(
    collectJobs('example', 'Example'),
    /Invalid API response/
  );
});

test('handles network failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Network unavailable');
  });

  await assert.rejects(
    collectJobs('example', 'Example'),
    /Network unavailable/
  );
});
