<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Clone-and-run setup (any machine)

To get the project running on a fresh PC after cloning, you only need the env file and these commands.

### Prerequisites
- Node.js **20.x** and npm **10.9.7** (see `engines` in `package.json`)
- (Optional, for Cloud Run deploy) `gcloud` CLI authenticated to project `sevasetu-ai`

### Steps
```powershell
git clone https://github.com/RamNarra/SevaSetu-AI.git
cd SevaSetu-AI

# 1. Copy your secrets into .env.local (template at .env.local.example)
#    Required keys are listed in .env.local.example.
#    For Firebase Admin SDK on the server side, also place
#    sevasetu-ai-firebase-adminsdk.json at the repo root if you have it.
copy .env.local.example .env.local
notepad .env.local   # paste real values

# 2. Install + run
npm install
npm run dev          # http://localhost:3000
```

### Required env vars (see `.env.local.example`)
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web config (project `sevasetu-ai`)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Maps JS API
- `GEMINI_API_KEY` — Google AI Studio key (Gemini Developer API)
- `GOOGLE_CLOUD_PROJECT=sevasetu-ai`, `GOOGLE_CLOUD_LOCATION=global`, `GOOGLE_GENAI_USE_VERTEXAI=false`

### Production deploy (Cloud Run)
```powershell
gcloud run deploy sevasetu-ai --source . --region asia-south1 --project sevasetu-ai --allow-unauthenticated --port 8080 --memory 1Gi --cpu 1 --timeout 300 --max-instances 5 --quiet
```
Live URL: `https://sevasetu-ai-152831472198.asia-south1.run.app`. Cloud Build runs in `asia-south1` — always pass `--region=asia-south1`.

### Demo / admin emails
Listed in `src/contexts/AuthContext.tsx` → `ADMIN_EMAILS`. Any email in that set is auto-promoted to `COORDINATOR` on sign-in, even when the Firestore `users/{uid}` doc is missing or unreachable. Add new admins by extending that set and redeploying.

### Key files for new contributors
- `src/contexts/AuthContext.tsx` — auth + admin override
- `src/lib/ai/client.ts` — Gemini client + 3-model fallback chain (`gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash`)
- `src/lib/ai/schemas.ts` — Zod schemas (lenient extraction)
- `src/data/seed.ts` — demo seed data (run from `/admin` page)
- `DEMO_SCRIPT.md` + `DEMO_DATA.md` — recorded-demo runbook
