# UniWell AI

**Your academic journey, your wellbeing, intelligently connected.**

UniWell AI is a non-clinical student wellbeing and academic workload companion. A university student does a one-minute check-in and enters their real deadlines. UniWell then gives them a short, feasible plan generated live by AI, and that plan **adapts to their feedback** next time.

> UniWell is a student wellbeing and planning companion, **not** a medical or mental-health diagnostic service. It never diagnoses, screens, scores or treats anyone. If you are in immediate danger, contact a trusted person, local emergency services or the nearest emergency department.

Built for the AI Hackathon & Startup Pitch: **SDG 03, Good Health & Well-being**, niche *AI for Accessible Healthcare & Well-Being*. Product spec: [`docs/PRD.md`](docs/PRD.md). Data provenance: [`DATA_SOURCES.md`](DATA_SOURCES.md).

---

## The problem

University students, starting with students in Pakistan, often juggle assignments, quizzes, exams and projects at the same time. To-do lists and one-off chatbot answers don't account for **today's** energy, **actual** available time, real deadlines, or whether yesterday's plan was manageable. So students keep getting plans they can't finish.

**UniWell connects the pieces:**

```
Daily check-in → Student Context Engine → Academic Pressure Radar
      → Live AI micro-plan → Student action → Feedback → Adapted next plan
```

General AI can generate a study plan. UniWell links a student's real workload, daily check-ins, available time and feedback into one planning loop that adapts over time.

## Features (all P0 items shipped)

| | Feature | What it does |
|---|---|---|
| 1 | **Anonymous onboarding** | No email, phone or CNIC. A random ID stays in the browser. Choose English or Roman Urdu and a preferred study block (15–45 min). Privacy and non-clinical notice with consent. |
| 2 | **60-second check-in** | Three questions (mood 1–5, sleep poor/okay/good, perceived workload 1–5) in Roman Urdu with English hints, plus energy and available minutes. One check-in per day; edits update it rather than duplicate it. |
| 3 | **Task manager** | Add, edit, complete and delete tasks. Filter by active, today, upcoming, overdue or completed; sort by deadline or priority. The student's own priority is never rewritten. |
| 4 | **Academic Pressure Radar** | `ratio = minutes due within 48 h ÷ available minutes`. Below 0.75 is *manageable*, 0.75–1.00 *tight*, above 1.00 *over capacity*. Shows every number and the rule, with icons and text labels (never colour alone). Explicitly **not** a stress score. |
| 5 | **Live adaptive AI plan** | Gemini (or Groq) generates study blocks, breaks, one wellbeing pause, a study tip, an affirmation, "why this plan", deferred tasks and a fallback. The **backend** enforces the time budget, valid task IDs, session length and non-clinical wording. |
| 6 | **Feedback → adaptation** | "Did you follow it? How manageable? How helpful? Why?" Deterministic rules shorten sessions, cut task count, add buffer or keep what worked. Every change is logged and explained in the next plan. |
| 7 | **Insights and history** | 7-day self-reported trends, with sample sizes and descriptive wording only. Plan history and an adaptation log. |
| 8 | **Resource library** | WHO and NHS links (metadata plus our own summaries, with licence notes) and six original micro-activities. |
| 9 | **Safety and privacy** | A note that says the student is in immediate danger pauses planning and shows a compassionate message, with no invented hotline numbers. One-click full data deletion. Coarse analytics only. |
| 10 | **Synthetic demo mode** | Load an overloaded or a manageable synthetic student, labelled everywhere as "Demo data — synthetic example". |

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, Recharts, lucide icons |
| Backend | Python 3.12+ (tested on 3.14), FastAPI, Pydantic v2, SQLAlchemy 2, SQLite |
| AI | Gemini REST API (default) or Groq's OpenAI-compatible API, behind an `AIProvider` abstraction. Called with `httpx`, no SDK. |
| Tests | Pytest (68 tests), TypeScript build, oxlint |

## Architecture

```
React SPA (hash router, i18n dictionary, typed API client)
   │  /api/*  (Vite dev proxy → FastAPI; X-User-Id = anonymous ID)
   ▼
FastAPI routes ── ownership guard on every record
   ├─ workload_engine.py     deterministic radar + task ranking
   ├─ adaptation_engine.py   plan constraints + feedback rules
   ├─ context_builder.py     minimal JSON context (no IDs/nickname), untrusted text kept as data
   ├─ plan_service.py        safety gate → AI call → JSON + Pydantic → feasibility checks
   │                         → safe repair → 1 corrective retry → persist (or honest error)
   ├─ ai_service.py          GeminiProvider / GroqProvider (keys server-side only)
   ├─ safety_service.py      sanitization, danger routing, clinical-claim filter
   └─ resource_service.py, demo_service.py, data_service.py, events_service.py
   ▼
SQLite: users, checkins, tasks, plans, plan_items, feedback, adaptation_events, resources, events
```

**Who decides what.** The backend owns deadlines, ownership, workload totals, priority order, the time budget, valid task IDs, adaptation rules and safety. The AI owns wording, concrete first steps, the choice of wellbeing activity, language and tone. If the model breaks a rule, the server trims or clamps safely, or asks for one correction. If it still fails, the student sees an error. **The app never substitutes a template plan or labels one as AI.**

```
backend/app/
  api/routes/   health, profile, checkins, tasks, radar, plans, feedback, insights, resources, demo
  services/     (see above)
  schemas/      Pydantic request/response + AI output contract
  db/           SQLAlchemy models + session
  data/resources.json
backend/tests/  68 pytest tests (mock AI provider in tests only)
frontend/src/
  features/     onboarding, checkin, tasks, pressure-radar, plans, feedback, insights, resources, settings, dashboard
  components/   Layout, UI primitives, ErrorBoundary
  lib/          api.ts, i18n.ts, router.ts, session.ts, format.ts
scripts/seed_demo.py
```

## Setup

**Prerequisites:** Python 3.12+ and Node 20.19+ (built and tested with Python 3.14 and Node 26).

### 1. Environment

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

Then edit `.env` at the repo root:

| Variable | Required | Notes |
|---|---|---|
| `AI_PROVIDER` | no | `gemini` (default) or `groq` |
| `GEMINI_API_KEY` | **yes, for live plans** | Free key from https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash`. Set any model your key can use. |
| `GROQ_API_KEY` / `GROQ_MODEL` | only if `AI_PROVIDER=groq` | Key from https://console.groq.com/keys. Default model is `llama-3.3-70b-versatile`. |
| `DATABASE_URL` | no | Defaults to `backend/uniwell.db` |
| `FRONTEND_ORIGIN` | no | CORS allowlist, default `http://localhost:5173` |
| `APP_ENV` | no | `development` enables `/api/demo/seed`; `production` disables it |

Without an API key, everything except plan generation works, and the plan screen says **"AI provider not configured"**. It never shows a fake plan. `.env` is git-ignored; never commit it.

### 2. Backend (terminal 1)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check it: http://127.0.0.1:8000/api/health should show `"ai": {"configured": true, ...}` once your key is set. Interactive API docs are at http://127.0.0.1:8000/docs.

### 3. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173 (proxies /api to :8000)
```

### 4. Tests and checks

```bash
cd backend && .venv\Scripts\python -m pytest -q      # 68 tests
cd frontend && npm run build && npm run lint
```

Automated tests use a **mock AI provider only** (`backend/tests/helpers.py`). The app itself has no mock path; the demo must call the real provider.

### Synthetic demo data

- **In the app:** on the onboarding screen or under *Settings → Demo data*, choose **Load demo: overloaded day** or **manageable day**. This replaces data for *your* anonymous ID only.
- **CLI:** `backend/.venv/Scripts/python scripts/seed_demo.py --user-id <ID from Settings> --scenario overloaded`.

Seeding is repeatable. The seeded "yesterday" plan is labelled *"Synthetic demo record — written by the seed script, not AI output"*, and its feedback is processed by the real adaptation engine.

## Two-minute demo

1. **Settings → Load demo: overloaded day.** This gives 3 tasks due soon (DBMS 90 min today, DSA 30 min later today, AI quiz 60 min tomorrow), 120 minutes available, mood 3, sleep okay, workload 5 and energy 2.
2. **Dashboard → Pressure Radar.** It shows **180 min of work vs 120 min available, ratio 1.50, over capacity**, with the rule spelled out.
3. **Plan → Generate my adaptive plan.** This is a live provider call; the badge reads *Generated live by gemini · model*. Point out:
   - "Adapted from your feedback": yesterday's synthetic feedback already shortened blocks from 30 to 25 minutes and focused the plan on 1 task.
   - The time budget, the deferred tasks, the wellbeing pause, "why this plan" and the fallback.
4. Tick one item done. Give feedback: **Partially · manageable 2 · helpful 3 · "Sessions too long"**. The summary shows *25 → 20 min blocks, buffer 10 → 15*.
5. **Generate my next plan.** The new plan uses **20-minute blocks** and explains why.
6. **Insights.** Self-reported 7-day trends with sample sizes, described as "you reported…", never as a diagnosis.
7. Optional: **Settings → Delete my data** (type DELETE). Everything is removed and the app returns to the welcome screen.

## API reference

All user routes require the header `X-User-Id: <anonymous id>`. Every record is checked against it; another user's record returns 403/404.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Status, DB, AI provider configured/model |
| POST | `/api/profile` | Create/update anonymous profile (consent required) |
| GET | `/api/profile/{user_id}` | Profile incl. effective (adapted) session length |
| POST | `/api/profile/{user_id}/reset-adaptation` | Undo automatic adjustments |
| DELETE | `/api/user/{user_id}/data` | Delete all of this user's records |
| POST | `/api/checkins` | Save today's check-in (upsert per local day) |
| GET | `/api/checkins/{user_id}` | History + today's check-in |
| POST / GET / PATCH / DELETE | `/api/tasks`, `/api/tasks/{user_id}`, `/api/tasks/{task_id}` | Task CRUD |
| GET | `/api/radar/{user_id}` | Academic Pressure Radar + ranked tasks |
| POST | `/api/plans/generate` | Live AI plan (or safety pause) |
| GET | `/api/plans/{user_id}` | Plan history + adaptation log |
| GET | `/api/plans/detail/{plan_id}` | One plan with items and feedback |
| PATCH | `/api/plan-items/{item_id}` | Mark item complete/incomplete |
| POST | `/api/feedback` | Feedback → adaptation events |
| GET | `/api/insights/{user_id}` | 7-day descriptive insights |
| GET | `/api/resources` | Resource catalogue (public) |
| POST | `/api/demo/seed` | Synthetic demo data (development only) |

Every error has the shape `{"error": {"code", "message"}}`. AI codes are `ai_not_configured` (503), `ai_timeout` (504), `ai_rate_limited` (429), `ai_auth_failed`, `ai_model_not_found`, `ai_invalid_output` (502) and `checkin_required` (409).

## AI design

- **Context engine:** sends only today's check-in, constraints, up to 8 ranked candidate tasks, 7 days of check-in summaries, the last 3 feedback entries and recent adaptation notes. It sends **no** user ID, nickname or timezone name.
- **Prompt-injection resistance:** the system prompt is fixed on the server. Task titles, subjects and the optional note are sanitized and placed in a delimited JSON *data* block that the model is told never to obey. The output is validated against a strict schema.
- **Hard checks:**
  - only known task IDs, and no completed tasks
  - total ≤ budget ≤ available minutes
  - each study block ≤ the session limit
  - task count within the limit
  - exactly one wellbeing item
  - no diagnostic or clinical wording, and nothing about skipping sleep or meals or all-nighters
- **Optional note:** "Anything we should know about today?" is length-limited, sent only with that request and **never stored**.

## Safety and privacy

- Non-clinical copy throughout. No mental-health score exists anywhere in the product.
- Explicit statements of immediate danger, in the note or in a task title, stop plan generation and show a supportive message pointing to a trusted person, local emergency services or the nearest emergency department. **No hotline numbers are shown, because none has been verified for this build.**
- Data minimization: anonymous ID, no free text stored, coarse analytics events only (event names, never mood values or text).
- API keys stay on the server and never reach the browser. CORS is restricted to an allowlist. Request bodies are capped at 64 KB. Plan generation is rate-limited per user. Logs never include prompts.
- Full deletion: `DELETE /api/user/{id}/data` and clearing browser storage, covered by a test that checks every table.

## Known limitations

- **Not production auth.** The anonymous ID header is a hackathon ownership guard, not authentication. A real deployment needs authentication, encryption at rest, a retention policy, a security review and a legal/privacy review.
- **SQLite and no migrations.** If the schema changes between versions, delete `backend/uniwell.db`; it contains only local and demo data.
- **Roman Urdu UI is partial.** AI output fully follows the chosen language. Untranslated UI strings fall back to English.
- **Danger detection is simple keyword matching.** It is a conservative routing gate, not a risk assessment, and it can miss phrasing or flag benign text.
- **Resources:** licensing is metadata only, and `reviewed: false` until a human checks it.
- **Rate limiting:** the in-memory limiter resets when the server restarts.
- **Live AI was not exercised during the build.** No provider key was available in the build environment, so the honest "not configured" state was verified against the running server. Plan rendering was checked with a throwaway local mock server. Run one real generation with your key before the demo.

## Startup and impact hypothesis

**B2B2C.** Universities and student-affairs teams sponsor access for students. Later options include an institution-specific directory of verified support resources and premium planning features. Individual check-ins stay private. Any institutional analytics would be opt-in, aggregated, subject to minimum cohort sizes and governed separately.

**Pilot hypotheses (future, not proven):**

- ≥70% of onboarded students complete a check-in
- ≥60% of check-ins lead to a plan
- ≥50% of plans get feedback
- average helpfulness ≥4/5

Task completion is not a proxy for clinical wellbeing, and UniWell makes no claim to improve mental health. Other student-wellbeing products exist; UniWell's angle is the locally relevant, feedback-driven connection between workload, daily context and adaptive planning.

## Hackathon compliance

- Built from scratch in this repository after kickoff, with one commit per milestone.
- No secrets committed (`.env` is ignored; `.env.example` is provided).
- Synthetic data only, clearly labelled.
- Live AI, with no faked responses.
