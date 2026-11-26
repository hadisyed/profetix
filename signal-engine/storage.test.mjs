
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  readdir,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadOpportunities,
  saveOpportunities
} from './storage.mjs';

async function createTestPath(t) {
  const directory = await mkdtemp(
    join(tmpdir(), 'profetix-storage-')
  );

  t.after(async () => {
    await rm(directory, {
      recursive: true,
      force: true
    });
  });

  return join(directory, 'opportunities.json');
}

test('returns empty array when storage is missing', async (t) => {
  const path = await createTestPath(t);

  assert.deepEqual(
    await loadOpportunities(path),
    []
  );
});

test('saves and retrieves opportunities', async (t) => {
  const path = await createTestPath(t);

  const records = [{
    company: 'Example Company',
    jobId: 123,
    score: 55,
    status: 'manual review required',
    outreachAuthorized: false
  }];

  assert.equal(
    await saveOpportunities(records, path),
    1
  );

  assert.deepEqual(
    await loadOpportunities(path),
    records
  );
});

test('replaces existing storage successfully', async (t) => {
  const path = await createTestPath(t);

  await saveOpportunities([{ jobId: 1 }], path);
  await saveOpportunities([{ jobId: 2 }], path);

  assert.deepEqual(
    await loadOpportunities(path),
    [{ jobId: 2 }]
  );
});

test('rejects invalid storage input', async (t) => {
  const path = await createTestPath(t);

  await assert.rejects(
    saveOpportunities({}, path),
    /Records must be an array/
  );
});

test('rejects invalid stored data format', async (t) => {
  const path = await createTestPath(t);

  await writeFile(path, '{}', 'utf8');

  await assert.rejects(
    loadOpportunities(path),
    /Invalid storage format/
  );
});

test('rejects corrupted JSON storage', async (t) => {
  const path = await createTestPath(t);

  await writeFile(path, '{invalid', 'utf8');

  await assert.rejects(
    loadOpportunities(path),
    SyntaxError
  );
});

test('removes temporary files after saving', async (t) => {
  const path = await createTestPath(t);

  await saveOpportunities([], path);

  const files = await readdir(join(path, '..'));

  assert.deepEqual(
    files,
    ['opportunities.json']
  );
});
