
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mkdtemp,
  rm,
  readFile,
  writeFile
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createExecutionId,
  recordExecution,
  loadExecutionHistory
} from './monitor.mjs';

async function temporaryHistory(t) {
  const directory = await mkdtemp(
    join(tmpdir(), 'profetix-monitor-')
  );

  t.after(async () => {
    await rm(directory, {
      recursive: true,
      force: true
    });
  });

  return join(directory, 'executions.jsonl');
}

test('generates unique execution identifiers', () => {
  const first = createExecutionId();
  const second = createExecutionId();

  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );

  assert.notEqual(first, second);
});

test('returns empty history when storage is missing', async (t) => {
  const path = await temporaryHistory(t);

  assert.deepEqual(
    await loadExecutionHistory(path),
    []
  );
});

test('records execution start', async (t) => {
  const path = await temporaryHistory(t);
  const executionId = createExecutionId();

  await recordExecution({
    executionId,
    status: 'started'
  }, path);

  const history = await loadExecutionHistory(path);

  assert.equal(history.length, 1);
  assert.equal(history[0].executionId, executionId);
  assert.equal(history[0].status, 'started');

  assert.ok(
    Number.isFinite(Date.parse(history[0].timestamp))
  );
});

test('records successful execution metrics', async (t) => {
  const path = await temporaryHistory(t);

  await recordExecution({
    executionId: createExecutionId(),
    status: 'succeeded',
    durationMs: 120,
    totalCollected: 20,
    totalCandidates: 5,
    totalStored: 10
  }, path);

  const [record] = await loadExecutionHistory(path);

  assert.equal(record.status, 'succeeded');
  assert.equal(record.durationMs, 120);
  assert.equal(record.totalCollected, 20);
  assert.equal(record.totalCandidates, 5);
  assert.equal(record.totalStored, 10);
});

test('records failed execution', async (t) => {
  const path = await temporaryHistory(t);

  await recordExecution({
    executionId: createExecutionId(),
    status: 'failed',
    durationMs: 50
  }, path);

  const [record] = await loadExecutionHistory(path);

  assert.equal(record.status, 'failed');
  assert.equal(record.durationMs, 50);
});

test('preserves execution history across writes', async (t) => {
  const path = await temporaryHistory(t);
  const executionId = createExecutionId();

  await recordExecution({
    executionId,
    status: 'started'
  }, path);

  await recordExecution({
    executionId,
    status: 'succeeded'
  }, path);

  const history = await loadExecutionHistory(path);

  assert.equal(history.length, 2);

  assert.deepEqual(
    history.map(item => item.status),
    ['started', 'succeeded']
  );

  assert.ok(
    history.every(item => item.executionId === executionId)
  );
});

test('rejects invalid execution events', async (t) => {
  const path = await temporaryHistory(t);

  for (const event of [
    null,
    {},
    { executionId: '', status: 'started' },
    { executionId: 'test', status: 'invalid' }
  ]) {
    await assert.rejects(
      recordExecution(event, path),
      /Invalid execution event/
    );
  }

  assert.deepEqual(
    await loadExecutionHistory(path),
    []
  );
});

test('rejects invalid metrics without modifying history', async (t) => {
  const path = await temporaryHistory(t);
  const executionId = createExecutionId();

  await recordExecution({
    executionId,
    status: 'started'
  }, path);

  const before = await readFile(path, 'utf8');

  for (const value of [-1, 1.5, NaN, '10']) {
    await assert.rejects(
      recordExecution({
        executionId,
        status: 'succeeded',
        totalCollected: value
      }, path),
      /Invalid execution metric/
    );
  }

  assert.equal(
    await readFile(path, 'utf8'),
    before
  );
});

test('excludes sensitive and unexpected fields', async (t) => {
  const path = await temporaryHistory(t);

  await recordExecution({
    executionId: createExecutionId(),
    status: 'failed',
    apiKey: 'secret-value',
    email: 'private@example.com',
    error: 'sensitive-error-details'
  }, path);

  const content = await readFile(path, 'utf8');

  assert.ok(!content.includes('secret-value'));
  assert.ok(!content.includes('private@example.com'));
  assert.ok(!content.includes('sensitive-error-details'));
});

test('rejects corrupted execution history', async (t) => {
  const path = await temporaryHistory(t);

  await writeFile(path, '{invalid\n', 'utf8');

  await assert.rejects(
    loadExecutionHistory(path),
    SyntaxError
  );
});
