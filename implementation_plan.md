# SevaSetu AI — Final Implementation Plan v4

## Positioning

**SevaSetu AI is a Smart Resource Allocation platform for NGOs, with community health camp coordination as the flagship workflow and demo scenario.**

**One-line pitch:** *SevaSetu AI turns scattered NGO field reports into clear local need signals and intelligently matches the right volunteers to the right tasks and locations.*

---

## Architecture: GCP + Firebase Hybrid

| Capability | Choice | Why |
|------------|--------|-----|
| **Auth** | Firebase Auth (Google Sign-In) | Same backend as Identity Platform, simpler, free |
| **Database** | Firestore (Firebase SDK) | Real-time `onSnapshot` for camp-day ops queues |
| **Storage** | Cloud Storage (Firebase SDK client + GCS admin server) | Easy uploads + signed URLs |
| **AI/ML** | **Gemini Developer API first** → Vertex AI in production | Developer API for fast local dev; Vertex AI for production SLA/data privacy. Same `@google/genai` unified SDK, one config toggle |
| **Maps** | Google Maps JavaScript API + Visualization/Heatmap | Live markers + heatmap layer |
| **Hosting** | Firebase App Hosting (on Cloud Run) | Managed CI/CD, SSR, API routes |
| **Audit** | Firestore collection | In-app visibility |

---

## Credentials

`.env.local` (gitignored, real values — see `.env.local.example` for structure):

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sevasetu-ai.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sevasetu-ai
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sevasetu-ai.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<your-app-id>
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<your-measurement-id>

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>

# Gemini (Developer API — used for local dev)
GEMINI_API_KEY=<your-gemini-api-key>

# Vertex AI (production toggle)
GOOGLE_CLOUD_PROJECT=sevasetu-ai
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
```

> [!NOTE]
> `GOOGLE_GENAI_USE_VERTEXAI=false` → uses Gemini Developer API with API key (local dev).
> Set to `true` in production → uses Vertex AI with Application Default Credentials (Cloud Run).

---

## UI / Design Direction

### Material UI–Inspired Premium Design

> [!IMPORTANT]
> We want **beautiful, animated, premium interfaces** inspired by Material Design. Not a minimal dashboard — a product that wows at first glance.

| Principle | Implementation |
|-----------|---------------|
| **Elevation & Depth** | Multi-level card shadows (sm → md → lg), layered surfaces, floating action elements |
| **Motion & Micro-animations** | Smooth page transitions, card hover lifts, button ripple effects, skeleton loaders that pulse, staggered list animations |
| **Color & Warmth** | Warm terracotta/saffron primary, forest green secondary — mission-driven, not cold SaaS blue |
| **Typography** | Inter font, clear hierarchy with weight/size contrast, generous spacing |
| **Interactive Feedback** | Hover scale effects, active press states, toast notifications with slide-in, progress indicators |
| **Glassmorphism Touches** | Frosted glass sidebar, translucent overlays, blur-backdrop modals |
| **Data Visualization** | Animated counters, progress rings, color-coded urgency badges with glow effects |
| **Responsive & Fluid** | Fluid grid, collapsible sidebar, mobile-first breakpoints |

### Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#D4622B` | CTAs, active nav, accents |
| Primary Light | `#F0845C` | Hover states |
| Primary Pale | `#FEF3EC` | Badge & card backgrounds |
| Secondary | `#2D6A4F` | Success, health indicators |
| Secondary Light | `#40916C` | Secondary buttons |
| Accent | `#F4A261` | Highlights, notifications |
| Background | `#FAF9F6` | Page background |
| Surface | `#FFFFFF` | Cards, panels |
| Surface Elevated | `#FFFFFF` with `shadow-lg` | Floating cards |
| Sidebar BG | `#1B2E25` | Dark green sidebar with frosted glass effect |
| Sidebar Text | `#E8E4DF` | Light sidebar labels |
| Text Primary | `#1A1A1A` | Headings, body |
| Text Secondary | `#6B7280` | Captions, metadata |
| Border | `#E5E2DC` | Card borders, dividers |
| Critical | `#DC2626` | Urgency critical (with subtle glow) |
| High | `#EA580C` | Urgency high |
| Medium | `#D97706` | Urgency medium |
| Low | `#65A30D` | Urgency low |
| Font | `Inter` | Google Fonts, weights 400/500/600/700 |
| Radius | `12px` / `16px` | Buttons / Cards |
| Transition | `all 0.2s cubic-bezier(0.4, 0, 0.2, 1)` | Material motion curve |

---

## AI Architecture

### Model: `gemini-3.0-flash` (Gemini 3 Flash)
### Location: `global`

All AI calls go through **Next.js API routes** (server-side only).

### SDK Setup
```typescript
// src/lib/ai/client.ts — Developer API first, Vertex AI toggle for production
import { GoogleGenAI } from '@google/genai';

const useVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

export const genai = new GoogleGenAI(
  useVertexAI
    ? { vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT!, location: process.env.GOOGLE_CLOUD_LOCATION! }
    : { apiKey: process.env.GEMINI_API_KEY! }
);

export const MODEL = 'gemini-3.0-flash';
```

### Hybrid Urgency Scoring

> [!IMPORTANT]
> **Deterministic base score first, AI-enhanced second.** Transparent, debuggable, demo-friendly. You can clearly explain why one locality outranked another.

```
Urgency Score = Deterministic Base (70%) + AI Adjustment (30%)

Base Score Components:
  - Severity of reported issues      (0-25)
  - Recency of reports               (0-20)
  - Repeat complaint frequency       (0-20)
  - Service gap (days since camp)    (0-15)
  - Vulnerability index              (0-20)

AI Layer (Gemini 3 Flash):
  - Validates/adjusts the base score
  - Generates human-readable urgency reasoning
  - Flags anomalies the formula might miss
```

### AI Modules

| Module | Endpoint | Input → Output |
|--------|----------|----------------|
| Report Structuring | `POST /api/ai/extract` | Raw text → JSON (locality, issues, urgency signals, affected count, support needed, confidence, entities) |
| Urgency Scoring | `POST /api/ai/score` | Extracted reports + base score → Validated score + reasoning text |
| Resource Matching | `POST /api/ai/recommend` | Camp requirements + volunteer profiles → Ranked list with match scores + reasoning |
| Summary Generation | `POST /api/ai/summarize` | Patient visits, dispense logs, followups → Markdown summary + impact stats + recommendations |

---

## Project Structure

```
sevasetu-ai/
├── public/assets/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing page (public)
│   │   ├── auth/page.tsx           # Google Sign-In + role selection
│   │   ├── dashboard/page.tsx
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── localities/page.tsx
│   │   ├── planner/page.tsx
│   │   ├── allocation/page.tsx
│   │   ├── operations/page.tsx
│   │   ├── impact/page.tsx
│   │   ├── admin/page.tsx
│   │   └── api/ai/
│   │       ├── extract/route.ts
│   │       ├── score/route.ts
│   │       ├── recommend/route.ts
│   │       └── summarize/route.ts
│   ├── components/
│   │   ├── layout/       # Sidebar, Navbar, PageShell, AuthGuard
│   │   ├── dashboard/    # UrgencyCard, MetricCard, TopLocalities, NextCampCard
│   │   ├── reports/      # ReportIntakeForm, FileUploader, ExtractionPreview
│   │   ├── localities/   # LiveHeatmap, PriorityList, UrgencyReasoningPanel
│   │   ├── planner/      # CampPlanForm, TurnoutPredictor, StaffRecommendation
│   │   ├── allocation/   # VolunteerCard, MatchScoreBadge, RoleSlot, AllocationBoard
│   │   ├── operations/   # QueueColumn, PatientCard, StageFlow
│   │   ├── impact/       # SummaryCards, ImpactChart, GeneratedReport
│   │   └── ui/           # Button, Card, Badge, Input, Select, Modal, Tabs, Spinner, EmptyState, ErrorState
│   ├── lib/
│   │   ├── firebase/     # config.ts, auth.ts, firestore.ts, storage.ts
│   │   ├── ai/           # client.ts, prompts.ts, parsers.ts
│   │   ├── scoring/      # deterministic.ts (base urgency scoring formula)
│   │   ├── maps/         # config.ts
│   │   └── utils.ts
│   ├── hooks/            # useAuth, useCollection, useDocument, useLocalityScores
│   ├── contexts/         # AuthContext.tsx
│   ├── types/            # index.ts
│   └── data/             # seed.ts
├── firestore.rules       # ← Deployed in Phase 1
├── storage.rules         # ← Deployed in Phase 1
├── .env.local
├── .env.local.example
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## Firestore Schema

### Enums
```typescript
enum UserRole { COORDINATOR, FIELD_VOLUNTEER, DOCTOR, PHARMACIST, SUPPORT }
enum UrgencyLevel { CRITICAL, HIGH, MEDIUM, LOW }
enum VisitStage { REGISTERED, TRIAGED, IN_CONSULTATION, AT_PHARMACY, REFERRED, COMPLETED, FOLLOWUP }
enum CampStatus { DRAFT, PLANNED, ACTIVE, COMPLETED, CANCELLED }
enum ReportStatus { RAW, PROCESSING, EXTRACTED, FAILED }
```

### 12 Collections

| Collection | Key Fields |
|------------|------------|
| `users` | uid, displayName, email, photoURL, role, phone, createdAt |
| `volunteer_profiles` | userId, skills[], certifications[], languages[], availability, preferredAreas[], travelRadiusKm, completedCamps, rating |
| `community_reports` | submittedBy, rawText, fileUrls[], source, locality, status, createdAt |
| `extracted_reports` | reportId, locality, issueTypes[], urgencySignals[], estimatedAffected, supportNeeded[], confidence, entities{}, processedAt |
| `localities` | name, district, state, coordinates{lat,lng}, urgencyScore, urgencyBreakdown{}, baseScore, aiAdjustment, aiReasoning, lastCampDate, totalCamps, population, vulnerabilityIndex, issues[] |
| `camp_plans` | localityId, title, scheduledDate, status, predictedTurnout, requiredRoles{}, assignedStaff[], coordinatorId, notes |
| `assignments` | campId, volunteerId, role, matchScore, matchReasoning, confirmed, assignedAt |
| `patient_visits` | campId, patientName, age, gender, stage, chiefComplaint, triagePriority, consultationNotes, prescriptions[], referralNeeded, followupNeeded |
| `medicine_stock` | campId, medicineName, category, quantityAvailable, quantityDispensed, unit, expiryDate |
| `dispense_logs` | visitId, campId, medicineId, quantity, dispensedBy, dispensedAt |
| `followups` | visitId, campId, patientName, reason, scheduledDate, status, notes, assignedTo |
| `audit_logs` | userId, action, collection, documentId, timestamp, details |

---

## Security Rules (Phase 1 — Written Before Any Data Flows)

> [!WARNING]
> Production-mode Firestore starts **locked down**. Rules MUST be written in Phase 1 or seeding, uploads, and authenticated writes will all fail.

### Firestore Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    function isCoordinator() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'COORDINATOR';
    }
    function isOwner(userId) { return request.auth.uid == userId; }

    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isCoordinator();
    }
    match /volunteer_profiles/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isCoordinator());
    }
    match /community_reports/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isCoordinator();
    }
    match /{path=**} {
      allow read: if isAuthenticated();
      allow write: if isCoordinator();
    }
  }
}
```

### Storage Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /reports/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### First Coordinator Bootstrap

> [!WARNING]
> `isCoordinator()` checks `users/{uid}.role == 'COORDINATOR'`, so the **first coordinator account** must be explicitly handled before admin seeding and coordinator-only actions work.
>
> **Bootstrap flow:** First sign-in creates `users/{uid}`. Role is selected on the onboarding screen. The **first user** who signs in is automatically assigned the `COORDINATOR` role (checked via empty `users` collection). Subsequent users select their role normally.

### Firestore Composite Indexes

> [!NOTE]
> Composite indexes will be **created on demand** when queries require them. Firestore will surface index creation links in the browser console when a query needs one. No pre-configured indexes are required at scaffold time.

---

## Seed Data (via Admin Page → Firestore Batch Writes)

| Data | Count |
|------|-------|
| Community reports | 10 realistic Indian rural health field notes |
| Extracted reports | 10 pre-structured |
| Localities | 6 real Indian localities with lat/lng |
| Volunteers | 15 (doctors, pharmacists, translators, registrars) |
| Camp plans | 2 (1 upcoming, 1 completed) |
| Patient visits | 20 across all stages |
| Medicine stock | 12 essential medicines |
| Dispense logs | 8 |
| Followups | 5 |

---

## Build Phases (MVP-First, Revised Order)

> [!IMPORTANT]
> **P1 + P2 + demo-critical P3 = the intelligence story judges care about.**
> If time is tight: simplify heatmap polish, advanced impact reporting, admin niceties.
> **Never sacrifice**: extraction, scoring, recommendation, camp-planning workflow.

### Phase 1 — Scaffold + Infrastructure + First-Run Path
1. Scaffold Next.js (App Router, TypeScript, Tailwind, ESLint)
2. Install dependencies
3. Create `.env.local` with real credentials + `.env.local.example` with placeholders
4. All TypeScript types (`src/types/index.ts`)
5. Firebase config, auth, Firestore CRUD helpers, storage helpers
6. **Firestore security rules + Storage security rules** ← moved here from P4
7. `@google/genai` client (Developer API mode, Vertex AI toggle)
8. Google Maps loader config
9. Deterministic urgency scoring engine (`src/lib/scoring/deterministic.ts`)
10. AuthContext + AuthGuard
11. **Minimal landing page** (public, with pitch + CTA) ← moved here from P4
12. **Auth page** (Google Sign-In + role selection) ← moved here from P4
13. Root layout with animated Sidebar + Navbar
14. All page stubs with proper routing
15. Reusable UI components with Material-inspired animations
16. Seed data (`src/data/seed.ts`)
17. Admin seed page (writes to Firestore)

### Phase 2 — Core Intelligence (Demo-Critical)
1. Dashboard with real Firestore queries (animated urgency cards, metrics, top localities, next camp)
2. Report intake form (paste text + upload to Cloud Storage)
3. AI extraction API route → Firestore → animated extraction preview
4. Locality priority list with urgency reasoning panel
5. Locality map (functional, markers + basic heatmap — polish later)

### Phase 3 — Planning & Operations (Demo-Critical)
1. Camp planner: locality selection, turnout prediction, role requirements
2. AI staffing recommendation API route
3. Volunteer allocation board with animated match scores
4. Camp-day operations: real-time queues with Firestore `onSnapshot`
5. Patient flow: registration → triage → consultation → pharmacy → referral → follow-up

### Phase 4 — Impact & Polish
1. Impact reports with aggregated Firestore queries
2. AI summary generation API route
3. Heatmap visual polish (advanced heatmap layer, better markers)
4. Landing page animations and polish
5. All remaining loading/error/empty states
6. Responsive fine-tuning
7. Final UI animation polish pass

---

## Dependencies

```json
{
  "firebase": "^11.x",
  "@google/genai": "^1.x",
  "@googlemaps/js-api-loader": "^1.x",
  "@vis.gl/react-google-maps": "^1.x",
  "react-hot-toast": "^2.x",
  "lucide-react": "^0.x",
  "date-fns": "^4.x",
  "framer-motion": "^12.x"
}
```

> [!NOTE]
> Added `framer-motion` for premium page transitions, staggered list animations, and micro-interactions matching the Material UI–inspired design direction.

---

## Verification Plan

### Build
- `npm run build` — zero errors
- `npm run lint` — clean

### Functional (Browser)
1. Landing page renders public with animations
2. Google Sign-In → role selection → user doc in Firestore
3. Dashboard loads real Firestore metrics with animated cards
4. Submit report → Gemini 3 Flash extracts → saved → preview
5. Localities page: Google Maps + priority list with urgency reasoning
6. Camp planner → AI recommends staff
7. Operations queues with real-time updates
8. Impact page aggregates camp data
9. Admin seeds demo data to Firestore

**Approve and I'll start building Phase 1 immediately.**
