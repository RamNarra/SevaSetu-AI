# SevaSetu AI — Full QA Simulation Report

**Date:** June 9, 2025  
**Prepared by:** QA Lead / NGO Operations Planner / Demo Strategist  
**App Version:** Next.js 16.2.3 (Turbopack), Firebase SDK 12.12.0, Gemini 3 Flash  
**Test Environment:** localhost:3000, Firestore `nam5`, Chrome via Playwright  

---

## 1. Realistic NGO Scenario

### Context: 100–200 Person Health Camp in Rural India

**Organization:** A mid-size Indian NGO running primary healthcare camps for underserved communities.  
**Geography:** Rampur Village, Barabanki District, Uttar Pradesh — a cluster of 4,200 people with no primary health center within 15 km, contaminated water sources, and high child malnutrition rates.

**Real-World Triggers:**
- Field volunteers report waterborne disease outbreak (diarrhea, skin rashes)
- Last camp was 8 months ago — service gap is critical
- District health officer flags 50+ families affected
- NGO coordinator must rapidly plan, staff, and execute a health camp

**Personas:**
| Role | Name | In System |
|------|------|-----------|
| NGO Coordinator | Ram Charan Narra | ✅ Logged in as COORDINATOR |
| Field Volunteer (ASHA) | Meera Devi | ✅ Seeded volunteer |
| Community Health Worker | Rajesh Munda | ✅ Seeded volunteer (Odisha) |
| Pediatrician | Dr. Priya Sharma | ✅ Seeded (rating 4.8, 12 camps) |
| Dermatologist | Dr. Ravi Kumar | ✅ Seeded (rating 4.6, 8 camps) |
| Pharmacist | Deepa Reddy | ✅ Seeded (rating 4.5) |
| Community Members | Rekha, Mohammad Ali, Raju, Kamla Bai, etc. | ✅ 12 patient visits seeded |

---

## 2. Demo Case: End-to-End Story

**Story Arc:** "From Field Report to Impact Report in One Sitting"

1. **ASHA worker Meera** submits a field report via WhatsApp/text about the water crisis in Rampur
2. **AI extracts** structured data: locality, issues, urgency signals, affected count
3. **Coordinator Ram** views the **Locality Prioritization** map — Rampur is flagged CRITICAL (82/100)
4. **Ram plans** a health camp targeting Rampur with AI-recommended staffing
5. **AI matches** volunteers by language (Hindi+Odia), proximity, skills, and certifications
6. **On camp day**, patients flow through the 5-stage Kanban (Registration → Triage → Consultation → Pharmacy → Completed)
7. **After camp**, the Impact module generates an AI summary with recommendations for the next intervention

---

## 3. Actors, Data & Test Inputs

### Seeded Data (via Admin → Seed All Data)

| Collection | Count | Key Examples |
|-----------|-------|-------------|
| `localities` | 6 | Rampur Village (82 CRITICAL), Koraput Block (76 CRITICAL), Dharavi (68 HIGH), Jhabua (55 HIGH), Sundarbans (45 MEDIUM), Anantapur (32 LOW) |
| `volunteer_profiles` | 15 | 5 doctors, 3 pharmacists, 3 field volunteers, 4 support staff |
| `community_reports` | 10 | Reports across all 6 localities with health issues |
| `camp_plans` | 2 | Rampur (PLANNED, Apr 20), Anantapur (COMPLETED, Mar 15) |
| `patient_visits` | 12 | 8 for Rampur camp (various stages), 4 for Anantapur (COMPLETED) |
| `medicine_stock` | 12 | Paracetamol 500, ORS 200, Amoxicillin 300, etc. |

### Test Input Used
**Sample Report 1:** "Visited Rampur village on 3rd April. Saw many children with skin rashes and diarrhea. Clean water not available. At least 50 families affected. Need dermatologist and pediatrician. Very urgent — last camp was 8 months ago."

---

## 4. Module-by-Module Live Simulation Results

### 4.1 Admin Panel
| Test | Result | Details |
|------|--------|---------|
| Seed All Data | ✅ PASS | All 6 categories seeded successfully with checkmarks |
| Data persists | ✅ PASS | Data visible across all modules after seeding |

### 4.2 Dashboard
| Test | Result | Details |
|------|--------|---------|
| Metrics display | ✅ PASS | 6 Localities, 10 Reports, 15 Volunteers, 2 Camps |
| Priority Localities | ✅ PASS | Ranked by urgency: Rampur 82 > Koraput 76 > Dharavi 68 > Jhabua 55 > Sundarbans 45 |
| Next Camp card | ✅ PASS | Shows "Rampur Emergency Health & Water Safety Camp", 20 Apr 2026, 5 staff |
| Critical Alert | ✅ PASS | "2 localities need immediate attention" |
| User greeting | ✅ PASS | "Welcome back, Ram" |

### 4.3 Reports (Field Report Submission + AI Extraction)
| Test | Result | Details |
|------|--------|---------|
| Page load | ✅ PASS | Paste textarea, upload dropzone, 3 sample reports |
| Load Sample Report 1 | ✅ PASS | Text populated, toast "Sample report loaded" |
| Submit & Extract | ✅ PASS | Report saved to Firestore, AI extraction triggered |
| AI Extraction accuracy | ✅ PASS | Locality: "Rampur village", Issues: skin rashes/diarrhea/waterborne disease, Urgency: "very urgent"/"last camp 8 months ago", Affected: 200, Confidence: 0.95 |
| Entities display | ⚠️ BUG | Shows `[object Object]` instead of rendering entity data |

### 4.4 Localities (Map + Urgency Analysis + Rescore)
| Test | Result | Details |
|------|--------|---------|
| Google Maps rendering | ✅ PASS | Map centered on India, markers visible for localities |
| Urgency legend | ✅ PASS | Critical (red), High (orange), Medium (yellow), Low (green) |
| Priority Ranking list | ✅ PASS | All 6 localities ranked correctly by urgency score |
| Urgency Analysis panel | ✅ PASS | Score breakdown bars (Severity 22/25, Recency 20/20, etc.) |
| AI Analysis text | ✅ PASS | Contextual reasoning about waterborne diseases, service gap |
| Reported Issues tags | ✅ PASS | waterborne disease, skin infections, malnutrition, no clean water |
| **Re-analyze (Rescore)** | ❌ **CRITICAL BUG** | Score dropped from **82 CRITICAL → 41 MEDIUM**. Severity: 22→0, Recency: 20→0, Repeat Complaints: 15→0. Root cause: Rescore fetches `extracted_reports` collection but seed data only populates `community_reports`. The deterministic scoring pipeline breaks without extracted_reports data. |
| Heatmap Layer | ⚠️ DEPRECATION | Google Maps Heatmap Layer deprecated May 2025, will be removed May 2026 |

### 4.5 Camp Planner (AI Staffing Recommendations)
| Test | Result | Details |
|------|--------|---------|
| Locality selector | ✅ PASS | All 6 localities shown with urgency scores, sorted correctly |
| Auto-fill camp title | ✅ PASS | "Koraput Block Health Camp" auto-populated |
| Predicted turnout | ✅ PASS | ~272 patients (6,800 × 0.04) |
| Role counters (+/-) | ✅ PASS | Doctors 2, Pharmacists 1, Field Volunteers 2, Support 3 |
| Get AI Staff Recommendations | ✅ PASS | Gemini analyzed all 15 volunteers in 21s |
| Recommendation quality | ✅ EXCELLENT | Contextual reasoning: Rajesh Munda "local to Odisha, speaks Odia and Kui"; Dr. Sunita Rao "Odisha preferred area, Telugu skills"; Sanjay Tribal HW "specialized tribal health knowledge, Gondi language" |
| Auto-selection | ✅ PASS | Top 8 volunteers auto-selected with green checkmarks |
| Create Camp Plan | ✅ PASS | Camp saved to Firestore, form reset, 8 staff assigned |
| Date input | ✅ PASS | Date picker functional |

### 4.6 Allocation (Volunteer Management + AI Match)
| Test | Result | Details |
|------|--------|---------|
| Camp selector | ✅ PASS | Shows newly created "Koraput Block Health Camp — PLANNED" |
| Camp details card | ✅ PASS | Date, status, role requirements displayed |
| Volunteer grid | ✅ PASS | Cards with name, role, rating, skills, camps count, travel radius |
| Role filters | ✅ PASS | All Roles, Doctors, Pharmacists, Field, Support buttons |
| Availability stats | ✅ PASS | Available: 13, Busy: 1, Assigned: 0 |
| **AI Match Scores** | ❌ **BUG** | 500 Internal Server Error — `SyntaxError: Unterminated string in JSON at position 2165`. Gemini's 4096 max output tokens insufficient for scoring all 15 volunteers. JSON truncated mid-response. |

### 4.7 Operations (Kanban Patient Flow)
| Test | Result | Details |
|------|--------|---------|
| Camp selector | ✅ PASS | Dropdown with All Camps + 3 camp options |
| Default selection | ⚠️ UX ISSUE | Defaults to newest camp (Koraput) which has 0 patients — confusing |
| Switch to Rampur camp | ✅ PASS | 8 patients loaded across 4 columns |
| Kanban board layout | ✅ PASS | 5 columns: Registration(2) → Triage(2) → Consultation(2) → Pharmacy(2) → Completed(0) |
| Patient cards | ✅ PASS | Name, age, gender, complaint, priority badge (CRITICAL/HIGH/MEDIUM/LOW) |
| Clinical tags | ✅ PASS | Referral, Follow-up, Rx count shown on pharmacy cards |
| **Move patient** | ✅ PASS | Mohammad Ali moved Registration → Triage, toast "Mohammad Ali → TRIAGED" |
| Polling update | ✅ PASS | Board refreshed within 5s polling cycle |
| Stats updated | ✅ PASS | Registration: 2→1, Triage: 2→3, totals correct |

### 4.8 Impact (Analytics + AI Summary)
| Test | Result | Details |
|------|--------|---------|
| Camp selector | ✅ PASS | All Camps view with 3 camp options |
| Stats cards | ✅ PASS | 12 Total Patients, 4 Consultations, 2 Referrals, 4 Follow-ups, 1 Camps Completed |
| Medicines Dispensed | ⚠️ DATA ISSUE | Shows 0 — seed data has dispensedQuantity: 0 for all medicines |
| Medicine Utilization bars | ✅ PASS | 8 medicines listed with quantity/capacity bars |
| Patient Outcomes grid | ✅ PASS | Registered: 1, Triaged: 3, In Consultation: 2, At Pharmacy: 2, Completed: 4, Referred: 2 |
| **Generate Summary** | ✅ PASS | AI generated comprehensive 5-section summary in ~15s |
| Summary quality | ✅ EXCELLENT | Includes: Key Statistics, Health Patterns, Critical Cases table, Recommendations, Resource Adequacy Assessment |
| Summary AI awareness | ✅ PASS | Correctly identified Mohammad Ali as CRITICAL in Triage (reflects live state after our Move action) |
| **Markdown rendering** | ❌ **BUG** | Summary displays as raw markdown text — `**bold**`, `###`, `| table |` syntax visible instead of rendered HTML |

---

## 5. Test Matrix

| Module | Load | Data Bind | AI Feature | User Action | Edge Case | Score |
|--------|------|-----------|------------|-------------|-----------|-------|
| Admin | ✅ | ✅ | N/A | ✅ Seed/Clear | Not tested-Clear | 4/5 |
| Dashboard | ✅ | ✅ | N/A | N/A | ✅ 0-state | 5/5 |
| Reports | ✅ | ✅ | ✅ Extract | ✅ Submit | ⚠️ entities bug | 4/5 |
| Localities | ✅ | ✅ | ✅ Analysis | ❌ Rescore breaks | ❌ Data pipeline gap | 2/5 |
| Planner | ✅ | ✅ | ✅ Recommend | ✅ Create camp | ✅ Auto-fill | 5/5 |
| Allocation | ✅ | ✅ | ❌ Match 500 | ✅ View/filter | ❌ JSON truncation | 3/5 |
| Operations | ✅ | ✅ | N/A | ✅ Move patient | ⚠️ Default camp | 4/5 |
| Impact | ✅ | ✅ | ✅ Summarize | ✅ Generate | ❌ No markdown render | 3.5/5 |

**Overall Module Score: 30.5 / 40 (76%)**

---

## 6. Failure Points & Root Causes

### ❌ P0 — Critical Bugs

**1. Rescore destroys locality urgency scores**
- **Impact:** Rampur Village dropped from 82 CRITICAL → 41 MEDIUM after Re-analyze
- **Root Cause:** `computeBaseUrgencyScore()` in `deterministic.ts` relies on `extracted_reports` collection, but seed data only writes to `community_reports`. Without extracted_reports, Severity/Recency/RepeatComplaints all resolve to 0.
- **Fix:** Either (a) seed `extracted_reports` alongside `community_reports`, or (b) fall back to `community_reports` data when `extracted_reports` is empty for a locality.

**2. Allocation AI Match Scores → 500 Error**  
- **Impact:** Core feature broken — cannot score volunteer-camp matches
- **Root Cause:** `maxOutputTokens: 4096` insufficient for JSON array of 15 volunteers with reasoning strings. Gemini truncates mid-JSON, parser throws `SyntaxError: Unterminated string`.
- **Fix:** (a) Increase `maxOutputTokens` to 8192, (b) paginate — score in batches of 5, or (c) add JSON repair logic to `parseJsonResponse()` that closes truncated arrays/objects.

### ⚠️ P1 — Medium Bugs

**3. AI Impact Summary renders raw markdown**
- **Impact:** Summary text shows `**bold**`, `###`, markdown table syntax instead of formatted HTML
- **Fix:** Use a markdown renderer (e.g., `react-markdown`) to render the AI summary text.

**4. Entities field shows `[object Object]`**
- **Impact:** Minor — extraction results panel has one broken field
- **Fix:** JSON.stringify the entities object or render key-value pairs.

### ⚠️ P2 — UX/Data Issues

**5. Medicine Dispensed always 0**
- **Impact:** Impact module's "Medicines Dispensed" stat is always 0
- **Root Cause:** Seed data sets `dispensedQuantity: 0` for all medicine stock items; no mechanism to record dispensing during Operations
- **Fix:** Add dispensing tracking in the Pharmacy stage of Operations.

**6. Operations defaults to newest (empty) camp**
- **Impact:** First load shows 0 patients — confusing for demos
- **Fix:** Default to the camp with the most active patients, or show "All Camps".

**7. Google Maps Heatmap Layer deprecated**
- **Impact:** Will break in May 2026
- **Fix:** Migrate to alternative visualization (e.g., marker clustering with color intensity).

---

## 7. Role-Based Operational Plan

### For a 150-Person Health Camp Demo

| Time | Activity | Module | Actor |
|------|----------|--------|-------|
| T-30 days | ASHA workers submit field reports | Reports | Field Volunteer |
| T-25 days | AI extracts issues, flags Rampur as CRITICAL | Reports → Localities | AI |
| T-20 days | Coordinator reviews urgency map, confirms camp | Localities | Coordinator |
| T-15 days | Plan camp with AI staffing recommendations | Planner | Coordinator |
| T-10 days | Review volunteer allocation, confirm assignments | Allocation | Coordinator |
| T-0 (Camp Day) | | Operations | |
| 08:00 | Open Registration | Operations — Registration column | Support Staff |
| 08:30 | Begin Triage (vitals, priority assessment) | Operations — Triage column | Field Volunteer |
| 09:00 | Doctor consultations begin | Operations — Consultation column | Doctor |
| 10:00 | Pharmacy dispensing | Operations — Pharmacy column | Pharmacist |
| 15:00 | Flag follow-ups, referrals | Operations — tags | Doctor |
| T+1 day | Generate Impact Summary | Impact | Coordinator |
| T+7 days | Review follow-ups list | Impact | Coordinator |

---

## 8. Stress Test: Judge's Perspective

### What a Competition Judge Would Notice

**Strengths:**
1. **End-to-end AI integration** — Gemini powers 4 distinct features (extract, score, recommend, summarize) with contextual, non-generic responses
2. **Beautiful UI** — Clean, purpose-built design with Tailwind. Urgency bars, Kanban board, and volunteer cards are visually compelling
3. **Real-world data model** — Types cover the actual complexity of NGO health camps (triage priorities, prescriptions, referrals, vulnerability indices)
4. **AI staffing recommendations are remarkable** — Language matching (Odia, Kui, Gondi), proximity analysis, certification awareness. This is the "wow" feature
5. **Impact summary is intelligent** — Identified health patterns, critical cases, and made actionable recommendations for next camp

**Weaknesses a Judge Would Catch:**
1. "Show me the Rescore feature" → Score drops from 82 to 41 (demo-breaking)
2. "Can I see volunteer match scores?" → 500 error (feature broken)
3. "Why is this summary not formatted?" → Raw markdown visible
4. "How do you track medicine dispensing?" → Not implemented
5. "What happens when there's no internet?" → No offline support, no error boundaries
6. "Can a volunteer see their assignments?" → No role-based views
7. "Where is the mobile experience?" → Not responsive for field workers

---

## 9. Honest Product Verdict

### Rating: 7.5 / 10 — "Strong MVP with Critical Demo Blockers"

**What Works Exceptionally Well:**
- The AI integration is genuine and contextual — not just prompt-and-display
- The workflow (Report → Locality → Plan → Allocate → Operate → Impact) is coherent
- Data model is production-grade for the use case
- Planner + AI Recommendations is the hero feature — it works flawlessly and produces impressive results
- Operations Kanban is functional and intuitive

**What Prevents a 9/10:**
- Two core features crash or produce wrong results (Rescore, Allocation Match)
- Impact summary doesn't render markdown (easy fix, high visual impact)
- No offline support (critical for rural India use case)
- No role-based views (volunteers can't see their own assignments)
- No medicine dispensing workflow
- Firebase Firestore lite SDK = no real-time updates (polling every 5s instead)

**Demo Readiness:** With 2-3 targeted fixes, this is a **strong 8.5/10 demo**.

---

## 10. Top Priority Fixes (Ordered by Impact)

### Fix 1: Rescore Data Pipeline (P0, ~30 min)
**Problem:** Rescore drops scores to 0 because `extracted_reports` collection is empty.  
**Fix:** In `localities/page.tsx` rescore handler, when `extracted_reports` is empty for a locality, fall back to the locality's existing `reportedIssues` array and `lastCampDate` for deterministic scoring. Seed `extracted_reports` from `community_reports` data during admin seed.

### Fix 2: Increase AI Token Limit for Allocation Match (P0, ~5 min)
**Problem:** `maxOutputTokens: 4096` causes JSON truncation for 15 volunteers.  
**Fix:** In `src/app/api/ai/recommend/route.ts`, change `maxOutputTokens: 4096` → `maxOutputTokens: 8192`. Add JSON repair fallback in `parseJsonResponse()` to handle truncated arrays.

### Fix 3: Render Markdown in Impact Summary (P1, ~10 min)
**Problem:** AI summary shows raw markdown text.  
**Fix:** Install `react-markdown` and wrap the summary text in `<ReactMarkdown>{summary}</ReactMarkdown>`.

### Fix 4: Fix Entities Display in Reports (P1, ~5 min)
**Problem:** Shows `[object Object]` for entities field.  
**Fix:** In the extraction result renderer, handle object types with `JSON.stringify()` or render as nested key-value pairs.

### Fix 5: Default Operations to Active Camp (P2, ~5 min)
**Problem:** Operations page defaults to empty newest camp.  
**Fix:** Sort camps by patient count descending, or default to "All Camps" view.

---

## Appendix: Live Test Evidence

### Screenshots Captured During Testing
1. Dashboard — 6 localities, 10 reports, 15 volunteers, 2 camps, priority list
2. Reports — Sample report loaded, AI extraction showing locality/issues/urgency
3. Localities — Google Maps with markers, urgency bars (22/25, 20/20, 15/20, 12/15, 13/20)
4. Localities Rescore — Score dropped from 82 to 41 (bug captured)
5. Camp Planner — AI recommended 13 volunteers with contextual reasoning
6. Allocation — Camp details card, volunteer grid, 500 error on AI Match
7. Operations Kanban — 8 patients in 5 columns, Move action succeeded
8. Impact — 12 patients, 4 follow-ups, AI summary generated with 5 sections

### API Response Times
| Endpoint | Time | Status |
|----------|------|--------|
| POST /api/ai/extract | 6.6s | ✅ 200 |
| POST /api/ai/score | 4.9s | ✅ 200 |
| POST /api/ai/recommend (Planner) | 21.0s | ✅ 200 |
| POST /api/ai/recommend (Allocation) | 23.6s | ❌ 500 |
| POST /api/ai/summarize | ~15s | ✅ 200 |

### Console Warnings
- Google Maps: `styles property cannot be set when mapId is present` (non-blocking)
- Google Maps: `use addEventListener('gmp-click')` instead of `click` (deprecation)
- Google Maps: Heatmap Layer deprecated May 2025, removed May 2026
