import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

mock.module('./sources.mjs', {
  exports: {
    getApprovedSources: () => [{
      provider: 'Greenhouse',
      company: 'Example',
      board: 'example',
      endpoint:
        'https://boards-api.greenhouse.io/v1/boards/example/jobs'
    }]
  }
});

const { runPersistentPipeline } =
  await import('./pipeline.mjs');

const {
  loadOpportunities,
  saveOpportunities
} = await import('./storage.mjs');

async function temporaryStorage(t) {
  const directory = await mkdtemp(
    join(tmpdir(), 'profetix-persistence-')
  );

  t.after(async () => {
    await rm(directory, {
      recursive: true,
      force: true
    });
  });

  return join(directory, 'opportunities.json');
}

function mockJobs(t, ids) {
  return t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      jobs: ids.map(id => ({
        id,
        title: 'Operations Manager',
        absolute_url: `https://example.com/jobs/${id}`,
        updated_at: '2026-11-24T10:00:00Z'
      }))
    })
  }));
}

test('persists newly discovered opportunities', async (t) => {
  const filePath = await temporaryStorage(t);

  mockJobs(t, [123]);

  const result = await runPersistentPipeline(
    'example', 'Example', filePath
  );

  const stored = await loadOpportunities(filePath);

  assert.equal(result.totalCollected, 1);
  assert.equal(result.totalCandidates, 1);
  assert.equal(result.totalStored, 1);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].jobId, 123);
});

test('retains previously stored opportunities', async (t) => {
  const filePath = await temporaryStorage(t);

  await saveOpportunities([{
    company: 'Previous Company',
    jobId: 100,
    score: 40
  }], filePath);

  mockJobs(t, [200]);

  const result = await runPersistentPipeline(
    'example', 'Example', filePath
  );

  const stored = await loadOpportunities(filePath);

  assert.equal(result.totalStored, 2);
  assert.equal(stored.length, 2);
  assert.ok(stored.some(item => item.jobId === 100));
  assert.ok(stored.some(item => item.jobId === 200));
});

test('prevents duplicates across executions', async (t) => {
  const filePath = await temporaryStorage(t);

  mockJobs(t, [123]);

  await runPersistentPipeline(
    'example', 'Example', filePath
  );

  const result = await runPersistentPipeline(
    'example', 'Example', filePath
  );

  assert.equal(result.totalStored, 1);

  const stored = await loadOpportunities(filePath);

  assert.equal(stored.length, 1);
});

test('preserves storage when collection fails', async (t) => {
  const filePath = await temporaryStorage(t);

  await saveOpportunities([{
    company: 'Previous Company',
    jobId: 100,
    score: 40
  }], filePath);

  const before = await readFile(filePath, 'utf8');

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Network unavailable');
  });

  await assert.rejects(
    runPersistentPipeline(
      'example', 'Example', filePath
    ),
    /Network unavailable/
  );

  const after = await readFile(filePath, 'utf8');

  assert.equal(after, before);
});

test('preserves manual verification safeguards', async (t) => {
  const filePath = await temporaryStorage(t);

  await saveOpportunities([{
    company: 'Previous Company',
    jobId: 100,
    score: 40,
    status: 'approved',
    outreachAuthorized: true
  }], filePath);

  mockJobs(t, [123]);

  await runPersistentPipeline(
    'example', 'Example', filePath
  );

  const stored = await loadOpportunities(filePath);

  for (const item of stored) {
    assert.equal(item.outreachAuthorized, false);
    assert.equal(item.status, 'manual review required');
  }
});

test('blocks unapproved sources without modifying storage', async (t) => {
  const filePath = await temporaryStorage(t);

  await saveOpportunities([], filePath);

  const before = await readFile(filePath, 'utf8');

  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => {
      throw new Error('Unexpected network request');
    }
  );

  await assert.rejects(
    runPersistentPipeline(
      'stripe', 'Stripe', filePath
    ),
    /Source is not approved for collection/
  );

  assert.equal(fetchMock.mock.callCount(), 0);

  const after = await readFile(filePath, 'utf8');

  assert.equal(after, before);
});