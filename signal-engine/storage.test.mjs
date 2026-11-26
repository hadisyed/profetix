
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

  const first = {
    company: 'Example Company',
    jobId: 1,
    score: 40
  };

  const second = {
    company: 'Example Company',
    jobId: 2,
    score: 55
  };

  await saveOpportunities([first], path);
  await saveOpportunities([second], path);

  assert.deepEqual(
    await loadOpportunities(path),
    [second]
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
test('rejects invalid company names', async (t) => {
  const path = await createTestPath(t);

  for (const company of ['', '   ', null, 123]) {
    await assert.rejects(
      saveOpportunities([{
        company,
        jobId: 1,
        score: 40
      }], path),
      /Invalid opportunity record/
    );
  }
});

test('rejects invalid job identifiers', async (t) => {
  const path = await createTestPath(t);

  for (const jobId of [0, -1, 1.5, '123', null]) {
    await assert.rejects(
      saveOpportunities([{
        company: 'Example',
        jobId,
        score: 40
      }], path),
      /Invalid opportunity record/
    );
  }
});

test('rejects invalid opportunity scores', async (t) => {
  const path = await createTestPath(t);

  for (const score of [-1, 101, NaN, Infinity, '40', null]) {
    await assert.rejects(
      saveOpportunities([{
        company: 'Example',
        jobId: 1,
        score
      }], path),
      /Invalid opportunity record/
    );
  }
});

test('rejects malformed individual records', async (t) => {
  const path = await createTestPath(t);

  for (const record of [null, [], {}, 'invalid']) {
    await assert.rejects(
      saveOpportunities([record], path),
      /Invalid opportunity record/
    );
  }
});

test('rejects malformed records loaded from disk', async (t) => {
  const path = await createTestPath(t);

  await writeFile(
    path,
    JSON.stringify([{ jobId: 1 }]),
    'utf8'
  );

  await assert.rejects(
    loadOpportunities(path),
    /Invalid opportunity record/
  );
});

test('preserves existing storage after invalid save', async (t) => {
  const path = await createTestPath(t);

  const records = [{
    company: 'Example',
    jobId: 1,
    score: 40
  }];

  await saveOpportunities(records, path);

  await assert.rejects(
    saveOpportunities([null], path),
    /Invalid opportunity record/
  );

  assert.deepEqual(
    await loadOpportunities(path),
    records
  );
});
