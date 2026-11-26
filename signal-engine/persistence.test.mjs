
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  unlink
} from 'node:fs/promises';

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

const {
  loadExecutionHistory
} = await import('./monitor.mjs');

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

  return {
    filePath: join(directory, 'opportunities.json'),
    monitorPath: join(directory, 'executions.jsonl')
  };
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
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  mockJobs(t, [123]);

  const result = await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const stored = await loadOpportunities(filePath);

  assert.equal(result.totalCollected, 1);
  assert.equal(result.totalCandidates, 1);
  assert.equal(result.totalStored, 1);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].jobId, 123);
});

test('retains previously stored opportunities', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  await saveOpportunities([{
    company: 'Previous Company',
    jobId: 100,
    score: 40
  }], filePath);

  mockJobs(t, [200]);

  const result = await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const stored = await loadOpportunities(filePath);

  assert.equal(result.totalStored, 2);
  assert.equal(stored.length, 2);
  assert.ok(stored.some(item => item.jobId === 100));
  assert.ok(stored.some(item => item.jobId === 200));
});

test('prevents duplicates across executions', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  mockJobs(t, [123]);

  await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const result = await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  assert.equal(result.totalStored, 1);

  const stored = await loadOpportunities(filePath);

  assert.equal(stored.length, 1);
});

test('preserves storage when collection fails', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

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
      'example', 'Example', filePath, monitorPath
    ),
    /Network unavailable/
  );

  const after = await readFile(filePath, 'utf8');

  assert.equal(after, before);
});

test('preserves manual verification safeguards', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  await saveOpportunities([{
    company: 'Previous Company',
    jobId: 100,
    score: 40,
    status: 'approved',
    outreachAuthorized: true
  }], filePath);

  mockJobs(t, [123]);

  await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const stored = await loadOpportunities(filePath);

  for (const item of stored) {
    assert.equal(item.outreachAuthorized, false);
    assert.equal(item.status, 'manual review required');
  }
});

test('blocks unapproved sources without modifying storage', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

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
      'stripe', 'Stripe', filePath, monitorPath
    ),
    /Source is not approved for collection/
  );

  assert.equal(fetchMock.mock.callCount(), 0);

  const after = await readFile(filePath, 'utf8');

  assert.equal(after, before);
});

test('preserves storage when an abandoned lock exists', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  await saveOpportunities([{
    company: 'Previous Company',
    jobId: 100,
    score: 40
  }], filePath);

  const before = await readFile(filePath, 'utf8');

  const lockPath = `${filePath}.lock`;

  await writeFile(lockPath, '{}', 'utf8');

  mockJobs(t, [123]);

  await assert.rejects(
    runPersistentPipeline(
      'example', 'Example', filePath, monitorPath
    ),
    /Storage is locked by another execution/
  );

  assert.equal(
    await readFile(filePath, 'utf8'),
    before
  );

  assert.equal(
    await readFile(lockPath, 'utf8'),
    '{}'
  );
});

test('resumes safely after controlled lock recovery', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  await saveOpportunities([{
    company: 'Example',
    jobId: 123,
    score: 40
  }], filePath);

  const lockPath = `${filePath}.lock`;

  await writeFile(lockPath, '{}', 'utf8');

  mockJobs(t, [123, 456]);

  await assert.rejects(
    runPersistentPipeline(
      'example', 'Example', filePath, monitorPath
    ),
    /Storage is locked by another execution/
  );

  // Remove only the synthetic lock created by this test.
  await unlink(lockPath);

  const result = await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const stored = await loadOpportunities(filePath);

  assert.equal(result.totalStored, 2);
  assert.equal(stored.length, 2);

  assert.deepEqual(
    stored.map(item => item.jobId).sort((a, b) => a - b),
    [123, 456]
  );

  for (const item of stored) {
    assert.equal(item.outreachAuthorized, false);
    assert.equal(item.status, 'manual review required');
  }
});

// Operational monitoring integration tests

test('records successful pipeline execution', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  mockJobs(t, [123, 456]);

  const result = await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const history = await loadExecutionHistory(monitorPath);

  assert.equal(history.length, 2);
  assert.equal(history[0].status, 'started');
  assert.equal(history[1].status, 'succeeded');

  assert.equal(
    history[0].executionId,
    result.executionId
  );

  assert.equal(
    history[1].executionId,
    result.executionId
  );

  assert.equal(history[1].totalCollected, 2);
  assert.equal(history[1].totalCandidates, 2);
  assert.equal(history[1].totalStored, 2);

  assert.ok(
    Number.isSafeInteger(history[1].durationMs)
  );

  assert.ok(history[1].durationMs >= 0);

  assert.equal(result.monitoringStatus, 'complete');
  assert.deepEqual(result.monitoringErrors, []);
});

test('records failed pipeline execution', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Network unavailable');
  });

  await assert.rejects(
    runPersistentPipeline(
      'example', 'Example', filePath, monitorPath
    ),
    /Network unavailable/
  );

  const history = await loadExecutionHistory(monitorPath);

  assert.equal(history.length, 2);
  assert.equal(history[0].status, 'started');
  assert.equal(history[1].status, 'failed');

  assert.equal(
    history[0].executionId,
    history[1].executionId
  );

  assert.ok(
    Number.isSafeInteger(history[1].durationMs)
  );

  assert.ok(history[1].durationMs >= 0);
});

test('maintains distinct execution histories', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  mockJobs(t, [123]);

  const first = await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const second = await runPersistentPipeline(
    'example', 'Example', filePath, monitorPath
  );

  const history = await loadExecutionHistory(monitorPath);

  assert.equal(history.length, 4);

  assert.notEqual(
    first.executionId,
    second.executionId
  );

  assert.deepEqual(
    history.map(item => item.status),
    ['started', 'succeeded', 'started', 'succeeded']
  );

  assert.deepEqual(
    history.map(item => item.executionId),
    [
      first.executionId,
      first.executionId,
      second.executionId,
      second.executionId
    ]
  );
});

test('preserves successful storage when monitoring fails', async (t) => {
  const { filePath, monitorPath } =
    await temporaryStorage(t);

  // Create a file where a monitoring directory is expected.
  await writeFile(monitorPath, 'blocked', 'utf8');

  const invalidMonitorPath = join(
    monitorPath,
    'executions.jsonl'
  );

  mockJobs(t, [123]);

  const result = await runPersistentPipeline(
    'example',
    'Example',
    filePath,
    invalidMonitorPath
  );

  const stored = await loadOpportunities(filePath);

  assert.equal(result.totalStored, 1);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].jobId, 123);

  assert.equal(result.monitoringStatus, 'degraded');

  assert.deepEqual(
    result.monitoringErrors,
    ['started', 'succeeded']
  );

  assert.equal(
    await readFile(monitorPath, 'utf8'),
    'blocked'
  );
});
