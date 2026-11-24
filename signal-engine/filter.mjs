
import { collectJobs } from './collector.mjs';
import { pathToFileURL } from 'node:url';

export function filterRelevantJobs(jobs) {
  const patterns = [
    {
      pattern: /\b(administrative|administrator|operations)\b/i,
      opportunity: 'Workflow automation'
    },
    {
      pattern: /\b(customer support|customer service)\b/i,
      opportunity: 'Customer support automation'
    },
    {
      pattern: /\b(marketing|content)\b/i,
      opportunity: 'Marketing automation'
    },
    {
      pattern: /\b(data entry|office assistant|coordinator)\b/i,
      opportunity: 'Administrative automation'
    }
  ];

  return jobs.flatMap(job => {
    if (typeof job.title !== 'string') return [];

    const match = patterns.find(
      rule => rule.pattern.test(job.title)
    );

    if (!match) return [];

    return [{
      ...job,
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
