
import {
  mkdir,
  appendFile,
  readFile
} from 'node:fs/promises';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// Profetix Operational Monitoring v0.1

const defaultPath = fileURLToPath(
  new URL('./data/executions.jsonl', import.meta.url)
);

const validStatuses = new Set([
  'started',
  'succeeded',
  'failed'
]);

export function createExecutionId() {
  return randomUUID();
}

export async function recordExecution(
  event,
  filePath = defaultPath
) {
  if (
    !event ||
    typeof event.executionId !== 'string' ||
    !event.executionId.trim() ||
    !validStatuses.has(event.status)
  ) {
    throw new Error('Invalid execution event');
  }

  const record = {
    executionId: event.executionId,
    timestamp: new Date().toISOString(),
    status: event.status
  };

  for (const field of [
    'durationMs',
    'totalCollected',
    'totalCandidates',
    'totalStored'
  ]) {
    if (event[field] !== undefined) {
      if (
        !Number.isSafeInteger(event[field]) ||
        event[field] < 0
      ) {
        throw new Error(
          `Invalid execution metric: ${field}`
        );
      }

      record[field] = event[field];
    }
  }

  await mkdir(dirname(filePath), {
    recursive: true
  });

  await appendFile(
    filePath,
    JSON.stringify(record) + '\n',
    'utf8'
  );

  return record;
}

export async function loadExecutionHistory(
  filePath = defaultPath
) {
  try {
    const content = await readFile(
      filePath,
      'utf8'
    );

    return content
      .split(/\r?\n/)
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}
