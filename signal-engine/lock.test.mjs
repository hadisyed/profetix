
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtemp,
  readdir,
  writeFile,
  rm
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  withStorageLock,
  inspectStorageLock
} from './lock.mjs';

async function createTestPath(t) {
  const directory = await mkdtemp(
    join(tmpdir(), 'profetix-lock-')
  );

  t.after(async () => {
    await rm(directory, {
      recursive: true,
      force: true
    });
  });

  return join(directory, 'opportunities.json');
}

test('executes operation under exclusive lock', async (t) => {
  const path = await createTestPath(t);

  const result = await withStorageLock(
    async () => 'success',
    path
  );

  assert.equal(result, 'success');
});

test('rejects overlapping executions', async (t) => {
  const path = await createTestPath(t);

  let release;
  let entered;

  const gate = new Promise(resolve => {
    release = resolve;
  });

  const ready = new Promise(resolve => {
    entered = resolve;
  });

  const first = withStorageLock(async () => {
    entered();
    await gate;
  }, path);

  await Promise.race([ready, first]);

  try {
    await assert.rejects(
      withStorageLock(async () => {}, path),
      /Storage is locked by another execution/
    );
  } finally {
    release();
    await first;
  }
});

test('releases lock after successful execution', async (t) => {
  const path = await createTestPath(t);

  await withStorageLock(async () => {}, path);

  const files = await readdir(join(path, '..'));

  assert.deepEqual(files, []);
});

test('releases lock after failed execution', async (t) => {
  const path = await createTestPath(t);

  await assert.rejects(
    withStorageLock(async () => {
      throw new Error('Operation failed');
    }, path),
    /Operation failed/
  );

  const result = await withStorageLock(
    async () => 'recovered',
    path
  );

  assert.equal(result, 'recovered');
});

test('rejects invalid operations', async (t) => {
  const path = await createTestPath(t);

  await assert.rejects(
    withStorageLock(null, path),
    /Operation must be a function/
  );
});

test('preserves existing abandoned locks', async (t) => {
  const path = await createTestPath(t);

  await writeFile(`${path}.lock`, '{}', 'utf8');

  await assert.rejects(
    withStorageLock(async () => {}, path),
    /Storage is locked by another execution/
  );

  const files = await readdir(join(path, '..'));

  assert.deepEqual(files, ['opportunities.json.lock']);
});
test('reports missing lock as unlocked', async (t) => {
  const path = await createTestPath(t);

  assert.deepEqual(
    await inspectStorageLock(path),
    { status: 'unlocked' }
  );
});

test('identifies an active execution lock', async (t) => {
  const path = await createTestPath(t);

  await withStorageLock(async () => {
    const result = await inspectStorageLock(path);

    assert.equal(result.status, 'active');
    assert.equal(result.pid, process.pid);
  }, path);
});

test('reports corrupted lock metadata as unknown', async (t) => {
  const path = await createTestPath(t);

  await writeFile(`${path}.lock`, '{invalid', 'utf8');

  assert.deepEqual(
    await inspectStorageLock(path),
    { status: 'unknown' }
  );
});

test('rejects invalid lock metadata', async (t) => {
  const path = await createTestPath(t);

  await writeFile(
    `${path}.lock`,
    JSON.stringify({
      pid: -1,
      createdAt: 'invalid'
    }),
    'utf8'
  );

  assert.deepEqual(
    await inspectStorageLock(path),
    { status: 'unknown' }
  );
});

test('inspection does not remove existing locks', async (t) => {
  const path = await createTestPath(t);

  await writeFile(`${path}.lock`, '{}', 'utf8');

  await inspectStorageLock(path);

  assert.deepEqual(
    await readdir(join(path, '..')),
    ['opportunities.json.lock']
  );
});
test('detects a lock left by a terminated process', {
  timeout: 10000
}, async (t) => {
  const path = await createTestPath(t);

  const child = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000)'],
    { stdio: 'ignore' }
  );

  const exited = once(child, 'exit');

  t.after(async () => {
    if (child.exitCode === null &&
        child.signalCode === null) {
      child.kill();
      await exited;
    }
  });

  await once(child, 'spawn');

  await writeFile(
    `${path}.lock`,
    JSON.stringify({
      pid: child.pid,
      createdAt: new Date().toISOString()
    }),
    'utf8'
  );

  const active = await inspectStorageLock(path);

  assert.equal(active.status, 'active');

  child.kill();
  await exited;

  const abandoned = await inspectStorageLock(path);

  assert.equal(
    abandoned.status,
    'potentially-abandoned'
  );

  assert.deepEqual(
    await readdir(join(path, '..')),
    ['opportunities.json.lock']
  );
});