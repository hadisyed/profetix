# Profetix Signal Engine v0.1
Built for Tomorrow

Dependency-free Node.js 20+ qualification core. No API keys or paid services.
Run from repository root:
```sh
node --test signal-engine/engine.test.mjs
node signal-engine/engine.mjs signals.json
```
Input is a JSON array. Example (fictional; not a verified opportunity):
```json
[{"company":"Example Realty","source":"https://example.com/news","date":"2026-11-10","type":"hiring","evidence":"official","fit":25}]
```
Allowed types: hiring, expansion, launch. Evidence: official, third-party, unverified. Fit: integer 0–30, manually justified. Use a real public source and publication date for actual records. The example will age out of high priority.
Output is ranked JSON with source, breakdown, suggested offer, rejected records and manual-review status. Exact company/source/type duplicates collapse; cross-source duplicates still need review.
Source URL validation is syntactic only; the engine does not verify source content or independently assess fit. Never treat a public signal as buying intent or permission to contact. Do not include personal details, private URLs or credentials.
Next: permitted feed discovery, local/private storage, verification and review dashboard. Do not publish real lead datasets in this repository. No automated outreach.
