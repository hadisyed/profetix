
import {
  mkdir,
  open,
  unlink,
  realpath,
  readFile
} from 'node:fs/promises';

import { dirname, basename, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Profetix Execution Lock v0.1

const defaultPath = fileURLToPath(
  new URL('./data/opportunities.json', import.meta.url)
);
export async function inspectStorageLock(
  filePath = defaultPath
) {
  const target = resolve(filePath);

  let metadata;

  try {
    const directory = await realpath(dirname(target));

    const lockPath = join(
      directory,
      `${basename(target)}.lock`
    );

    metadata = JSON.parse(
      await readFile(lockPath, 'utf8')
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { status: 'unlocked' };
    }

    return { status: 'unknown' };
  }

  if (
    !metadata ||
    !Number.isSafeInteger(metadata.pid) ||
    metadata.pid <= 0 ||
    typeof metadata.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(metadata.createdAt))
  ) {
    return { status: 'unknown' };
  }

  try {
    process.kill(metadata.pid, 0);

    return {
      status: 'active',
      pid: metadata.pid
    };
  } catch (error) {
    if (error.code === 'ESRCH') {
      return {
        status: 'potentially-abandoned',
        pid: metadata.pid
      };
    }

    return {
      status: 'unknown',
      pid: metadata.pid
    };
  }
}
export async function withStorageLock(
  operation,
  filePath = defaultPath
) {
  if (typeof operation !== 'function') {
    throw new Error('Operation must be a function');
  }

  const target = resolve(filePath);

  await mkdir(dirname(target), {
    recursive: true
  });

  const directory = await realpath(dirname(target));

  const lockPath = join(
    directory,
    `${basename(target)}.lock`
  );

  let handle;

  try {
    handle = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(
        'Storage is locked by another execution'
      );
    }

    throw error;
  }

  try {
    await handle.writeFile(
      JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString()
      }),
      'utf8'
    );

    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}
