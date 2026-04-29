# SevaSetu AI — Judge Mode Delivery

**Positioning (one sentence):**
*SevaSetu AI is an event-driven, offline-first PWA running multimodal Gemini extraction, dense semantic vector matching with a deterministic constraint solver, ACID-transactional dispatch, and a BigQuery-ready analytics layer — every AI decision auditable, every assignment provably conflict-free.*

---

## 1. Changelog (this branch)

### New files
| File | Purpose |
| --- | --- |
| [src/lib/auth/withAuth.ts](src/lib/auth/withAuth.ts) | `withAuth` / `withRoles` wrappers — verifies Firebase ID tokens server-side. Dev bypass via `AUTH_DEV_BYPASS=true`. |
| [src/lib/ai/requestSchemas.ts](src/lib/ai/requestSchemas.ts) | Centralized Zod schemas for **every** API route's request body. |
| [src/lib/ai/audit.ts](src/lib/ai/audit.ts) | `recordAiAudit` / `timedAi` — writes one row per Gemini call into `ai_audit` (model, prompt version, latency, validation result, cost estimate). |
| [src/lib/ai/embeddings.ts](src/lib/ai/embeddings.ts) | `embedText` (text-embedding-004), `cosineSimilarity`, `lexicalSimilarity` (Jaccard fallback), summary builders for reports & volunteers. |
| [src/lib/matching/semantic.ts](src/lib/matching/semantic.ts) | `semanticRankVolunteers` — hybrid ranker: 0.55*semantic + 0.30*constraint + 0.15*proximity. Falls back from vector → lexical when API unavailable. |
| [src/lib/firebase/authFetch.ts](src/lib/firebase/authFetch.ts) | Client wrapper that auto-attaches `Authorization: Bearer <idToken>` to every protected `fetch`. |

### Rewritten / hardened files
| File | What changed |
| --- | --- |
| [src/lib/scoring/urgency-v2.ts](src/lib/scoring/urgency-v2.ts) | Added `LocalityFeatures` + `computeBaseUrgency(features)` confidence-weighted engine alongside legacy export. |
| [src/lib/maps/geohash.ts](src/lib/maps/geohash.ts) | Real Niemeyer base32 geohash + `neighborCells()` (9-cell ring) + `haversineKm`. Was previously a `geo_${lat}_${lng}` string. |
| [src/lib/matching/constraints.ts](src/lib/matching/constraints.ts) | Real CSP solver — hard filter returns `{ kept[], rejected[] with reasons }`; `softScore` returns 0..1 + reason strings. |
| [src/lib/db/transactions.ts](src/lib/db/transactions.ts) | Canonicalized on `availability` enum; migration-safe reads of legacy `status`; added `releaseVolunteerTransaction`. |
| [src/lib/firebase/config.ts](src/lib/firebase/config.ts) | Build-safe placeholders so static prerender passes without secrets. |
| [src/app/api/ai/extract/route.ts](src/app/api/ai/extract/route.ts) | **Multimodal** Gemini extraction — accepts `attachments[{storageUri \| url, mimeType}]`, uses `fileData`/`inlineData` parts. Writes `geohash6` + `embedding` + audit row. |
| [src/app/api/allocation/recommend/route.ts](src/app/api/allocation/recommend/route.ts) | Full rewrite — auth + Zod + geohash neighbor prefilter + semantic ranker + LLM rerank + audit row + 409 conflict semantics. |
| [src/app/api/allocation/assign/route.ts](src/app/api/allocation/assign/route.ts) | Auth + Zod + transactional assignment + 409 on already-assigned/unavailable. |
| [src/app/api/operations/dispense/route.ts](src/app/api/operations/dispense/route.ts) | `withRoles([COORDINATOR, PHARMACIST, DOCTOR])` + Zod + 409 on insufficient stock. |
| [src/app/api/matching/dispatch/route.ts](src/app/api/matching/dispatch/route.ts) | Auth + Zod + `assignVolunteerTransaction` + 409 conflict. |
| [src/app/api/matching/recommend/route.ts](src/app/api/matching/recommend/route.ts) | Replaced old ranker with `semanticRankVolunteers`. |
| [src/app/api/scoring/recompute/route.ts](src/app/api/scoring/recompute/route.ts) | Wired to new `LocalityFeatures` engine. |
| [src/app/api/workbench/approve/route.ts](src/app/api/workbench/approve/route.ts) + [review/route.ts](src/app/api/workbench/review/route.ts) | `withRoles([COORDINATOR])` + Zod + records `humanReviewerUid`. |
| [src/app/api/ai/score/route.ts](src/app/api/ai/score/route.ts) / [recommend/route.ts](src/app/api/ai/recommend/route.ts) / [summarize/route.ts](src/app/api/ai/summarize/route.ts) | Auth + Zod + `recordAiAudit`. |
| [src/app/api/ai/jobs/route.ts](src/app/api/ai/jobs/route.ts) | Real job dispatcher — writes to `jobs` collection; sync mode internally invokes `extract`/`recommend`/`recompute`. |
| [src/components/demo/DemoTour.tsx](src/components/demo/DemoTour.tsx) | Auto-launch only when `?tour=1` — no more 2-second hijack. |

### Deleted files
- `src/lib/matching/ranker.ts` — superseded by `semantic.ts`.

### Frontend wiring (every protected call now uses `authFetch`)
- [src/app/(app)/allocation/page.tsx](src/app/(app)/allocation/page.tsx) — removed Phase 3.3 stub, wired `authFetch`, surfaced `semanticScore`, `distanceKm`, `embeddingMode` (vector / lexical badge), reasons[] expandable, conflict alert.
- [src/app/(app)/reports/page.tsx](src/app/(app)/reports/page.tsx) — removed Phase 3.2 stub, wired `authFetch`.
- [src/app/(app)/operations/page.tsx](src/app/(app)/operations/page.tsx) — removed Phase 3.4 stub.
- [src/app/(app)/workbench/page.tsx](src/app/(app)/workbench/page.tsx), [planner/page.tsx](src/app/(app)/planner/page.tsx), [impact/page.tsx](src/app/(app)/impact/page.tsx), [localities/page.tsx](src/app/(app)/localities/page.tsx), [command-center/CommandCenterClient.tsx](src/app/(app)/command-center/CommandCenterClient.tsx) — wired `authFetch`.

### Build status
```
npm run build → ✓ Compiled successfully · 28 routes · TypeScript clean
```

---

## 2. 120-second demo flow

| t | Screen | Action | What the judge sees |
| --- | --- | --- | --- |
| 0:00 | `/reports` | Paste a Tamil-Hindi mixed field report + drop a photo of a clinic queue. Click **Submit**. | Multimodal pipeline kicks off — toast: "Queued offline-safe with idempotency key." |
| 0:15 | `/workbench` | Click the new extracted card. | Confidence-weighted needs, `geohash6`, evidence spans, **AI audit row** visible (model, latency, cost). |
| 0:30 | `/workbench` | Click **Approve**. | Status flips to `HUMAN_APPROVED` — `humanReviewerUid` recorded. |
| 0:40 | `/allocation` | Pick the camp, set Hindi + max distance 25 km. Click **Generate Matrix**. | Top-5 candidates appear with **Vector match** badge, **Semantic 87%**, **3.2 km** chip, expandable "Why this volunteer?" reasons. |
| 0:55 | `/allocation` | Click **Assign & Lock** on candidate 1. | Transaction commits. Open a 2nd tab, click Assign on the same candidate → toast "Volunteer is no longer available" (HTTP 409). |
| 1:15 | `/operations` | Click **Dispense 50** units of paracetamol. | Stock decrements transactionally. Disconnect Wi-Fi, dispense again → queued in IndexedDB outbox. Reconnect → auto-flushes. |
| 1:35 | `/command-center` | Live volunteer presence dots animate. | Dispatch directly from the map; same 409 protection applies. |
| 1:50 | `/impact` | Click **Generate Summary**. | Gemini summarizes the day's camp — another `ai_audit` row appears. |
| 2:00 | Firestore console | Open `ai_audit`. | Every Gemini call has a row: prompt version, latency_ms, input/output tokens, cost_usd, validation_passed. |

---

## 3. Three talking points vs **AlloCare**

1. **Transactional dispatch with 409 conflict semantics.** AlloCare's allocation is a Firestore write race waiting to happen. We ship `runTransaction`-wrapped assign + dispense + dispatch. Demo: open two tabs, both hit Assign → only one wins, the other gets a 409 and stays consistent.
2. **Hybrid semantic + constraint + proximity matcher with auto-fallback.** AlloCare uses prompt-glued ranking. We score `0.55*cosine(text-embedding-004) + 0.30*CSP + 0.15*haversine`, with a Jaccard lexical fallback when the embedding API is unavailable. Every match shows the mode badge ("Vector" vs "Lexical") so the judge sees the architecture, not just the answer.
3. **Offline-first IndexedDB outbox + idempotency keys + service worker.** AlloCare's offline story is "it loads cached HTML." We persist mutations into IDB, replay them on reconnect, dedupe with client-generated event IDs, and surface the queue depth in the UI. Disconnect Wi-Fi during the demo and keep operating.

## 3b. Three talking points vs other **SevaSetu** repos

1. **Real geohash + 9-cell neighbor prefilter** instead of the `geo_${lat}_${lng}` strings that ship in the public seed code. We can prove sub-quadratic locality scans on day one.
2. **`ai_audit` collection** — every Gemini call records model, prompt version, latency, input/output tokens, cost estimate, and Zod validation result. None of the other forks have an auditable AI surface; we can demo a Firestore console row that maps 1:1 to a UI action.
3. **Deterministic CSP solver in front of the LLM** — `filterCandidatesWithReasons` and `softScore` produce explainable reasons (`"language match", "distance 3.2 km", "fatigue 18 < cap 80"`). The LLM only reranks the top set. Other repos hand the entire decision to a single Gemini prompt — we can show the deterministic rejected reasons array on stage.

---

## 4. Danger zones (be honest with the judges)

1. **Real-time updates use a polling `subscribeToCollection`** because we still import `firebase/firestore/lite` (chosen for tree-shake). Visible behavior is correct, but a true `onSnapshot` upgrade is one PR away. Flag this if a judge asks why the cursor doesn't blink instantly.
2. **`AUTH_DEV_BYPASS=true`** must NOT be set in production. The middleware honors it for local dev / unauthenticated demos. Flip it off the moment you point at a real Firebase project.
3. **Embedding fallback is lexical (Jaccard)** — when the `text-embedding-004` endpoint is rate-limited or env vars are missing, results are still useful but no longer "semantic." The badge in the UI tells the truth (`Lexical fallback`), so don't hide it; lean into it as honesty.
4. **Static prerender uses Firebase placeholder values** if env vars are missing at build time. This means a build can succeed without secrets, but the runtime client must be hydrated with real `NEXT_PUBLIC_FIREBASE_*` values or the auth page will throw on first render.
5. **Multimodal extract size cap** — inline base64 attachments are skipped above ~18 MB. For larger files use the storage upload path (`storageUri`).

---

## 5. What to say if a judge asks "what makes this bulletproof?"

> "Three layers of correctness. (1) Every API request is parsed by a Zod schema before it touches a handler — invalid inputs are rejected at the boundary. (2) Every state-changing call goes through a Firestore transaction or returns 409. (3) Every Gemini inference writes an audit row with prompt version, latency, cost, and Zod validation result, so we can re-trace any decision the model made."
