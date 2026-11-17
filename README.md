<div align="center">

# UniWell AI

### Your academic journey, your wellbeing, intelligently connected.

A non-clinical student wellbeing and academic workload companion that turns real deadlines, daily check-ins, available time, and student feedback into a practical, adaptive study plan.

[![TypeScript](https://img.shields.io/badge/TypeScript-51.9%25-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-45%25-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-not_specified-lightgrey)](#project-status)
[![Status](https://img.shields.io/badge/status-active_prototype-blue)](#project-status)

[Product requirements](docs/PRD.md) · [Design system](DESIGN.md) · [Data sources](DATA_SOURCES.md)

</div>

---

> **Important:** UniWell is a student planning and wellbeing companion, not a medical or mental-health diagnostic service. It does not diagnose, screen, score, or treat anyone, and it is not an emergency service. If you are in immediate danger, contact someone you trust or your local emergency services.

## At a glance

UniWell helps university students—initially students in Pakistan—make an overwhelming academic day feel more manageable. It combines a short daily check-in with actual tasks and deadlines, calculates a transparent view of workload, and creates a feasible AI-assisted micro-plan. Student feedback informs deterministic adjustments to future plans.

```text
Daily check-in + real tasks + available time
                    │
                    ▼
      Student Context & Workload Engines
                    │
                    ▼
       Academic Pressure Radar
                    │
                    ▼
   Validated live AI study micro-plan
                    │
                    ▼
       Student action and feedback
                    │
                    ▼
     Deterministic plan adaptation ──────► next plan
```

**Product principle:** The AI can personalize language and suggestions; the backend—not the model—owns feasibility, workload arithmetic, task eligibility, safety gates, and validation.

## The problem

Students often have assignments, quizzes, exams, and projects competing for the same limited hours. A conventional to-do list records tasks but does not account for how much time is actually available today, how soon work is due, or how the student is feeling. A one-off chatbot can suggest a schedule, but it usually lacks the student's real task state and does not reliably learn from what worked.

This leaves students to estimate workload, decide what can realistically fit, and repeatedly rebuild plans when their energy or circumstances change. Generic productivity tools can also treat an overloaded day as a prioritization problem without making the time trade-off clear.

## What UniWell solves

UniWell connects the student's planning inputs into one explainable feedback loop:

- **Makes workload visible:** compares estimated task minutes due soon with the student's available time and explains the calculation.
- **Turns context into action:** uses a brief check-in, task deadlines, and preferences to propose a small, time-bounded plan.
- **Keeps plans realistic:** deterministic backend checks prevent plans from exceeding the available time, using unknown tasks, or ignoring product constraints.
- **Adapts with student consent:** feedback can shorten study blocks, reduce the number of tasks, add buffer, or preserve what is working. Adjustments are explained; proposed MindBalance changes require confirmation.
- **Keeps agency with the student:** plans are suggestions. Student-set priorities and deadlines are not silently changed.
- **Uses non-clinical language:** wellbeing information is descriptive and self-reported, not a diagnosis or mental-health score.

The product hypothesis is that a quick check-in plus structured workload, a feasible plan, and a feedback loop can help students prioritize. This is a hypothesis to validate—not a proven clinical or academic outcome.

## Product capabilities

| Capability | What it does |
|---|---|
| Anonymous onboarding | Creates a random browser-held user ID; no email, phone number, or CNIC is required. Students choose a language and preferred study-block duration and see the non-clinical notice. |
| Daily check-in | Captures mood, sleep, perceived workload, energy, and available minutes. Check-ins are editable for the day. |
| Task management | Create, edit, complete, delete, filter, and sort academic tasks by status, due date, and priority. The student's priority is not rewritten. |
| Academic Pressure Radar | Estimates work due within 48 hours against available minutes. `< 0.75` is manageable, `0.75–1.00` is tight, and `> 1.00` is over capacity. This is an academic time estimate, not a wellbeing score. |
| Adaptive AI micro-plans | Requests a live plan from Gemini or Groq, validates the response, and presents study blocks, breaks, a wellbeing pause, rationale, and deferred work where applicable. |
| Feedback and adaptation | Uses reported manageability, helpfulness, completion, and reasons to apply deterministic planning adjustments for a later plan. |
| Insights and history | Shows descriptive self-reported trends and plan history with sample sizes; it avoids diagnostic or causal claims. |
| MindBalance | Offers deterministic check-ins, recovery activities, journaling, descriptive insights, and proposed plan adjustments. Journal entries and check-in notes are encrypted at rest using Fernet. |
| Resource library | Provides resource metadata and original summaries, including WHO and NHS references, with licensing notes. Some resources are marked as not yet reviewed. |
| Safety and deletion | A detected immediate-danger statement pauses planning and presents a supportive pathway. Users can delete their stored data. Keyword detection is limited and is not a risk assessment. |
| Synthetic demo mode | Loads clearly labelled synthetic overloaded or manageable scenarios for demonstration; synthetic records are not presented as real outcomes. |
| English and Roman Urdu | Provides language selection and localized product content; some untranslated interface strings may fall back to English. |

## Product and system architecture

### End-to-end request flow

1. **Browser app:** The React single-page application stores an anonymous ID in browser storage and sends it as `X-User-Id` for user-scoped API requests.
2. **API boundary:** FastAPI validates requests with Pydantic schemas. Routes enforce record ownership and delegate work to service modules.
3. **Deterministic context and workload:** Backend services assemble a minimal planning context, rank eligible tasks, calculate the available-time budget, and apply adaptation rules.
4. **Safety gate and AI provider:** The plan service performs safety checks before calling the configured provider. Gemini is the default; Groq is optional behind the same provider abstraction. Credentials stay on the server.
5. **Validation and persistence:** AI output is parsed and validated against the response contract and feasibility constraints. The backend may safely repair output and make one corrective retry; failures are returned honestly rather than replaced with a fabricated plan.
6. **Student feedback:** Feedback is stored and converted into deterministic adaptation events that can inform the next plan. The student remains in control of proposed adjustments.

### Architecture diagram

```text
┌───────────────────────────────────────────────────────────┐
│ Browser                                                   │
│ React 19 · TypeScript · Vite · Tailwind CSS · Recharts    │
│ Anonymous session · hash router · i18n · typed API client│
└─────────────────────────────┬─────────────────────────────┘
                              │ /api/*, X-User-Id
                              ▼
┌───────────────────────────────────────────────────────────┐
│ FastAPI application                                       │
│ Routes · Pydantic contracts · ownership checks            │
│                                                           │
│ Workload engine ─ Context builder ─ Adaptation engine      │
│      │                 │                 │                │
│      └──────────── Plan service ─────────┘                │
│                         │                                 │
│            Safety → provider → validate → persist         │
│                         │                                 │
│        GeminiProvider / GroqProvider (optional)           │
└─────────────────────────┬─────────────────────────────────┘
                          │ SQLAlchemy
                          ▼
┌───────────────────────────────────────────────────────────┐
│ SQLite                                                    │
│ Profiles · check-ins · tasks · plans · feedback           │
│ adaptations · resources · events · MindBalance records     │
└───────────────────────────────────────────────────────────┘
```

### Backend decision boundaries

| Deterministic backend responsibilities | AI responsibilities |
|---|---|
| User/record ownership; deadlines; workload and time-budget calculations; task ranking and valid task IDs; maximum plan constraints; safety routing; output validation; adaptation rules. | Natural-language personalization; study instructions; supportive wording; selected activity suggestions; concise explanations and language style. |

Student-entered task text and optional notes are untrusted input. The system prompt is fixed server-side, and user text is passed as delimited data rather than instructions. Optional planning notes are length-limited, used for that request, and are not stored. The context builder minimizes information sent to the model; it does not include user IDs or nicknames.

### Main code areas

```text
backend/
├── app/
│   ├── api/routes/       # Health, profile, check-ins, tasks, radar, plans, feedback, insights, resources, demo
│   ├── services/         # Workload, context, planning, AI, safety, adaptation, data and events
│   ├── schemas/          # Pydantic API and AI response contracts
│   ├── db/               # SQLAlchemy models and database session
│   └── data/             # Resource catalogue
└── tests/                # Backend tests; provider is mocked in tests
frontend/
└── src/
    ├── features/         # Onboarding, check-in, tasks, radar, plans, insights, MindBalance, settings
    ├── components/       # Shared layout, UI primitives and error boundary
    └── lib/              # API client, i18n, routing, session and formatting
scripts/                  # Demo-data utilities
 docs/                    # Product requirements
```

## Technology stack

| Area | Technology |
|---|---|
| Web application | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Visualization and icons | Recharts, lucide-react |
| API | Python 3.12+, FastAPI, Pydantic v2 |
| Persistence | SQLAlchemy 2, SQLite |
| AI providers | Gemini REST API (default) or Groq OpenAI-compatible API, through an `AIProvider` abstraction and `httpx` |
| Testing and quality | Pytest, TypeScript build, oxlint |

## Get started

### Prerequisites

- Python 3.12 or newer
- Node.js 20.19 or newer
- npm
- An API key from [Google AI Studio](https://aistudio.google.com/apikey) for live Gemini plans, or a [Groq API key](https://console.groq.com/keys) if using Groq

The rest of the application can be explored without an AI key; live plan generation requires a configured provider.

### 1. Clone and configure

```bash
git clone https://github.com/MuhammadFahad-offcl/The-Prompt-Engineer-Uniwell-AI.git
cd The-Prompt-Engineer-Uniwell-AI
cp .env.example .env
```

On Windows Command Prompt, use `copy .env.example .env` instead of `cp`.

Set the provider key in the root `.env` file. For Gemini:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
```

Or configure Groq:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
```

Never commit `.env` or expose provider credentials in frontend code.

### 2. Start the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1

# Windows Command Prompt
.venv\Scripts\activate.bat
```

Install dependencies and run the API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Health check: <http://127.0.0.1:8000/api/health>
- Interactive API docs: <http://127.0.0.1:8000/docs>

### 3. Start the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite development server proxies `/api` requests to the backend.

### 4. Run checks

Backend tests (from `backend/`, with its virtual environment active):

```bash
python -m pytest -q
```

Frontend type-check/build and lint (from `frontend/`):

```bash
npm run build
npm run lint
```

Backend tests use a mock AI provider; the running application does not silently substitute a fake plan. Without a configured provider key, plan generation reports that the provider is not configured.

## Configuration

Copy `.env.example` to `.env` in the repository root and adjust as needed:

| Variable | Required | Description |
|---|---:|---|
| `AI_PROVIDER` | No | `gemini` (default) or `groq`. |
| `GEMINI_API_KEY` | For live Gemini plans | Gemini API credential. Keep it server-side. |
| `GEMINI_MODEL` | No | Model override; defaults to `gemini-2.5-flash`. |
| `GROQ_API_KEY` | For live Groq plans | Groq API credential when `AI_PROVIDER=groq`. |
| `GROQ_MODEL` | No | Model override; defaults to `openai/gpt-oss-120b`. |
| `DATABASE_URL` | No | SQLite URL; default is `sqlite:///./uniwell.db` when running Uvicorn from `backend/`. |
| `FRONTEND_ORIGIN` | No | CORS allowlist origin; defaults to `http://localhost:5173`. |
| `APP_ENV` | No | `development` enables the demo seed endpoint; use `production` to disable it. |
| `MINDBALANCE_KEY` | No | Fernet key for MindBalance journal encryption. If unset, a local ignored key file is generated. Preserve the key to decrypt existing journal entries. |

## API overview

User-scoped routes require `X-User-Id: <anonymous-id>`. The backend checks that records belong to that ID. The API returns errors using a consistent `{"error": {"code", "message"}}` shape.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health and provider configuration status |
| `POST` | `/api/profile` | Create or update an anonymous profile |
| `GET` | `/api/profile/{user_id}` | Retrieve profile and effective session preference |
| `POST` | `/api/profile/{user_id}/reset-adaptation` | Reset automatic planning adjustments |
| `DELETE` | `/api/user/{user_id}/data` | Delete the user's stored data |
| `POST` | `/api/checkins` | Save or update today's check-in |
| `GET` | `/api/checkins/{user_id}` | Retrieve check-in history |
| `POST`, `GET`, `PATCH`, `DELETE` | `/api/tasks` and `/api/tasks/{task_id}` | Create and manage tasks |
| `GET` | `/api/radar/{user_id}` | Workload estimate and ranked tasks |
| `POST` | `/api/plans/generate` | Generate a live plan or return a safety pause |
| `GET` | `/api/plans/{user_id}` | Plan history and adaptation log |
| `GET` | `/api/plans/detail/{plan_id}` | Retrieve a plan with items and feedback |
| `PATCH` | `/api/plan-items/{item_id}` | Mark a plan item complete or incomplete |
| `POST` | `/api/feedback` | Submit plan feedback and produce adaptation events |
| `GET` | `/api/insights/{user_id}` | Descriptive, self-reported insights |
| `GET` | `/api/resources` | Read the resource catalogue |
| `POST` | `/api/demo/seed` | Seed synthetic demo data (development only) |

MindBalance routes cover wellbeing summaries, check-ins, recovery sessions, journal entries, insights, micro-steps, and proposed/decided plan adjustments. See the route modules in `backend/app/api/routes/` and the interactive API docs for request and response schemas.

## Privacy, safety, and responsible use

- **Non-clinical by design:** no diagnosis, screening, treatment, or mental-health score. Insights are descriptive, self-reported, and shown with sample sizes where applicable.
- **Data minimization:** onboarding is anonymous; AI context excludes IDs and nicknames; optional planning notes are not persisted; product events are coarse and do not contain check-in values or free text.
- **Secrets:** provider API keys remain on the backend. Do not commit local environment files or encryption keys.
- **Ownership checks:** user-scoped records are checked against the anonymous ID supplied by the browser.
- **AI guardrails:** the backend fixes the system prompt, treats user text as untrusted data, checks safety before generation, validates model output and enforces plan constraints.
- **Sensitive notes:** MindBalance journal entries and check-in notes are encrypted at rest with Fernet. The encryption key must be securely retained; losing or changing it can make existing entries unreadable.
- **Deletion:** the application provides a user-data deletion endpoint and a UI path to clear browser data.
- **Immediate-danger messaging:** detection pauses plan generation and directs the student toward trusted people or local emergency services. This keyword-based gate can miss or misclassify language; it is not a risk assessment.
- **Synthetic data:** demo profiles and plans are artificial and labelled as such; they are not user outcomes.

## Demo walkthrough

1. Open onboarding or **Settings → Demo data** and load the overloaded-day scenario.
2. Review the Pressure Radar and its explicit comparison of workload minutes with available time.
3. Generate a plan with a configured live provider and inspect its rationale, time budget, wellbeing pause, and deferred tasks.
4. Mark an item complete and submit feedback about manageability and helpfulness.
5. Generate another plan to see deterministic adaptation reflected in the next result.
6. Review descriptive insights and, if desired, exercise the data-deletion flow.

Demo seeding is enabled only in development (`APP_ENV=development`). The CLI helper is available at `scripts/seed_demo.py`.

## Project status and limitations

This repository is an active prototype built for an AI hackathon and startup pitch, aligned with **UN Sustainable Development Goal 3: Good Health & Well-being**. The project includes a working application, API, tests, and synthetic demo flow. It is **not yet a production-ready service for real student data**.

Before a real deployment, the following gaps need to be addressed and reviewed:

- The anonymous `X-User-Id` is a prototype ownership guard, not authentication. A deployment needs a reviewed identity and authorization model.
- SQLite is used for local persistence; production operations would require an appropriate database strategy, migrations, backup and recovery procedures.
- Define and implement production data-retention, consent, incident-response, access-control, and security-review processes.
- The in-memory rate limiter resets on server restart and is not a distributed production limiter.
- Safety detection is simple keyword matching and is not comprehensive.
- Resource records may be marked `reviewed: false`; verify current content, licensing, and local support information before launch.
- Roman Urdu coverage is partial, and full Urdu RTL support is not included.
- Live provider behavior depends on external provider availability, credentials, quotas, and model output.

Pilot metrics in the product requirements are **future hypotheses**, not measured results. Task completion is not a proxy for clinical wellbeing, and UniWell makes no claim to improve mental health.

## Contributing

Contributions and feedback are welcome. For changes:

1. Keep feasibility, privacy, student agency, and non-clinical language as product requirements.
2. Add or update tests for backend behavior and API contracts.
3. Run backend tests and frontend build/lint checks before opening a pull request.
4. Never include API keys, real student data, or identifying information in commits, fixtures, logs, or screenshots.

For larger product decisions, consult [`docs/PRD.md`](docs/PRD.md) and [`DESIGN.md`](DESIGN.md).

## Project documents

- [Product requirements](docs/PRD.md)
- [Design system](DESIGN.md)
- [Data sources and provenance](DATA_SOURCES.md)

## License

No license is currently specified in this repository. Unless and until one is added, all rights remain with the copyright holder; do not assume the project is available for reuse under an open-source license.
