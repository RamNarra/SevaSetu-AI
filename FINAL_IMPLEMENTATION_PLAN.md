# SevaSetu AI — FINAL IMPLEMENTATION PLAN (100/10 Master Plan)

> **Mission**: Take this repository from a defensible 6.4/10 MVP to a world-class, globally-scalable NGO allocation engine that **mathematically obliterates AlloCare and Team Dopaminers** at the Google Solution Challenge 2026 finals.
>
> **Target**: AIR 1 / Global Rank #1.
>
> **Doctrine**: Every line of code in this plan must map to a specific judge-defensible architectural property — no fluff, no demo-ware.

---

## 0. Pre-Flight: Triage Before Anything Else (T-0 → T+4h)

These bugs **will get you crashed during a live demo**. Fix before any new feature work.

| # | File | Defect | Action |
|---|------|--------|--------|
| 0.1 | `src/app/api/scoring/recompute/route.ts` | Imports `computeBaseUrgency` and `ScoreResult` — neither exists | Rewire to `analyzeUrgencyScore` from `urgency-v2`, export `ScoreResult` type |
| 0.2 | `src/lib/maps/geohash.ts` | Fake geohash (`geo_${lat}_${lng}`) | `npm i ngeohash @types/ngeohash`, replace with real base32 geohash |
| 0.3 | `src/app/api/ai/jobs/route.ts` | Stub (`console.log` + `acknowledged`) | Either remove the route or wire to Cloud Tasks (see Phase 2.3) |
| 0.4 | `src/lib/matching/constraints.ts` | Only filters by role/status — README promises distance, language, certs, fatigue | Implement full constraint solver (see Phase 1.3) |
| 0.5 | `src/lib/db/transactions.ts` lines 21-26 | Writes both `status` AND `availability` because schema is undecided | Canonicalize on `availability` (enum: `AVAILABLE\|BUSY\|DEPLOYED\|OFFLINE`); migrate all reads/writes |
| 0.6 | `src/lib/firebase/config.ts` + `firestore.ts` | Uses `firebase/firestore/lite` → no `onSnapshot` → README real-time claim is false | Switch to full `firebase/firestore` SDK |
| 0.7 | All `/api/**/route.ts` | No `verifyIdToken` middleware — anonymous Gemini quota drain | Add `withAuth(handler)` wrapper using Firebase Admin |
| 0.8 | All `/api/**/route.ts` (inbound) | No Zod validation on request bodies | Define request Zod schemas alongside response schemas |
| 0.9 | `src/components/demo/DemoTour.tsx` line 54 | Auto-fires 2s after mount → wrecks live demo | Gate behind `?tour=1` query param only |

**Acceptance**: `npm run build` clean, `npm run lint` clean, every API route returns 401 for anon requests, demo tour does not auto-launch.

---

## Phase 1 — The AI/ML Core (Days 1–3)

### 1.1 Vertex AI Vector Search for Semantic Matching — *Primary Kill Shot vs AlloCare*

AlloCare uses `Skill Overlap × Proximity × Availability`. That is a **set-intersection toy**. We replace ours with **dense semantic similarity** so a "pediatric vaccination camp in tribal area" matches a volunteer whose bio says "rural child immunization in Adivasi communities" even with zero literal skill-tag overlap.

**Architecture**
```
extracted_reports.onCreate
   ├─ Gemini 2.5 Pro extraction (already exists)
   └─ text-embedding-004 (768-d) on (needs[].label + evidenceSpan + locality)
          └─ Vertex AI Vector Search index: `report_needs_v1`

volunteer_profiles.onWrite
   └─ text-embedding-004 on (skills + languages + certifications + bio + camp_history)
          └─ Vertex AI Vector Search index: `volunteer_capabilities_v1`

POST /api/matching/v2/recommend
   1. Pull report embedding from extracted_reports doc
   2. Query Vector Search index: top-K=50 cosine neighbors
   3. Hard-filter via constraint solver (Phase 1.3): availability, geohash neighbor cells, fatigue, certs
   4. Re-rank deterministically: 0.55*semantic + 0.20*proximity + 0.15*(1-fatigue) + 0.10*rating
   5. LLM rerank top-5 with chain-of-thought reasoning + per-candidate explanation
   6. Return top-3 with confidence intervals
```

**Files to create**
- `src/lib/ai/embeddings.ts` — `embedReport(signal)`, `embedVolunteer(profile)` using `genai.models.embedContent({ model: MODELS.embeddings, content })`.
- `src/lib/matching/vectorSearch.ts` — Vertex Vector Search client wrapper (`@google-cloud/aiplatform`).
- `src/app/api/matching/v2/recommend/route.ts` — the new pipeline.
- `functions/src/onReportExtracted.ts` — Firebase Function trigger that runs embedding asynchronously.
- `functions/src/onVolunteerWrite.ts` — Firebase Function trigger.

**Why judges will care**: it is the only way a volunteer matching system in 2026 can be defended as "intelligent". This is the moment you say *"AlloCare's match is keyword AND. Ours is dense semantic similarity in 768-dimensional space, with deterministic re-ranking — explainable AND high-recall."*

### 1.2 Multimodal Extraction (Vision Parity with AlloCare)

Today `/api/ai/extract` accepts `text` only. Field workers upload **photos of paper survey forms, voice notes, hand-drawn maps**.

**Implementation** in `src/app/api/ai/extract/route.ts`:
1. Accept `storageUri` array (already uploaded via Storage rules to `raw_reports/{uid}/{eventId}/`).
2. Resolve signed-read URL from Admin SDK.
3. Build Gemini parts:
   ```ts
   parts: [
     { text: EXTRACTION_PROMPT },
     ...storageUris.map(uri => ({ fileData: { fileUri: uri, mimeType: detectMime(uri) } })),
     { text: rawText ?? '(no text)' }
   ]
   ```
4. Same `responseSchema` validation.
5. **One Gemini call** replaces AlloCare's two-stage Cloud Vision → Gemini pipeline. Lower latency, lower cost, fewer failure modes.

**Demo line**: *"AlloCare needs Cloud Vision OCR plus Gemini — two services, two failure points, sequential latency. We use Gemini 2.5 Pro multimodal in a single round-trip with structured output validation."*

### 1.3 Constraint Solver (Promised in README, Missing in Code)

Replace `src/lib/matching/constraints.ts` with a real CSP:

```ts
export interface MatchConstraints {
  needsRole: UserRole;
  campLocation: { lat: number; lng: number; geohash: string };
  maxDistanceKm: number;
  requiredLanguages: string[];      // any-of
  requiredCertifications: string[]; // all-of
  maxFatigueScore: number;          // hard cap
  cooldownHours: number;            // hours since last assignment
  genderRequirement?: 'any' | 'female_only' | 'male_only';
}
```

Hard rules (rejection):
1. `availability === 'AVAILABLE'`
2. Role match OR (Coordinator with explicit override flag)
3. Haversine distance ≤ `maxDistanceKm`
4. Languages: at least one overlap
5. Certifications: full superset (e.g., `["MBBS", "vaccination_certified"]`)
6. `fatigueScore ≤ maxFatigueScore`
7. `now - lastAssignedAt ≥ cooldownHours` (prevents burnout, AlloCare has no equivalent)
8. Gender constraint match if specified

Soft rules (scoring contribution): proximity decay, rating, completedCamps log-scaled, recency of last camp in same locality.

### 1.4 Confidence-Aware AI Audit Trail

Every Gemini-touched document must carry:
```ts
ai_audit: {
  promptVersion: string;
  modelVersion: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  validationPassed: boolean;
  zodErrors?: string[];
}
```

This lets judges see *every* AI inference is observable. Add a `/api/admin/ai-trace/{docId}` endpoint to surface it.

---

## Phase 2 — High-Availability Infrastructure (Days 4–6)

### 2.1 Real Geohash + Geospatial Queries

Replace `src/lib/maps/geohash.ts` (10 lines of fake) with `ngeohash`:
```ts
import ngeohash from 'ngeohash';
export const encodeGeohash = (lat: number, lng: number, precision = 9) =>
  ngeohash.encode(lat, lng, precision);
export const neighborCells = (hash: string) =>
  [hash, ...ngeohash.neighbors(hash)];
```

Firestore composite indexes (declare in `firestore.indexes.json`):
- `volunteer_profiles`: `(geohash6, availability, fatigueScore)` ascending
- `localities`: `(geohash6, urgencyScore desc)`
- `volunteer_presence`: `(geohash6, lastSeenAt desc)`

Query pattern (replace the full-collection scan in `/api/allocation/recommend`):
```ts
const cells = neighborCells(campGeohash6);          // up to 9 cells
const queries = cells.map(c =>
  adminDb.collection('volunteer_profiles')
    .where('geohash6', '==', c)
    .where('availability', '==', 'AVAILABLE')
    .where('fatigueScore', '<=', constraints.maxFatigueScore)
);
const results = await Promise.all(queries.map(q => q.get()));
```

This drops a 10k-volunteer query from **10,000 reads** to **~100 reads**. Demo defensible.

### 2.2 Cloud Functions + Eventarc + Pub/Sub

Move heavy work off the request thread:
- `functions/onRawReportCreated` (Firestore trigger) → publishes to `reports.extract` Pub/Sub topic.
- `functions/extractionWorker` (Pub/Sub trigger) → calls Gemini, writes `extracted_reports`.
- `functions/onExtractedReportCreated` → publishes to `reports.embed` and `reports.score`.
- `functions/embeddingWorker` → embeds + upserts to Vertex Vector Search.
- `functions/scoringWorker` → recomputes locality urgency.
- `functions/onAssignmentCreated` → SMS/email volunteer via Pub/Sub → notification worker.

This is the **single biggest scalability difference vs AlloCare** (which is synchronous Cloud Functions). With Pub/Sub:
- Backpressure handling.
- Retry with exponential backoff (built-in).
- Dead-letter topic for poison messages.
- Horizontal scale: 1 → 10,000 reports/min without code changes.

### 2.3 Outbox / Idempotency Hardening

Current outbox is good, harden it:
- Move idempotency check in `src/lib/offline/idempotency.ts` to use a **server-side unique constraint** (`outbox_events/{clientEventId}` with `create-only` security rule) — prevents replay attacks.
- Add `BroadcastChannel('sevasetu-outbox')` so multiple tabs coordinate sync (today only `isSyncingRef` ref guards a single tab — a 2-tab user double-submits).
- Add exponential backoff: `min(2^attempts, 300)s` between retries; cap at 10 attempts; surface to user after that.
- Persist `lastError` history (last 3 errors) for debugging in the Workbench.

### 2.4 Realtime Geospatial Volunteer Tracking

Today `volunteer_presence` exists but is fed by 60s polling and a fake geohash. Upgrade:
- Use real geohash6 (city-block precision) per Phase 2.1.
- Add a coordinator live map that subscribes (real-time, after Phase 0.6 fix) to `volunteer_presence` filtered by camp's neighbor cells.
- Battery/network-aware adaptive interval: 30s on Wi-Fi, 90s on 4G, 180s on 3G, paused on 2G/offline (most of this hook already exists in `useVolunteerPresence.ts` — extend it).
- Privacy: round to geohash6 (~0.6km × 0.6km) before write — never store raw coords for non-active volunteers.

### 2.5 PWA Hardening for Disaster-Zone Field Use

- Service worker (currently registered in `OfflineSync.tsx`) needs Workbox precaching of `/dashboard`, `/operations`, `/reports`.
- IndexedDB outbox already exists — extend to cache last 100 `extracted_reports` and `volunteer_profiles` for offline triage.
- Add `Background Sync API` registration so OS-level retry happens even when the tab is closed.

---

## Phase 3 — The Enterprise UI / Decision Surface (Days 7–9)

### 3.1 Predictive Analytics (BigQuery + Looker Studio)

- Firebase Extension: **"Stream Collections to BigQuery"** on `extracted_reports`, `assignments`, `dispense_logs`, `patient_visits`.
- Materialized views in BigQuery:
  - `mv_locality_30d_urgency_trend` — rolling urgency by locality
  - `mv_volunteer_workload_30d` — hours / camps / fatigue trajectory
  - `mv_disease_geographic_clusters` — outbreak detection (BigQuery ST_CLUSTERDBSCAN)
- `/impact` page: embedded Looker Studio dashboard for trend visualization.
- Judges love BigQuery + ST_* spatial functions in a social-impact pitch.

### 3.2 Human-in-the-Loop Workbench (already started, needs depth)

Current `src/app/(app)/workbench/page.tsx` is bare. Enhance:
- Side-by-side: raw report (left) vs extracted JSON tree (right) with **evidence span highlighting** — clicking a `need.evidenceSpan` highlights it in the raw text.
- Inline edit of extracted fields (severity dropdown, taxonomy autocomplete) → re-trigger embedding on save.
- Confidence heatmap badges on every extracted field.
- Approval = single click; auto-trains a fine-tuning corpus written to `gemini_finetune_examples` collection (foundation for Phase 4).

### 3.3 SLA Alerts + Incident Console

- New collection: `sla_alerts` (severity, type, locality, breachedAt, ack'd, resolved).
- Cloud Function `slaWatcher` (Cloud Scheduler every 5 min):
  - Locality `urgencyScore ≥ 80` and no camp planned within 24h → alert.
  - `dispense_logs` showing stockout in `medicine_stock` → alert.
  - Volunteer `fatigueScore ≥ 75` still marked `AVAILABLE` → alert.
- Coordinator Navbar gets a real-time alert bell with `onSnapshot` subscription.

### 3.4 Explainable Decision Cards

Every assignment, every score, every match must render a **"Why this?" card** that lists:
- Inputs used
- Weights applied
- Confidence interval
- Counter-factual ("if vulnerability were 0.5 instead of 0.85, score would be 64 instead of 78")

This is the single biggest separator from black-box LLM-only competitors.

### 3.5 Polished Demo Mode

- Read-only "Judge Mode" toggle (`?judge=1`) that:
  - Pre-warms all collections.
  - Disables destructive buttons (the danger zones from the review).
  - Replays a scripted incident every 90s in the Command Center.
- Single-keystroke (`Cmd+J`) to enter Judge Mode mid-demo.

---

## Phase 4 — The "Rank #1" Differentiators (Stretch, Days 10–12)

### 4.1 Fine-Tuning Loop on Approved Extractions
Use the `gemini_finetune_examples` corpus from Phase 3.2 to ship a **custom-tuned Gemini Flash** model on Vertex Model Garden. Demo line: *"We don't just use Gemini — we improve it with every coordinator approval."*

### 4.2 Federated Learning Stub for Privacy
On-device IndexedDB collects coordinator labeling actions. Daily aggregate (no PII) is uploaded for retraining. Even a stub of this earns "ethics + privacy by design" points.

### 4.3 Disaster-Drill Simulation Module
Coordinator can spawn a synthetic outbreak on the map. System runs end-to-end: extracts pre-canned reports → reranks localities → recommends volunteers → simulates SMS dispatches. Lets judges press *one button* to see scale.

### 4.4 Voice-First Field Submission
Gemini Live API → real-time speech-to-text in the field worker's language → triaged through the same extraction pipeline. AlloCare doesn't have this. Team Dopaminers can't build it.

---

## The Tech Stack Upgrade — Mandatory Google Cloud Footprint

| Product | Used Today | Required for AIR 1 | Purpose |
|---|---|---|---|
| Firebase Auth | Yes | Yes | OAuth + role tokens |
| Firestore | Yes | Yes | Operational DB |
| Cloud Storage | Yes | Yes | Multimodal report uploads |
| Firebase App Hosting (Cloud Run) | Yes | Yes | Next.js SSR + API routes |
| Firebase Functions (Gen 2) | **No** | **Yes** | Async workers (Phase 2.2) |
| Eventarc / Pub/Sub | **No** | **Yes** | Decoupled event bus (Phase 2.2) |
| Cloud Tasks | **No** | **Yes** | Scheduled retries / SMS dispatch |
| Cloud Scheduler | **No** | **Yes** | SLA watcher cron (Phase 3.3) |
| Vertex AI — Gemini 2.5 Pro | Partial | Yes | Multimodal extraction (Phase 1.2) |
| Vertex AI — Embeddings (text-embedding-004) | Declared, unused | **Yes** | Semantic vectors (Phase 1.1) |
| Vertex AI — Vector Search | **No** | **Yes** | Sub-100ms semantic match (Phase 1.1) |
| Vertex AI — Model Garden / Custom Tune | No | Stretch | Fine-tuned Flash (Phase 4.1) |
| BigQuery | **No** | **Yes** | Analytics + ST_* spatial (Phase 3.1) |
| Looker Studio | **No** | **Yes** | Embedded dashboards |
| Cloud Logging + Cloud Monitoring | **No** | **Yes** | SLO dashboards for judges |
| Cloud Armor | **No** | **Recommended** | Rate limiting + DDoS for the public API |
| Maps Platform — Routes API | **No** | **Yes** | Real ETA for volunteer dispatch (replaces Haversine) |
| Maps Platform — Distance Matrix | **No** | **Optional** | Bulk ETAs |
| Document AI | **No** | **Optional** | If Gemini multimodal proves insufficient on handwriting |
| Speech-to-Text (Gemini Live) | **No** | **Stretch** | Voice intake (Phase 4.4) |
| Identity-Aware Proxy | **No** | **Optional** | Admin console hardening |

**Minimum to credibly say "Google Cloud-native, production-grade"**: Firebase Functions + Pub/Sub + Vertex Vector Search + Vertex Embeddings + BigQuery + Cloud Scheduler. Six products beyond today's three. Anything less and a senior judge will push back.

---

## Execution Order (Day-by-Day)

| Day | Focus | Deliverable |
|---|---|---|
| 0 (today) | Phase 0 triage | Build green, demo-safe, no broken routes |
| 1 | Phase 1.2 multimodal + 1.3 constraint solver | Working camera-roll → extraction → constraint match |
| 2 | Phase 1.1 embeddings + Vector Search index bootstrap | First semantic match working in dev |
| 3 | Phase 1.1 finalization + 1.4 audit trail | `/api/matching/v2/recommend` shipping |
| 4 | Phase 2.1 real geohash + composite indexes | Geo queries replace full scans |
| 5 | Phase 2.2 Functions + Pub/Sub | Async extraction worker live |
| 6 | Phase 2.3 outbox hardening + 2.4 realtime presence + 2.5 PWA | Disaster-zone-ready PWA |
| 7 | Phase 3.1 BigQuery streaming + 3.4 explainability cards | Predictive dashboard live |
| 8 | Phase 3.2 Workbench depth + 3.3 SLA alerts | HITL + alerting shipping |
| 9 | Phase 3.5 Judge Mode + end-to-end rehearsal | Bulletproof demo flow |
| 10 | Phase 4.3 disaster drill (highest-impact stretch) | The one-button "wow" |
| 11 | Polish, narrative, screen recording, fallback video | Demo insurance |
| 12 | Submission package + architecture diagram + cost report | Final upload |

---

## Definition of Done — The 9.5+ Bar

A reviewer pulling this repo at submission must observe:

1. `npm run build` is clean. `npm run lint` is clean. **Zero broken imports.**
2. Every `/api/**` route is auth-gated and request-validated with Zod.
3. `/api/matching/v2/recommend` returns top-3 in **<500ms p95** with semantic + constraint + LLM-explanation pipeline.
4. Multimodal extraction works end-to-end on a phone-camera photo of a paper survey form.
5. A coordinator opens the Command Center; the heat map + volunteer presence updates in real time (true `onSnapshot`).
6. Two simultaneous "Assign" clicks on the same volunteer — exactly one wins with a 409 on the loser.
7. Cloud Scheduler fires `slaWatcher` every 5 minutes; alerts surface in the Navbar bell within 60s.
8. BigQuery has at least 30 days of `extracted_reports` and `assignments` streamed; Looker Studio dashboard embeds on `/impact`.
9. Disaster-drill button replays an end-to-end synthetic incident in <60 seconds.
10. Service worker passes Lighthouse PWA audit at >95.

Anything below all 10 items = **not 9.5/10**.

---

## The Single Sentence to Memorize for the Judges' Q&A

> *"AlloCare is a synchronous Flutter app calling Cloud Functions with a keyword-overlap match. Team Dopaminers is a Gemini prompt wrapper. SevaSetu AI is an event-driven, offline-first PWA running multimodal Gemini extraction, dense semantic vector matching with a deterministic constraint solver, ACID-transactional dispatch, and a BigQuery analytics layer — every AI decision auditable, every assignment provably conflict-free."*

That sentence, backed by the architecture in this plan, is the AIR 1.
