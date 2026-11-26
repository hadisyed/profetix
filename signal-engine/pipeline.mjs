
import { calculateScore } from './scoring.mjs';
import { collectJobs } from './collector.mjs';
import { filterRelevantJobs } from './filter.mjs';
import { pathToFileURL } from 'node:url';

import {
  loadOpportunities,
  saveOpportunities
} from './storage.mjs';

import { withStorageLock } from './lock.mjs';
import {
  createExecutionId,
  recordExecution
} from './monitor.mjs';
// // Profetix Intelligence Pipeline v0.3

export function scoreLiveJobs(jobs) {
  const relevant = filterRelevantJobs(jobs);
  const seen = new Set();

  return relevant.flatMap(job => {
    if (
      typeof job.company !== 'string' ||
      !job.company.trim() ||
      !Number.isSafeInteger(job.jobId) ||
      job.jobId <= 0 ||
      typeof job.source !== 'string' ||
      !job.source.trim()
    ) {
      return [];
    }

    try {
      const url = new URL(job.source);

      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password
      ) {
        return [];
      }
    } catch {
      return [];
    }

    const key = JSON.stringify([
      job.company.trim().toLowerCase(),
      job.jobId
    ]);

    if (seen.has(key)) return [];
    seen.add(key);

    const breakdown = {
      signal: 30,
      fit: job.fit,
      recency: 0,
      evidence: 0
    };

    const score = calculateScore(breakdown);

    return [{
      company: job.company,
      jobId: job.jobId,
      title: job.title,
      source: job.source,
      updatedAt: job.updatedAt,
      collectedAt: job.collectedAt,
      publicationDate: null,
      type: 'hiring',
      score,
      breakdown,
      opportunity: job.suggestedOpportunity,
      priority: 'verify or refresh',
      status: 'manual review required',
      outreachAuthorized: false
    }];
  }).sort((a, b) => b.score - a.score);
}

export async function runPipeline(board, company) {
  const jobs = await collectJobs(board, company);
  const opportunities = scoreLiveJobs(jobs);

  return {
    company,
    collectedAt: new Date().toISOString(),
    totalCollected: jobs.length,
    totalCandidates: opportunities.length,
    opportunities
  };
}


export async function runPersistentPipeline(
  board,
  company,
  filePath,
  monitorPath
) {
  const executionId = createExecutionId();
  const startedAt = performance.now();

  const monitoringErrors = [];

  async function logEvent(event) {
    try {
      await recordExecution({
        executionId,
        ...event
      }, monitorPath);
    } catch {
      monitoringErrors.push(event.status);

      console.warn(
        `Execution monitoring unavailable: ${event.status}`
      );
    }
  }

  await logEvent({
    status: 'started'
  });

  let outcome;

  try {
    const result = await runPipeline(board, company);

    outcome = await withStorageLock(async () => {
      const existing = await loadOpportunities(filePath);

      const records = new Map();

      for (const item of [
        ...existing,
        ...result.opportunities
      ]) {
        const key = JSON.stringify([
          item.company.trim().toLowerCase(),
          item.jobId
        ]);

        records.set(key, {
          ...item,
          status: 'manual review required',
          outreachAuthorized: false
        });
      }

      const opportunities = [...records.values()]
        .sort((a, b) => b.score - a.score);

      const totalStored = await saveOpportunities(
        opportunities,
        filePath
      );

      return {
        ...result,
        totalStored
      };
    }, filePath);

  } catch (error) {
    await logEvent({
      status: 'failed',
      durationMs: Math.round(
        performance.now() - startedAt
      )
    });

    throw error;
  }

  await logEvent({
    status: 'succeeded',
    durationMs: Math.round(
      performance.now() - startedAt
    ),
    totalCollected: outcome.totalCollected,
    totalCandidates: outcome.totalCandidates,
    totalStored: outcome.totalStored
  });

  return {
    ...outcome,
    executionId,
    monitoringStatus:
      monitoringErrors.length === 0
        ? 'complete'
        : 'degraded',
    monitoringErrors
  };
}


if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await runPipeline('stripe', 'Stripe');

    console.log(`Company: ${result.company}`);
    console.log(`Collected: ${result.totalCollected}`);
    console.log(`Candidates: ${result.totalCandidates}`);

    console.table(
      result.opportunities.slice(0, 15).map(item => ({
        company: item.company,
        title: item.title,
        score: item.score,
        opportunity: item.opportunity
      }))
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
