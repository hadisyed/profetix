
import { collectJobs } from './collector.mjs';
import { pathToFileURL } from 'node:url';
import { assessOpportunity } from './scoring.mjs';

export function filterRelevantJobs(jobs) {
  if (!Array.isArray(jobs)) {
    throw new Error('Jobs must be an array');
  }

  return jobs.flatMap(job => {
    if (!job || typeof job !== 'object') {
      return [];
    }

    const match = assessOpportunity(job.title);

    if (!match) return [];

    return [{
      ...job,
      fit: match.fit,
      suggestedOpportunity: match.opportunity,
      status: 'manual review required',
      outreachAuthorized: false
    }];
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const jobs = await collectJobs('stripe', 'Stripe');
    const relevant = filterRelevantJobs(jobs);

    console.log(`Total jobs: ${jobs.length}`);
    console.log(`Potentially relevant: ${relevant.length}`);
    console.log(`Filtered out: ${jobs.length - relevant.length}`);

    console.table(relevant.slice(0, 15).map(job => ({
      company: job.company,
      title: job.title,
      opportunity: job.suggestedOpportunity
    })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
