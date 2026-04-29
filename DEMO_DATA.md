# SevaSetu AI — Demo Day Data Pack

> Everything you need to paste, click, or read aloud during the recording. Print this on a second screen or have it open on your phone. Numbers in brackets like **[CLICK]** mean a screen action; everything else is dialogue or paste material.

---

## 0. Pre-flight (5 minutes before recording)

1. Open the live app: <https://sevasetu-ai-152831472198.asia-south1.run.app>
2. Sign in as your coordinator account (Ram Charan Narra). Confirm the badge in the top-right reads **COORDINATOR**.
3. In Chrome, open these tabs in this order, left to right — they will be your "scenes":
   - Tab 1: `/dashboard`
   - Tab 2: `/command-center`
   - Tab 3: `/reports`
   - Tab 4: `/workbench`
   - Tab 5: `/planner`
   - Tab 6: `/operations`
   - Tab 7: `/impact`
4. Hard-refresh (Ctrl+Shift+R) every tab so the latest deployed bundle is loaded.
5. Open this file on a phone or second monitor. Do **not** scroll it on the recorded screen.
6. Close Slack, Outlook, Teams, and any tray notification.
7. Press **F11** in the browser to go full-screen for the recording.

---

## 1. The two reports you will paste

### Report A — Koraput anaemia (use as your headline demo)

> *Paste this verbatim into the Reports → Paste Field Report textarea.*

```
Anganwadi worker from Koraput block reports severe anemia in pregnant women. 30+ cases in last 2 months. No iron supplements available at local PHC. Need blood tests and supplements. Community very worried.
```

**Why this one wins:** The model returns a clean, fully populated extraction with two urgency signals — `vulnerable_group` (pregnant women) and `supply_stockout` (PHC out of iron) — plus three medical needs at high confidence. It is the most visually impressive single output in the platform.

**Expected extraction (so you can speak to it confidently):**

| Field | Value |
|---|---|
| Locality | Koraput block (confidence 0.9) |
| Need 1 | Anaemia screening and treatment, severity 4, ~30 affected, conf 0.9 |
| Need 2 | Blood tests, severity 3, ~30 affected, conf 0.9 |
| Need 3 | Iron supplements, severity 4, ~30 affected, conf 0.9 |
| Urgency 1 | `vulnerable_group` — "severe anemia in pregnant women" |
| Urgency 2 | `supply_stockout` — "no iron supplements available at local PHC" |

### Report B — Rampur waterborne (back-up if A errors out)

```
Visited Rampur village on 3rd April. Saw many children with skin rashes and diarrhea. Clean water not available. At least 50 families affected. Need dermatologist and pediatrician. Very urgent — last camp was 8 months ago.
```

### Report C — Dharavi TB (only if you want to show a third example for variety)

```
Follow up note from Dharavi health post: TB screening camp needed urgently. 12 suspected cases reported by local clinic. Previous camp screened 200 people, found 8 positive. Area has high population density.
```

> **Only ever submit ONE new report on camera.** Submitting two or three quickly can hit the Gemini free-tier rate window (10 RPM). The extras are stand-ins in case Report A misbehaves.

---

## 2. The exact click path, second by second

> **Time markers** match the script in `DEMO_SCRIPT.md`. Open them side by side.

### 0:00 – 0:30 — ACT 1: The Pain
1. Start with a black slide or the SevaSetu **/dashboard** route blurred out.
2. Read the Priya monologue.
3. Fade in to the live dashboard.

### 0:30 – 1:15 — ACT 2: The Input
1. **[Tab 1 — /dashboard]** Scroll once gently to show the metric cards animating up.
2. **[Tab 2 — /command-center]** Pause one beat. Hover one of the deepest-red localities so the urgency tooltip and signal breakdown appear.
3. **[Tab 3 — /reports]** Click into the Paste Field Report card.
4. Paste **Report A** (Koraput).
5. Click **Submit To Backend Queue**.
6. Watch the toast: *"AI is reading the report..."* → *"Report stored and AI extraction completed."*
7. The extraction preview panel on the right will fill with the structured JSON. Pause for one beat — judges will see the live transformation.

### 1:15 – 2:30 — ACT 3: The Brain
1. **[Tab 4 — /workbench]** Click the refresh icon (top-right of the Pending Review panel) once.
2. The Koraput report is now top of the list with a 90% confidence pill and yellow evidence highlights on the right.
3. Hover over the yellow highlights one at a time — the speech track is "every output is anchored to the exact words".
4. Hover the green **90% Conf** pill to underline the confidence-threshold point.

### 2:30 – 3:30 — ACT 4: The Human in the Loop
1. **[Tab 4 — /workbench]** Click the green **Approve** button. Watch the report disappear from the queue.
2. Toast appears: *"Report approved"*.
3. **[Tab 5 — /planner]** The locality list is on the left, sorted by urgency.
4. **[CLICK]** the locality "Rampur Village" (or whichever is most urgent — it does not matter for the story).
5. Camp Title auto-fills (e.g. "Rampur Village Health Camp"). Leave it.
6. **[CLICK]** the small "Use tomorrow" link above the date input. The date fills in. *(This shortcut was added specifically for the demo.)*
7. Leave staff counts at the defaults. Read the talking line about doctors / pharmacists / volunteers / support.
8. **[CLICK]** **Get AI Staff Recommendations**. Wait for the cards to animate in. (Should take 1–3 seconds on `gemini-2.5-flash`.)
9. The top N volunteers are auto-selected with green check marks. Hover one card to show the explanation line — "Strong Hindi skills, preferred-area match, 12 prior camps".
10. **[CLICK]** the green **Create Camp Plan** button at the bottom. Toast: *"Camp plan created!"*

### 3:30 – 4:30 — ACT 5: The Impact
1. **[Tab 6 — /operations]** A list of in-progress assignments is visible. Click one to expand it.
2. **[CLICK]** *Dispense Medicine* on the expanded card. Pick "Iron supplements" or any medicine, set quantity to 5, submit.
3. Toast: *"Dispense logged via transaction successfully"*.
4. **[Tab 7 — /impact]** Pause on the headline metric cards. Patients reached, camps run, follow-ups closed.
5. **[CLICK]** *Generate AI Summary* if it is visible — the markdown summary fills in. (Optional; if it hesitates, skip.)

### 4:30 – 5:00 — Closing
1. Cut back to a still slide with the tagline.
2. Read the final line. Fade to black.

---

## 3. Lines you should commit to memory

These are the four sentences that, more than anything else, will make the demo feel premeditated and professional. Say them exactly as written — they are calibrated for rhythm.

1. *"Today, she does this with a notebook and a gut feeling. We thought she deserved better."*
2. *"Every piece of structured data the AI produces is anchored to the exact words in the original report. The coordinator can always see the receipt."*
3. *"The coordinator is not being replaced. She is being briefed by the best assistant she has ever had."*
4. *"SevaSetu AI does not replace the Priyas of this world. It gives them the tools the work has always deserved."*

---

## 4. If something on screen breaks — recovery scripts

| What you see | What to say (out loud, calmly) | What to do (off camera) |
|---|---|---|
| Toast says "AI quota reached" | *"In rural settings, the network and the AI both have moments. Notice how the platform never loses the report — it goes straight to the Workbench, and we can retry in one click."* | Click into Workbench → select the failed report → **Retry Extraction**. |
| Recommend cards do not load | *"Even when the model is slow, the deterministic ranker behind it gives the coordinator a starting point."* | Refresh the page once; if still stuck, skip ahead and stay on the camp plan. |
| Map looks empty on Command Center | *"The map renders against live volunteer presence — outside a real shift the layer is intentionally quiet."* | Stay on the locality list panel; do not zoom on the map. |
| Submit button does nothing | Pause, smile, click again. *"The platform double-confirms before sending — let me try once more."* | Check the network tab off-camera after the take. |
| A toast shows a 500 error | *"That is exactly why we have the human-in-the-loop Workbench — nothing the AI says is final."* | Move to Workbench tab and retry there. |

---

## 5. Quick numbers to drop into Q&A

If a judge asks "how big is this thing?" — these are factual, deployment-ready numbers from the live build.

- **28 routes** ship in the production build.
- **12 server API endpoints** — all wrapped with Firebase Auth verification, Zod input validation, and an AI audit log.
- **5 AI models in the fallback chain**: `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash`. Quota outages do not bring the platform down.
- **Sub-second matching path** — the deterministic ranker computes top-N volunteers without any LLM call. The LLM rerank is opportunistic.
- **Offline-first**: every write goes through an idempotent outbox keyed by `clientEventId`, so a flaky 2G network never produces duplicates.
- **Zero exotic infrastructure** — Firestore, Cloud Run, Firebase Auth. Costs scale to zero when idle.

---

## 6. The "if you have ten more seconds" moments

Sprinkle one or two of these in the transitions between scenes. They are the spice that separates a demo from a *story*.

- *"Notice the orange — it is warm, deliberately. Health work is a human business; the visual language should not look like a stock dashboard."*
- *"Every change Priya makes is signed and time-stamped. When the audit team arrives in six months, the answer to every question is one click away."*
- *"The platform does not care which language the report comes in. The same model handles Hindi, Telugu, Tamil — and increasingly, voice notes."*
- *"We did not invent the work. We translated it into software that listens."*

---

## 7. Last reminder before you press Record

The platform is solid. The story is solid. You only need to do one thing: **slow down**. Pause between sentences. Let the screen breathe. Let the toasts land. Let the judges feel one click finishing before the next one starts. If a take feels rushed, stop and start again — the only thing that costs us this hackathon is sounding nervous.

You've got this. Go win.
