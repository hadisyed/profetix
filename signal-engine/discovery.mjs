
import { rank } from './engine.mjs';
import { pathToFileURL } from 'node:url';

// Profetix Signal Discovery v0.1

export function classifySignal(text) {
  if (typeof text !== 'string') return null;

  const content = text.toLowerCase();

  if (/\b(hiring|recruiting|job openings|vacancies)\b/.test(content)) {
    return 'hiring';
  }

  if (/\b(expansion|expanding|new office|new location)\b/.test(content)) {
    return 'expansion';
  }

  if (/\b(launch|launching|new product|new service)\b/.test(content)) {
    return 'launch';
  }

  return null;
}

export function discover(records, now = Date.now()) {
  const signals = [];

  for (const record of records) {
    const type = classifySignal(record.title);

    if (!type) continue;

    signals.push({
      company: record.company,
      source: record.source,
      date: record.date,
      type,
      evidence: 'unverified',
      fit: 10
    });
  }

  return rank(signals, now);
}

// Local demonstration using fictional companies.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const date = new Date().toISOString();

  const records = [
    {
      company: 'Example Realty',
      title: 'Hiring administrative staff',
      source: 'https://example.com/hiring',
      date
    },
    {
      company: 'Example Logistics',
      title: 'Expanding into a new location',
      source: 'https://example.com/expansion',
      date
    },
    {
      company: 'Example Retail',
      title: 'Launching a new product',
      source: 'https://example.com/launch',
      date
    }
  ];

  console.log(
    JSON.stringify(discover(records), null, 2)
  );
}
