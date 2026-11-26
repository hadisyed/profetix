
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

const testEndpoint =
  'https://boards-api.greenhouse.io/v1/boards/example/jobs';

mock.module('./sources.mjs', {
  exports: {
    getApprovedSources: () => [{
      provider: 'Greenhouse',
      company: 'Example',
      board: 'example',
      endpoint: testEndpoint
    }]
  }
});

const { collectJobs } = await import('./collector.mjs');

test('rejects invalid board identifiers', async () => {
  await assert.rejects(
    collectJobs('../invalid', 'Example'),
    /Invalid board identifier/
  );
});

test('normalizes valid job listings', async (t) => {
  const fetchMock = t.mock.method(
    globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => ({
        jobs: [{
          id: 123,
          title: 'Operations Manager',
          absolute_url: 'https://example.com/jobs/123',
          updated_at: '2026-11-24T10:00:00Z'
        }]
      })
    })
  );

  const jobs = await collectJobs('example', 'Example');

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Example');
  assert.equal(jobs[0].jobId, 123);
  assert.equal(jobs[0].type, 'hiring');
  assert.equal(jobs[0].evidence, 'unverified');
  assert.equal(jobs[0].date, undefined);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    testEndpoint
  );
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

test('blocks unapproved sources before network access', async (t) => {
  const fetchMock = t.mock.method(
    globalThis, 'fetch', async () => {
      throw new Error('Unexpected network request');
    }
  );

  await assert.rejects(
    collectJobs('stripe', 'Stripe'),
    /Source is not approved for collection/
  );

  assert.equal(fetchMock.mock.callCount(), 0);
});

test('rejects mismatched company identities', async (t) => {
  const fetchMock = t.mock.method(
    globalThis, 'fetch', async () => {
      throw new Error('Unexpected network request');
    }
  );

  await assert.rejects(
    collectJobs('example', 'Wrong Company'),
    /Source is not approved for collection/
  );

  assert.equal(fetchMock.mock.callCount(), 0);
});

test('does not expose the private network helper', async () => {
  const collector = await import('./collector.mjs');

  assert.deepEqual(Object.keys(collector), ['collectJobs']);
});
