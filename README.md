# SevaSetu AI

![SevaSetu AI](https://img.shields.io/badge/Google_Solution_Challenge-2026-F4A261?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Beta_MVP-2D6A4F?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-V12-FFCA28?style=for-the-badge&logo=firebase)
![Gemini](https://img.shields.io/badge/Gemini-3.0_Flash-4285F4?style=for-the-badge&logo=google)

SevaSetu AI is a smart resource allocation platform for NGO-led community health camps.

One-line pitch: turn scattered field reports into structured need signals, rank localities by urgency, recommend the right team for each camp, and run camp-day operations in real time.

## Problem
NGOs often have volunteers, medicines, and intent, but not a unified operational intelligence layer.

Field information comes from mixed formats (notes, survey snippets, phone updates), making it hard to answer:
- Which locality is most urgent right now?
- Which team should be sent there?
- Are camp-day operations moving fast enough?
- What should be followed up after camp closure?

## What SevaSetu AI Does
SevaSetu AI combines deterministic scoring, Gemini-assisted reasoning, and live operations tooling:
- Converts unstructured reports into structured JSON through AI extraction.
- Prioritizes localities with a transparent urgency model.
- Uses AI matching for role-wise volunteer recommendations.
- Tracks patient flow on a real-time kanban pipeline.
- Generates post-camp impact summaries for coordinators.

## Current State (April 2026)
This repository is a working Beta MVP with:

### Product modules
- Landing and onboarding flow with Google Sign-In + role setup.
- Coordinator app shell with pages: dashboard, reports, localities, planner, allocation, operations, impact, admin.
- Firestore-backed real-time updates for operations and core entities.
- Seed tooling to preload realistic demo data for end-to-end walkthroughs.

### AI API routes (Next.js route handlers)
- `POST /api/ai/extract`: structured extraction from raw reports.
- `POST /api/ai/score`: urgency adjustment and reasoning from base score context.
- `POST /api/ai/recommend`: volunteer-role matching with match scores.
- `POST /api/ai/summarize`: markdown summary generation for camp outcomes.

### Tech foundations
- Next.js 16 + React 19 + TypeScript + Tailwind CSS v4.
- Firebase Auth, Firestore, and Storage.
- Google Maps JS API (map + marker + visualization libraries).
- Gemini 3.0 Flash via `@google/genai`.

## User Flow (Coordinator Journey)
1. Sign in using Google and select role if onboarding is required.
2. Open Dashboard to view priority localities, camp readiness, and alerts.
3. Go to Reports to submit raw field notes or uploads and run AI extraction.
4. Open Localities to inspect urgency ranks, map signals, and AI reasoning.
5. Use Camp Planner to pick locality, set required roles, and fetch AI staffing recommendations.
6. Finalize assignments through Allocation and create camp plan.
7. Run live queue movement in Operations (Registered -> Triaged -> Consultation -> Pharmacy -> Completed).
8. Review outcomes in Impact and generate AI summary for next-cycle decisions.

## System Workflow (Data + AI)
```mermaid
flowchart TD
	A[Field Notes / Uploaded Reports] --> B[Firestore: community_reports]
	B --> C[/api/ai/extract]
	C --> D[Structured Need Signals]
	D --> E[Deterministic Urgency Engine]
	E --> F[/api/ai/score]
	F --> G[Locality Priority Board + Map Heat Signals]
	G --> H[Camp Planner Inputs]
	H --> I[/api/ai/recommend]
	I --> J[Assigned Team + camp_plans]
	J --> K[Real-time patient_visits operations]
	K --> L[/api/ai/summarize]
	L --> M[Impact summary + follow-up planning]
```

## What We Are Doing Differently
Many NGO dashboards stop at reporting. SevaSetu AI is designed as an operational decision loop.

### 1) Hybrid urgency, not black-box ranking
- Deterministic score components are explicit (`severity`, `recency`, `repeatComplaints`, `serviceGap`, `vulnerability`).
- AI is used as a bounded adjustment and explanation layer, not as opaque end-to-end scoring.

### 2) Planning and execution in one surface
- Most tools split planning from camp-day execution.
- SevaSetu connects prioritization -> staffing -> live patient flow -> impact reporting in one workflow.

### 3) Social context included in matching
- Recommendation logic considers not just role fit, but also language, travel radius, certifications, and prior camp experience.

### 4) Built for demos and field iteration
- Seeded realistic data and role-aware UI make it easy to demo and iterate with stakeholders quickly.

## Architecture Snapshot
| Capability | Choice | Why |
|---|---|---|
| Auth | Firebase Auth (Google) | Fast, reliable onboarding and role-aware access |
| Data | Firestore | Flexible docs + real-time listeners for operations |
| File intake | Firebase Storage | Secure report uploads with rules |
| AI | Gemini 3.0 Flash (`@google/genai`) | Fast extraction, matching, and summarization |
| Geo | Google Maps JS API | Locality heat signals and marker-based prioritization |
| Frontend | Next.js App Router + Tailwind + Framer Motion | Fast UX and modular feature pages |

## Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Create environment file
Create `.env.local` in project root with:

```bash
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Gemini direct API mode
GEMINI_API_KEY=

# Optional: Vertex AI mode instead of direct Gemini key
GOOGLE_GENAI_USE_VERTEXAI=false
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=
```

### 3. Run app
```bash
npm run dev
```

### 4. Useful scripts
```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Data and Security Notes
- Firestore rules enforce authenticated reads and coordinator-gated writes for most collections.
- Storage rules scope uploads under `reports/{userId}/...` and enforce owner writes.
- First user bootstrap can be coordinator; subsequent users are role-based through onboarding/admin flows.

## Demo Data
Admin panel seeding currently includes:
- 6 localities
- 15 volunteers
- 10 community reports
- 2 camp plans
- 12 patient visits
- 12 medicine stock entries

This makes full demo traversal possible without manual dataset prep.

## Project Status
Active Google Solution Challenge 2026 build.

Current focus:
- Strengthening extraction-to-storage continuity for automated downstream updates.
- More robust role-scoped experiences and validation.
- Production deployment hardening and observability.

Built for social impact with a clear goal: help NGOs make faster, fairer, and more explainable resource allocation decisions.
