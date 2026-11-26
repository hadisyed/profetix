import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm
} from 'node:fs/promises';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// Profetix Persistent Intelligence Storage v0.2

const defaultPath = fileURLToPath(
  new URL('./data/opportunities.json', import.meta.url)
);

function validateRecords(records) {
  for (const [index, record] of records.entries()) {
    if (
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      typeof record.company !== 'string' ||
      !record.company.trim() ||
      !Number.isSafeInteger(record.jobId) ||
      record.jobId <= 0 ||
      !Number.isFinite(record.score) ||
      record.score < 0 ||
      record.score > 100
    ) {
      throw new Error(
        `Invalid opportunity record at index ${index}`
      );
    }
  }
}

export async function loadOpportunities(
  filePath = defaultPath
) {
  try {
    const content = await readFile(filePath, 'utf8');
    const records = JSON.parse(content);

    if (!Array.isArray(records)) {
      throw new Error('Invalid storage format');
    }

    validateRecords(records);

    return records;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export async function saveOpportunities(
  records,
  filePath = defaultPath
) {
  if (!Array.isArray(records)) {
    throw new Error('Records must be an array');
  }

  validateRecords(records);

  await mkdir(dirname(filePath), {
    recursive: true
  });

  const temporaryPath =
    `${filePath}.${randomUUID()}.tmp`;

  try {
    await writeFile(
      temporaryPath,
      JSON.stringify(records, null, 2),
      { encoding: 'utf8', flag: 'wx' }
    );

    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  return records.length;
}