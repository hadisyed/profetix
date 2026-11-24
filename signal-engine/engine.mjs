// Profetix Signal Engine v0.1 — Node.js 20+, no dependencies.
// Usage: node signal-engine/engine.mjs signals.json
// Input: JSON array of manually collected public business signals.
// No network requests, outreach, personal data enrichment or paid APIs.
import { calculateScore } from './scoring.mjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const offers = {
  hiring: [30, 'Administrative workflow automation'],
  expansion: [27, 'Inquiry routing and process automation'],
  launch: [20, 'Marketing and customer intake toolkit']
};
export function evaluate(s, now = Date.now()) {
  if (!s || typeof s.company !== 'string' || !s.company.trim()) throw Error('Company required');
  const url = new URL(s.source);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('HTTPS public source required');
  const date = Date.parse(s.date);
  if (!Number.isFinite(date) || date > now) throw Error('Valid nonfuture publication date required');
  if (!Object.hasOwn(offers,s.type)) throw Error('Unsupported signal type');
  if (!['official','third-party','unverified'].includes(s.evidence)) throw Error('Evidence classification required');
  if (!Number.isInteger(s.fit) || s.fit < 0 || s.fit > 30) throw Error('Fit must be an integer 0–30');
  const age = (now-date)/86400000;
  const recency = age <= 30 ? 20 : age <= 90 ? 12 : 4;
  const evidence = {official:20,'third-party':12,unverified:0}[s.evidence];
  const [signal, offer] = offers[s.type];
  const score = calculateScore({
  signal,
  fit: s.fit,
  recency,
  evidence
});
  const priority = !evidence || age > 90 ? 'verify or refresh' : score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
  return {company:s.company.trim(),source:url.href,date:s.date,type:s.type,score,priority,
    breakdown:{signal,fit:s.fit,recency,evidence},suggestedOffer:offer,
    status:'manual review required',outreachAuthorized:false};
}
export function rank(records, now = Date.now()) {
  if (!Array.isArray(records)) throw Error('Input must be an array');
  const matches = new Map(), rejected = [];
  records.forEach((s,index)=>{
    try {
      const r=evaluate(s,now);
      const key=JSON.stringify([r.company.toLowerCase(),r.source,r.type]);
      if (!matches.has(key) || matches.get(key).score < r.score) matches.set(key,r);
    } catch(e) { rejected.push({index,reason:e.message}); }
  });
  return {opportunities:[...matches.values()].sort((a,b)=>b.score-a.score),rejected};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw Error('Usage: node signal-engine/engine.mjs signals.json');
    console.log(JSON.stringify(rank(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));
  } catch(e) { console.error(e.message); process.exitCode=1; }
}
