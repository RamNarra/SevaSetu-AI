# SevaSetu AI 100/10 Implementation Plan

Status: Staff-engineer rebuild blueprint for the current repository.
Current repo baseline: Next.js App Router app, Firebase Auth, Firestore client SDK, Firebase Storage, Google Maps, and Gemini API route wrappers.
Goal: Turn the current demo-grade NGO dashboard into a globally scalable, AI-native allocation engine for messy field reports, disaster response, and high-volume volunteer coordination.

## Executive Target

SevaSetu must stop being a dashboard that asks Gemini for JSON and start becoming an event-driven decision system.

The production architecture has five hard requirements:

1. Every field report becomes a durable event, not a client-side UI state.
2. Every AI result is schema-validated, stored, versioned, auditable, and reproducible.
3. Every locality score is computed from traceable evidence, not seeded urgency fields.
4. Every volunteer recommendation is explainable, constraint-aware, and resistant to hallucinated model output.
5. Every disaster-zone workflow works offline first and reconciles safely under conflict.

## Phase 0: Stabilize The Existing Repository

### Fix package drift

Problem:
- `package.json` declares `next: 15.1.0`, `react: 19.0.0`, and `eslint-config-next: 15.1.0`.
- `package-lock.json` and `node_modules` resolve Next 16.2.3, React 19.2.4, and eslint-config-next 16.2.3.

Action:
- Pick the installed Next 16 line and update `package.json`.
- Commit lockfile and package manifest together.
- Add `engines.node` and pin npm.

### Make lint non-negotiable

Current `npm run lint` fails. Fix before touching features.

Files:
- `src/components/layout/Sidebar.tsx`
- `src/lib/firebase/demo.ts`
- `src/lib/firebase/firestore.ts`

Actions:
- Replace `any` demo casts with typed collection maps.
- Move synchronous `setIsMobile` initialization out of `useEffect` or initialize from a lazy state function guarded by `typeof window`.
- Remove unused imports across app pages.

### Close the coordinator privilege hole

Problem:
- New users can select `COORDINATOR` during onboarding.
- Firestore rules allow self-created user documents without validating role.

Files:
- `src/app/auth/page.tsx`
- `src/lib/firebase/auth.ts`
- `firestore.rules`

Actions:
- Remove `COORDINATOR` from public onboarding.
- Create coordinator assignment only through a server-side admin route using Firebase Admin SDK custom claims.
- Update rules to reject client-side role escalation.

### Persist extraction results

Problem:
- `ReportsPage` stores `community_reports`, calls `/api/ai/extract`, and displays the result locally.
- It never writes `extracted_reports`.
- Locality urgency is therefore not automatically updated from submitted reports.

Files:
- `src/app/(app)/reports/page.tsx`
- `src/app/api/ai/extract/route.ts`
- `src/lib/firebase/firestore.ts`

Actions:
- Move extraction orchestration server-side.
- API route writes:
  - `community_reports/{id}.status = PROCESSING`
  - `extracted_reports/{id}`
  - `community_reports/{id}.status = EXTRACTED`
  - append `report_events`
- On failure, write `status = FAILED` with non-sensitive error code.

## Phase 1: The AI/ML Core

### 1.1 Use Vertex AI, not direct Gemini keys in route handlers

Current:
- `src/lib/ai/client.ts` creates `GoogleGenAI` with `process.env.GEMINI_API_KEY`.
- `MODEL = 'gemini-1.5-flash'`, which contradicts README claims.

Target:
- Use Vertex AI through Google GenAI SDK with workload identity.
- Configure model IDs by task:
  - extraction: Gemini 3.1 Pro preview or strongest available structured-output Gemini model
  - fast routing and summaries: Gemini 3.1 Flash-Lite or Flash
  - image/PDF evidence: Gemini multimodal model
  - embeddings: Gemini Embedding 2 or current Vertex text embedding model
- Store model version, prompt version, temperature, schema version, input hash, output hash, and confidence on every AI result.

### 1.2 Replace prompt-only extraction with a multimodal ingestion pipeline

New collections:
- `raw_reports`
- `report_assets`
- `extraction_jobs`
- `extracted_signals`
- `signal_evidence`
- `locality_signal_rollups`

Pipeline:
1. Client uploads text, audio, image, PDF, or CSV to Cloud Storage.
2. Firestore writes a `raw_reports` document with minimal metadata.
3. Cloud Storage finalize event publishes to Pub/Sub.
4. Cloud Run worker pulls job, extracts content:
   - Document AI for PDFs/scans/forms.
   - Speech-to-Text for audio notes.
   - Vision / Gemini multimodal for images.
   - Gemini 3.1 Pro for entity extraction and medical/need signal normalization.
5. Validate output with Zod and JSON Schema.
6. Store normalized signals and evidence spans.
7. Generate embeddings for report text, extracted issues, support needs, locality context, and volunteer skills.
8. Upsert vectors into Vertex AI Vector Search or Firestore vector fields for MVP.

Required result schema:

```ts
type ExtractedSignal = {
  reportId: string;
  locality: {
    canonicalId: string | null;
    rawName: string;
    confidence: number;
  };
  needs: Array<{
    taxonomyCode: string;
    label: string;
    severity: 1 | 2 | 3 | 4 | 5;
    affectedEstimate: number;
    evidenceSpan: string;
    confidence: number;
  }>;
  urgencySignals: Array<{
    type: 'death' | 'hospitalization' | 'outbreak' | 'supply_stockout' | 'access_blocked' | 'vulnerable_group';
    evidenceSpan: string;
    confidence: number;
  }>;
  geo: {
    lat: number | null;
    lng: number | null;
    geohash: string | null;
    source: 'map_geocode' | 'report_text' | 'user_pin' | 'unknown';
  };
  model: {
    provider: 'vertex-ai';
    name: string;
    version: string;
    promptVersion: string;
  };
};
```

### 1.3 Build real urgency intelligence

Current:
- `src/lib/scoring/deterministic.ts` computes severity using substring keyword weights.
- `repeatComplaints` is repurposed as average affected population.
- `localities` are sorted in memory.

Target scoring model:

UrgencyScore = weighted ensemble:
- Medical severity index: outbreak/death/hospitalization/supply disruption.
- Affected-population confidence interval, not a single hallucinated number.
- Vulnerability index from census/open-data overlays.
- Service gap and last intervention age.
- Report recurrence with deduplication.
- Trend velocity over time.
- Resource scarcity and travel friction.
- Model uncertainty penalty.
- Fairness correction to prevent always serving high-volume urban areas.

Implementation:
- `src/lib/scoring/deterministic.ts`: keep as transparent baseline.
- Add `src/lib/scoring/urgency-v2.ts`: typed scoring with normalized features.
- Add `src/lib/scoring/fairness.ts`: district/state quota and vulnerability correction.
- Add `src/lib/scoring/explain.ts`: human-readable score cards.
- Add `functions/recompute-locality-score`: Cloud Run function triggered by `extracted_signals` writes.
- Store `score_version` and feature vector per score.

### 1.4 Build real volunteer matching

Current:
- `/api/ai/recommend` sends the entire volunteer pool to Gemini and trusts returned scores.
- No hard constraints, no assignment transaction, no availability lock.

Target:
- Deterministic constraint solver first, LLM explanation second.

Candidate generation:
- Filter by role, availability, active assignment conflicts, max travel radius, language, credential, time window, fatigue score.
- Use vector search to retrieve semantic matches between support needs and volunteer skills/certifications.
- Use geospatial scoring by distance and travel time.

Ranking formula:

```txt
match_score =
  0.30 role_credential_fit
+ 0.20 semantic_skill_fit
+ 0.15 language_fit
+ 0.15 geo_travel_fit
+ 0.10 reliability_rating
+ 0.05 prior_camp_experience
+ 0.05 fairness_load_balance
- penalties(conflict, fatigue, stale_availability, low_confidence)
```

Assignment:
- Use a server-side transaction.
- Lock volunteer availability for the camp window.
- Create `assignments`.
- Update `camp_plans.assignedStaff`.
- Write audit log.

LLM use:
- Gemini generates coordinator-facing reasoning after the deterministic ranker produces candidates.
- Reject any LLM recommendation that references a volunteer ID not in the candidate set.

## Phase 2: High-Availability Infrastructure

### 2.1 Event-driven backend

Replace client-only CRUD with durable services.

Google Cloud backbone:
- Firebase App Hosting or Cloud Run for the Next.js app.
- Cloud Run services for API and AI orchestration.
- Cloud Run worker pools for Pub/Sub pull workers.
- Pub/Sub topics:
  - `report.ingested`
  - `report.extraction.requested`
  - `report.extraction.completed`
  - `locality.score.recompute`
  - `volunteer.location.updated`
  - `assignment.requested`
  - `camp.visit.stage_changed`
  - `medicine.dispensed`
- Cloud Tasks for retryable per-report AI calls and notification sends.
- Eventarc for Cloud Storage and Firestore event triggers.
- Secret Manager for model keys, webhook secrets, and maps credentials.
- Cloud Logging, Error Reporting, Trace, and Monitoring for observability.

### 2.2 Database design

Use Firestore for operational real-time state:
- `users`
- `volunteer_profiles`
- `volunteer_presence`
- `localities`
- `raw_reports`
- `extracted_signals`
- `locality_signal_rollups`
- `camp_plans`
- `assignments`
- `patient_visits`
- `medicine_stock`
- `dispense_logs`
- `audit_logs`
- `outbox_events`

Use BigQuery for analytics:
- append-only report events
- score history
- assignment decisions
- patient flow durations
- medicine utilization
- locality trend facts

Use Vertex AI Vector Search for semantic retrieval:
- report embeddings
- need embeddings
- locality context embeddings
- volunteer skill embeddings

Use Cloud Storage:
- original uploads
- redacted documents
- model input/output snapshots
- exported BigQuery datasets

Use Memorystore for Redis:
- hot dashboard aggregates
- rate limits
- idempotency keys
- short-lived volunteer location tiles

### 2.3 Offline-first disaster mode

Current:
- Offline support is `localStorage` for reports only.
- No service worker, no background sync, no encrypted storage, no conflict handling.

Target:
- PWA with service worker.
- IndexedDB for encrypted offline queue.
- Per-device logical clock.
- Conflict-free merge model for field reports and patient stage events.
- Outbox pattern:
  - each offline action gets `clientEventId`
  - retries are idempotent
  - server stores processed event IDs
- Local validation before queueing.
- Background sync when online.
- QR-based export/import bundle for no-internet camps.
- Bluetooth/Wi-Fi Direct disaster relay mode as an advanced demo concept.

Consensus model:
- Use CRDT-style append-only event logs for reports, visits, and location pings.
- For non-commutative operations like medicine stock, use server-authoritative reservation events and conflict review UI.
- Use vector-clock metadata for conflicting camp-stage updates.

### 2.4 Geospatial tracking and heatmaps

Current:
- Google Maps marker/heatmap is built from seeded locality coordinates and urgency scores.

Target:
- Store geohash on locality, report, volunteer presence, and camp.
- Track volunteers with explicit opt-in and TTL.
- Update `volunteer_presence/{uid}` with:
  - geohash
  - lastSeenAt
  - battery/network class
  - activeCampId
- Use map tiles or clustered queries by geohash prefix.
- BigQuery GIS for long-horizon heatmaps and hotspot trend analysis.
- Frontend shows:
  - live volunteer coverage
  - underserved heatmap
  - travel-time constrained dispatch options
  - predicted need escalation zones

## Phase 3: Enterprise UI

### 3.1 Predictive command center

Replace static cards with a command center:
- Need heatmap with confidence bands.
- Top urgent localities with explainable feature bars.
- Trend delta over 7/14/30 days.
- Resource gap forecast.
- Volunteer coverage map.
- Risk alerts by signal type.
- "Why this rank?" drilldown with evidence spans from reports.

### 3.2 Report intake workbench

Features:
- Multimodal upload queue.
- Extraction review and correction UI.
- Evidence span highlighting.
- Canonical locality resolution.
- Duplicate report cluster detection.
- Human approval workflow for low-confidence extractions.

### 3.3 Allocation cockpit

Features:
- Constraint controls for role, certification, language, distance, fatigue, gender-sensitive care, and availability windows.
- Explainable recommendation matrix.
- What-if staffing simulation.
- One-click assignment with transactional lock.
- Alert when LLM reasoning conflicts with deterministic constraints.

### 3.4 Operations center

Features:
- True real-time patient flow using Firestore listeners or optimized server stream.
- Stage duration SLA alerts.
- Medicine depletion forecast.
- Offline mode indicator backed by queued event count.
- Conflict resolution drawer.
- Audit trail for every stage movement and dispensing event.

## Strict Google Cloud Product Stack

Must integrate:

1. Firebase Auth: identity provider for web/mobile users.
2. Firebase App Hosting or Cloud Run: production Next.js hosting.
3. Firestore: real-time operational database.
4. Firebase Storage / Cloud Storage: uploaded reports, audio, images, PDFs.
5. Firebase Security Rules plus Firebase Admin SDK custom claims: role enforcement.
6. Pub/Sub: durable async event bus.
7. Cloud Run services: API, extraction workers, scoring workers, matching workers.
8. Cloud Run functions: small event handlers where appropriate.
9. Cloud Tasks: retries, delayed notifications, rate-limited model calls.
10. Eventarc: storage/firestore event routing.
11. Vertex AI Gemini 3.1 Pro preview: multimodal extraction and advanced reasoning.
12. Vertex AI Gemini Flash / Flash-Lite: fast summaries, low-latency explanations.
13. Vertex AI Embeddings: report, locality, and volunteer embeddings.
14. Vertex AI Vector Search: scalable semantic retrieval and recommendation candidate generation.
15. Document AI: PDFs, forms, scanned field documents.
16. Speech-to-Text: voice-note reports from field volunteers.
17. Cloud Translation API: multilingual report normalization.
18. Google Maps Platform: maps, geocoding, routes, distance matrix, heatmaps.
19. BigQuery: analytics warehouse and score history.
20. Dataflow: streaming ETL from Pub/Sub to BigQuery and derived operational stores.
21. Looker Studio: judge-friendly impact dashboards.
22. Memorystore for Redis: hot aggregates, rate limits, idempotency, geospatial tiles.
23. Secret Manager: credentials and webhook secrets.
24. Cloud Logging, Monitoring, Trace, Error Reporting: production observability.
25. Cloud Build and Artifact Registry: CI/CD and container supply chain.
26. Cloud Armor: public API protection.
27. Cloud CDN: static asset acceleration.
28. Backup/restore for Firestore and BigQuery export jobs: disaster recovery.

## Target Repository Structure

```txt
src/
  app/
    api/
      reports/route.ts
      extraction/jobs/route.ts
      scoring/recompute/route.ts
      matching/recommend/route.ts
  components/
    command-center/
    reports/
    allocation/
    operations/
  lib/
    ai/
      vertex.ts
      schemas.ts
      prompts/
    auth/
      server.ts
      claims.ts
    db/
      admin.ts
      firestore.ts
      transactions.ts
    scoring/
      urgency-v2.ts
      fairness.ts
      explain.ts
    matching/
      constraints.ts
      ranker.ts
      explain.ts
    offline/
      outbox.ts
      idempotency.ts
functions/
  report-ingestion/
  extraction-worker/
  scoring-worker/
  matching-worker/
  notification-worker/
infra/
  terraform/
  firestore.indexes.json
  firestore.rules
  storage.rules
```

## Validation Gates

Before a demo branch is accepted:

1. `npm run lint` passes.
2. `npm run build` passes from a clean install.
3. Unit tests cover scoring and matching.
4. API route tests cover invalid JSON, missing auth, malformed model output, and model timeout.
5. Firestore rules tests prove volunteers cannot become coordinators.
6. Extraction result is persisted and visible after refresh.
7. Recommendation results reject hallucinated volunteer IDs.
8. Assignment uses a transaction and prevents double-booking.
9. Offline report queue survives reload and reconciles with idempotency.
10. Seed/demo mode is clearly separated from production data.

## Demo Architecture Narrative

1. Field worker uploads messy multilingual report, PDF, voice note, or photo.
2. Pub/Sub event starts extraction pipeline.
3. Gemini + Document AI create structured, evidence-backed signals.
4. Vertex embeddings index the need context.
5. Urgency engine recomputes locality score and shows why the rank changed.
6. Matching engine retrieves qualified volunteers semantically and applies hard constraints.
7. Assignment transaction locks staff and sends notifications.
8. Operations board runs offline-capable patient flow.
9. BigQuery dashboard shows measured impact and resource gaps.

## 48-Hour Build Priority

Day 1:
- Fix lint and package drift.
- Lock down coordinator onboarding.
- Add Zod.
- Persist extraction results.
- Add server-side Admin SDK route for reports.
- Add deterministic matching fallback.
- Add Firestore indexes file.

Day 2:
- Add assignment transaction.
- Add outbox-based offline report sync.
- Add score history.
- Add evidence-backed extraction UI.
- Add BigQuery export stub or Pub/Sub emulator path.
- Add demo script and danger-zone checklist.

## 30-Day World-Class Track

Week 1:
- Backend hardening, auth claims, schema validation, transaction safety.

Week 2:
- Vertex AI extraction, embeddings, vector search, locality score v2.

Week 3:
- Offline-first PWA, outbox, conflict handling, geospatial dispatch.

Week 4:
- BigQuery analytics, predictive dashboards, load testing, polished demo.

## Judge-Winning Technical Claims To Earn

Only claim these after implementation:

- "We process messy multimodal field reports into auditable need signals."
- "Our urgency model combines deterministic public-health heuristics, temporal trend features, geospatial vulnerability, and bounded LLM reasoning."
- "Our volunteer matching uses hard constraints plus semantic retrieval, not prompt-only ranking."
- "Every AI decision is stored with model version, evidence, confidence, and human-correctable trace."
- "The system works offline in disaster zones using an encrypted outbox and idempotent event replay."
- "Operational analytics flow into BigQuery for impact measurement and resource forecasting."

## References Checked

- Vertex AI model catalog: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models
- Vertex AI Vector Search: https://docs.cloud.google.com/vertex-ai/docs/vector-search/overview
- Firestore vector search: https://docs.cloud.google.com/firestore/native/docs/vector-search
- Pub/Sub overview: https://docs.cloud.google.com/pubsub/docs/overview
- Cloud Run overview: https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run
- BigQuery overview: https://docs.cloud.google.com/bigquery/docs/introduction
- Dataflow overview: https://cloud.google.com/products/dataflow
- Firestore best practices: https://firebase.google.com/docs/firestore/best-practices
- Firestore distributed counters: https://firebase.google.com/docs/firestore/solutions/counters
