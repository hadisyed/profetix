
import { pathToFileURL } from 'node:url';
import { getApprovedSources } from './sources.mjs';

// Profetix Live Signal Collector v0.1

export async function collectJobs(board, company) {
  if (!/^[a-z0-9_-]+$/i.test(board)) {
    throw new Error('Invalid board identifier');
  }

  const endpoint =
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
const approved = getApprovedSources().some(source =>
  source.provider === 'Greenhouse' &&
  source.board === board &&
  source.company === company &&
  source.endpoint === endpoint
);

if (!approved) {
  throw new Error('Source is not approved for collection');
}
  return fetchJobListings(endpoint, company);
}

async function fetchJobListings(endpoint, company) {
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error'
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.jobs)) {
    throw new Error('Invalid API response');
  }

  return data.jobs.map(job => ({
    company,
    jobId: job.id,
    title: job.title,
    source: job.absolute_url,
    updatedAt: job.updated_at,
    collectedAt: new Date().toISOString(),
    type: 'hiring',
    evidence: 'unverified'
  }));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const jobs = await collectJobs('stripe', 'Stripe');

    console.log(`Total jobs collected: ${jobs.length}`);
    console.table(jobs.slice(0, 10).map(job => ({
      company: job.company,
      title: job.title,
      type: job.type,
      updatedAt: job.updatedAt
    })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
