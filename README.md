# SevaSetu AI

![SevaSetu AI](https://img.shields.io/badge/Google_Solution_Challenge-2026-F4A261?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Beta_MVP-2D6A4F?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16+-black?style=for-the-badge&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-V12-FFCA28?style=for-the-badge&logo=firebase)
![Gemini](https://img.shields.io/badge/Gemini-3.0_Flash-4285F4?style=for-the-badge&logo=google)

**SevaSetu AI is a Smart Resource Allocation platform for NGOs, with community health camp coordination as its flagship workflow and demo scenario.** 

*One-line pitch: SevaSetu AI turns scattered NGO field reports into clear local need signals and intelligently matches the right volunteers to the right tasks and locations.*

---

## 🎯 The Problem 
NGOs running community health camps receive field data from scattered surveys, notes, spreadsheets, and prior reports. Without proper aggregation and analysis, the most urgent communities are underserved while available volunteers are misallocated. Resources exist, but visibility doesn't.

## 💡 The Solution
SevaSetu AI provides an **AI-powered coordination hub**. 
It ingests messy reports, uses **Gemini 3 Flash** to structure and classify needs, scores localities by urgency with transparent hybrid reasoning, recommends optimal staff assignments based on constraints (distance, languages, availability, skills), and powers real-time camp-day operations tracking.

---

## 🏗 Architecture: GCP + Firebase Hybrid

SevaSetu uses a highly scalable, serverless hybrid architecture tailored for rapid operational data loops and AI generation tasks.

| Capability | Choice | Why |
|------------|--------|-----|
| **Auth** | Firebase Auth (Google Sign-In) | Immediate, secure, frictionless onboarding. |
| **Database** | Firestore (Firebase SDK) | Real-time `onSnapshot` for camp-day operations and queues. |
| **Storage** | Cloud Storage (Firebase SDK) | Scalable file uploads (reports) heavily secured by Rules. |
| **AI/ML** | **Gemini Developer API first** → Vertex AI | Powered by Gemini 3.0 Flash via the unified `@google/genai` SDK. Fast text extraction, scoring verification, and multi-variable matching. |
| **Maps** | Google Maps JS API + Visualization | Live markers and Heatmap layers to display urgency scoring geographically. |
| **Frontend** | Next.js 16+ (App Router) | High-performance, scalable React framework with Tailwind CSS & Framer Motion for premium UI. |

---

## 🚀 Key Features

### 1. Ingest Field Data (AI Extraction)
Users can paste messy field notes or upload raw survey documents. The system pings the Gemini API, which extracts structured JSON payload immediately identifying:
- Exact locality and sub-regions
- Mentioned health issues (e.g. TB, maternal health, malnourishment)
- Urgency signals ("children hospitalized")
- Estimated affected count
- Support types needed

### 2. Locality Prioritization & Hybrid Scoring
No black box AI. SevaSetu AI uses a **Deterministic base score (70%) + AI Adjustment (30%)** approach.
- **Deterministic**: Factors in mathematical severity, recency, repeat complaints, service gaps, and base vulnerability index.
- **AI Layer**: Gemini validates the score against recent field reports, adjusts it (+/- 10 points) if necessary, and writes a human-readable 2-sentence explanation of *why* the locality is scored the way it is.
- **Geospatial view**: Visually plotted on a Live Google Map with Heatmap layers indicating critical zones.

### 3. Smart Team Matching
When an NGO plans a camp, Gemini scans available volunteers to fulfill the required roles (Doctors, Pharmacists, Field workers, Support). It generates match scores predicting the best fit based on:
- Distance / Travel radius from locality
- Language overlapping (Tribal/Regional languages)
- Specializations & Certifications
- Past completion rating
Availability is enforced.

### 4. Camp-Day Operations
A real-time Kanban flow using Firestore `onSnapshot`. Patients move through Registration → Triage → Consultation → Pharmacy → Complete. Allows coordinators to visually see bottlenecks and triage critical patients dynamically.

### 5. Impact Reports
Post-camp outcomes are aggregated (patients served, critical cases, medicines dispensed) and piped through Gemini to generate intelligent text summaries, offering actionable follow-up recommendations and inventory alerts for future camps at that locality.

---

## 📋 Implementation Plan & Progress

We have strictly executed a 4-phase rollout to hit a Production-Grade MVP.

### Phase 1: Scaffold + Infrastructure + First-Run Path — ✅ COMPLETE
- ✅ Scaffold Next.js (App Router, TypeScript, Tailwind CSS, ESLint).
- ✅ Integrate dependencies (`firebase`, `@google/genai`, `@googlemaps/js-api-loader`, `framer-motion`).
- ✅ Create centralized TypeScript types corresponding to 12 Firestore collections and Enums.
- ✅ Firebase Config, helper classes, storage boundaries.
- ✅ Firestore and Storage Security Rules (Role-based access).
- ✅ `@google/genai` client integration.
- ✅ Google Maps v2 functional API loader.
- ✅ Deterministic Urgency Engine implementation.
- ✅ Firebase AuthContext + AuthGuard component.
- ✅ Landing Page (Framer Motion animations, Hero, Features).
- ✅ Split-Screen Auth Page (Role-based onboarding flow).
- ✅ Core Layout (App Shell, Navbar, Glassmorphism Sidebar).
- ✅ Database Seeder with realistic Indian rural/urban health context (6 localities, 15 volunteers, 10 reports, 2 camp plans, 12 patient visits, 12 medicine stocks).

### Phase 2: Core Intelligence (Intake & Prioritization) — ✅ COMPLETE
- ✅ Real-time operations Dashboard (Metric counters, upcoming camps, priority locality ranked feeds).
- ✅ Report Intake form (with text + file upload parsing).
- ✅ **AI Route**: `/api/ai/extract` — Successfully structuring messy data into precise JSON entities.
- ✅ Localities Prioritization Board — Urgency lists and score breakdowns.
- ✅ **AI Route**: `/api/ai/score` — Gemini processing human-readable justification for the score values.
- ✅ Google Maps Heatmap integration with `AdvancedMarkerElement` and custom UI overlays reacting directly to Firestore changes.

### Phase 3: Planning & Operations — ✅ COMPLETE
- ✅ Camp Planner Form.
- ✅ **AI Route**: `/api/ai/recommend` — Live parsing of volunteer structures vs required roles to auto-recommend optimized NGO teams.
- ✅ Volunteer Allocation hub (Search, Skill badges, custom Availability toggles).
- ✅ Real-Time Camp-Day Operations Kanban Board — Powered entirely by `onSnapshot` rendering live updates to patient stages without refreshing.

### Phase 4: Impact & Polish — ✅ COMPLETE
- ✅ Post-Camp Impact Analytics view (Metric cards, outcome distribution, pending followups).
- ✅ **AI Route**: `/api/ai/summarize` — Generative pipeline constructing actionable post-camp conclusions and observations based on metadata logs.
- ✅ Animations polish — Staggered Framer Motion lists, unified spring transitions.
- ✅ Build passes completely with *zero errors*. Fully Next.js 16 / React 19 capable. 

---

## 💻 Tech Stack Deep Dive
- **Framework**: Next.js 16 (App Router)
- **Styling**: TailwindCSS 4, custom CSS Utilities (`globals.css`), Framer Motion (for all interactions, stagger arrays, page routing UI).
- **Icons**: `lucide-react`
- **Database**: Google Firebase (Firestore, Storage, Authentication)
- **AI**: Gemini (`@google/genai`) via `gemini-3.0-flash` (Global availability).
- **Geospatial**: Google Maps Platform (`js-api-loader`).

---

*Developed for the Google Solution Challenge 2026. Built with ❤️ for social impact.*
