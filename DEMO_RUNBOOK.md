# SevaSetu AI — Demo Runbook

> Single file. Everything in order. `[DO]` = what to click/show on screen. `[SAY]` = exact words to speak aloud. Paste blocks are copy-ready. Keep this on your phone or second monitor — never on the recorded screen.

---

## PRE-FLIGHT — Do this 5 minutes before pressing Record

- [ ] Open Chrome → `https://sevasetu-ai-152831472198.asia-south1.run.app`
- [ ] Sign in as your coordinator account. Confirm the badge reads **COORDINATOR** in the top-right.
- [ ] Open these 7 tabs left-to-right (they are your "scenes"):

  | Tab | URL |
  |-----|-----|
  | 1 | `/dashboard` |
  | 2 | `/command-center` |
  | 3 | `/reports` |
  | 4 | `/workbench` |
  | 5 | `/planner` |
  | 6 | `/operations` |
  | 7 | `/impact` |

- [ ] Hard-refresh every tab: **Ctrl + Shift + R**
- [ ] Close Slack, Outlook, Teams, all tray notifications
- [ ] Press **F11** to go full-screen
- [ ] Set browser zoom to **100%**
- [ ] Test mic — speak one sentence, play it back, adjust gain
- [ ] Do **one full silent click-through rehearsal** before recording

---

## PASTE-READY REPORTS

> Only ever submit **one** report on camera. Rate limit is 10 RPM on the free tier. B and C are stand-ins only.

### Report A — Koraput Anaemia ← **USE THIS ONE**

```
Anganwadi worker from Koraput block reports severe anemia in pregnant women. 30+ cases in last 2 months. No iron supplements available at local PHC. Need blood tests and supplements. Community very worried.
```

**What the AI will return (so you can speak to it confidently):**

| Field | Expected Value |
|-------|---------------|
| Locality | Koraput block — conf 0.9 |
| Need 1 | Anaemia screening, severity 4, ~30 affected, conf 0.9 |
| Need 2 | Blood tests, severity 3, ~30 affected, conf 0.9 |
| Need 3 | Iron supplements, severity 4, ~30 affected, conf 0.9 |
| Urgency signal 1 | `vulnerable_group` — "severe anemia in pregnant women" |
| Urgency signal 2 | `supply_stockout` — "no iron supplements available at local PHC" |

### Report B — Rampur Waterborne ← back-up if A fails

```
Visited Rampur village on 3rd April. Saw many children with skin rashes and diarrhea. Clean water not available. At least 50 families affected. Need dermatologist and pediatrician. Very urgent — last camp was 8 months ago.
```

### Report C — Dharavi TB ← only for variety

```
Follow up note from Dharavi health post: TB screening camp needed urgently. 12 suspected cases reported by local clinic. Previous camp screened 200 people, found 8 positive. Area has high population density.
```

---

## THE DEMO — Act by Act

---

### ACT 1 — The Pain `0:00 – 0:30`

**[DO]** Start on a dark splash / blurred dashboard. No clicking. Just speak.

**[SAY]**
> *"Every day, across rural India, a coordinator named Priya wakes up to a hundred unread WhatsApp messages. A village has run out of iron tablets. A child has been hospitalised in the next district. A volunteer is asking which camp to attend on Saturday. Priya has to read all of it, decide what is urgent, and send the right doctor to the right village — before lunch. Today, she does this with a notebook and a gut feeling. We thought she deserved better."*

**[DO]** Fade in / switch to the live dashboard (`/dashboard`).

---

### ACT 2 — The Input `0:30 – 1:15`

**[DO]** Tab 1 — `/dashboard`. Scroll down once gently so the metric cards animate up. Let them breathe for a beat.

**[SAY]**
> *"This is SevaSetu AI. The first thing Priya sees every morning is the Command Center — a live map of every locality her NGO covers, colour-coded by urgency. The deeper the red, the more help that area needs right now."*

**[DO]** Switch to Tab 2 — `/command-center`. Hover one of the deepest-red localities. Let the urgency tooltip and signal breakdown appear. Pause for a full beat.

**[SAY]**
> *"That redness is not arbitrary. It is calculated from the field reports flowing in from volunteers, ASHA workers, and citizens — exactly the messages Priya used to read by hand. Let me show you how a new report enters the system."*

**[DO]** Switch to Tab 3 — `/reports`. Click into the **Paste Field Report** card. Paste **Report A** (Koraput). Click **Submit To Backend Queue**.

**[SAY]**
> *"This report just came in from Koraput block in Odisha. It is in plain language — the way a tired field worker actually writes at the end of the day. Watch what happens when we hit submit."*

**[DO]** Watch for the toast: *"AI is reading the report..."* → *"Report stored and AI extraction completed."* The extraction preview panel on the right fills with structured data. Pause one beat — let the judges see the transformation.

---

### ACT 3 — The Brain `1:15 – 2:30`

**[DO]** Switch to Tab 4 — `/workbench`. Click the refresh icon (top-right of the Pending Review panel) once. The Koraput report appears at the top with a 90% confidence pill.

**[SAY]**
> *"In a few seconds, the AI has read the report end-to-end. It has identified the locality. It has separated the medical needs — anaemia screening, blood tests, iron supplements — and given each one a severity score and a confidence number. It has flagged two urgency signals: a vulnerable group, because the patients are pregnant women, and a supply stockout, because the local PHC has run out of iron tablets."*

**[DO]** Click the report to open the detail pane. Slowly move your mouse over the **yellow evidence highlights** one at a time.

**[SAY]**
> *"Notice the yellow highlight. Every piece of structured data the AI produces is anchored to the exact words in the original report. This is how we make AI trustworthy in a humanitarian setting — the coordinator can always see the receipt. No hallucinations, no black boxes."*

**[DO]** Hover the green **90% Conf** pill on one of the needs.

**[SAY]**
> *"Where the model is less than 80 percent confident, we flag it for human review. Anything above that threshold can be approved with one click."*

---

### ACT 4 — The Human in the Loop `2:30 – 3:30`

**[DO]** Still on Tab 4 — `/workbench`. Click the green **Approve** button. Watch the report disappear from the queue. Toast: *"Report approved"*.

**[SAY]**
> *"Priya reads the extraction, agrees with it, and approves. The moment she does, three things happen automatically: the locality's urgency score is recalculated, the report is added to the evidence trail for audits, and the camp planner is notified that Koraput now has a higher priority than it did this morning."*

**[DO]** Switch to Tab 5 — `/planner`. The locality list is on the left, sorted by urgency. Click **"Rampur Village"** (or whichever is most urgent — the story works with any locality).

**[SAY]**
> *"Now Priya wants to send a health camp to Rampur tomorrow. She tells the system she needs three doctors, two pharmacists, five field volunteers, and three support staff. Then she clicks one button."*

**[DO]** Click the **"Use tomorrow"** link above the date input. The date fills in. Leave staff counts at defaults. Click **Get AI Staff Recommendations**. Wait 1–3 seconds for the cards to animate in.

**[SAY]**
> *"In under two seconds, the AI has scanned every available volunteer, looked at their language skills, their preferred area, their travel radius, their experience level, and their current rating, and ranked the best matches. Each card explains why this volunteer was chosen — strong Hindi skills, preferred area match, twelve previous camps, low travel distance. The coordinator is not being replaced. She is being briefed by the best assistant she has ever had."*

**[DO]** Hover one volunteer card to show the explanation line. Then click the green **Create Camp Plan** button at the bottom. Toast: *"Camp plan created!"*

**[SAY]**
> *"The camp is on the calendar. The volunteers will get their notifications. The work that used to take Priya half a day is done in under a minute."*

---

### ACT 5 — The Impact `3:30 – 4:30`

**[DO]** Switch to Tab 6 — `/operations`. A list of active assignments is visible. Click one to expand it.

**[SAY]**
> *"On the day of the camp, our app does not stop helping. Field volunteers use Operations mode to log every patient they see and every medicine they hand out — even when the rural network drops to zero bars."*

**[DO]** Click **Dispense Medicine** on the expanded card. Pick "Iron supplements", set quantity to 5, submit. Toast: *"Dispense logged via transaction successfully"*.

**[SAY]**
> *"Everything is queued offline and synced the moment connectivity returns. No data lost, no double-counting, every transaction idempotent."*

**[DO]** Switch to Tab 7 — `/impact`. Pause on the headline metric cards — patients reached, camps run, follow-ups closed. If the **Generate AI Summary** button is visible, click it and let the markdown summary fill in.

**[SAY]**
> *"And at the end of the month, Priya does not have to write a report. The platform writes it for her — patients reached, lives touched, supply gaps closed. Donors see exactly where their money went. Auditors see the full chain of evidence. Priya sees, for the first time, the difference she actually made."*

---

### CLOSING `4:30 – 5:00`

**[DO]** Cut to a clean closing slide with the tagline and one headline number.

**[SAY]**
> *"SevaSetu AI does not replace the Priyas of this world. It gives them the tools the work has always deserved. Built on Next.js, deployed on Google Cloud, powered by Gemini — and shaped, end to end, by the people who actually run health camps in rural India. Thank you."*

**[DO]** Fade to black.

---

## THE 4 LINES — Commit these word-for-word

Say them exactly as written. They are calibrated for rhythm and will land every time.

1. *"Today, she does this with a notebook and a gut feeling. We thought she deserved better."*
2. *"Every piece of structured data the AI produces is anchored to the exact words in the original report. The coordinator can always see the receipt."*
3. *"The coordinator is not being replaced. She is being briefed by the best assistant she has ever had."*
4. *"SevaSetu AI does not replace the Priyas of this world. It gives them the tools the work has always deserved."*

---

## IF SOMETHING BREAKS — Recovery scripts

| What you see on screen | Say this calmly | Do this off-camera |
|------------------------|----------------|--------------------|
| Toast: "AI quota reached" | *"In rural settings, the network and the AI both have moments. Notice how the platform never loses the report — it goes straight to the Workbench, and we can retry in one click."* | Workbench → select the failed report → **Retry Extraction** |
| Recommend cards don't load | *"Even when the model is slow, the deterministic ranker behind it gives the coordinator a starting point."* | Refresh once; if still stuck, skip ahead to the camp plan |
| Map looks empty | *"The map renders against live volunteer presence — outside a real shift the layer is intentionally quiet."* | Stay on the locality list panel; do not zoom the map |
| Submit button does nothing | Pause, smile, click again. *"The platform double-confirms before sending — let me try once more."* | Check network tab after the take |
| Toast shows 500 error | *"That is exactly why we have the human-in-the-loop Workbench — nothing the AI says is final."* | Move to Workbench tab and retry there |

---

## Q&A CHEAT SHEET — Numbers judges may ask about

- **28 routes** in the production build
- **12 server API endpoints** — all with Firebase Auth verification, Zod validation, and AI audit log
- **Fallback chain**: `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` — quota outages do not bring the platform down
- **Sub-second matching** — deterministic ranker runs with zero LLM calls; LLM rerank is opportunistic
- **Offline-first**: every write goes through an idempotent outbox keyed by `clientEventId` — flaky 2G never produces duplicates
- **Zero exotic infra** — Firestore, Cloud Run, Firebase Auth — costs scale to zero when idle

### If asked about trust / hallucinations
> Every AI output is anchored to evidence spans. Coordinators approve, edit, or reject — nothing reaches the field without a human signature.

### If asked about cost
> We default to `gemini-2.5-flash` (generous free tier). Automatic fallback to flash-lite and 2.0-flash on quota or 5xx. The platform stays up during a model outage.

### If asked about fairness
> The volunteer ranker explicitly considers travel burden and recent assignment load. The same five-star volunteer is not exhausted while newcomers are overlooked.

### If asked about auditability
> The AI audit log captures model name, prompt version, validation pass/fail, and latency for every single call. Donors and regulators can replay any decision.

---

## BONUS LINES — Drop one or two in transitions if you have time

- *"Notice the orange — it is warm, deliberately. Health work is a human business; the visual language should not look like a stock dashboard."*
- *"Every change Priya makes is signed and time-stamped. When the audit team arrives in six months, the answer to every question is one click away."*
- *"The platform does not care which language the report comes in. The same model handles Hindi, Telugu, Tamil."*
- *"We did not invent the work. We translated it into software that listens."*

---

## ONE LAST THING

**Slow down.** You are going to feel like you should speak faster. Don't. A relaxed pace sounds confident; a rushed pace sounds nervous. Pause between sentences. Let the toasts land. Let each click finish before the next one starts.

The platform is solid. The story is solid. Go win.
