# UniWell AI — Product Requirements (condensed)

**Version:** 1.0 · **Date:** 17 November 2026
**Product:** UniWell AI — *Your academic journey, your wellbeing, intelligently connected.*
**Challenge:** SDG 03 Good Health & Well-being — niche: AI for Accessible Healthcare & Well-Being.

This is a condensed copy of the full PRD (v1.0) the team wrote at kickoff. It keeps every requirement the build depends on.

---

## 1. Summary

UniWell AI is a **non-clinical** student wellbeing and academic workload companion. It links a quick daily check-in with the student's deadlines, their available study time, a live AI micro-plan, and feedback about what worked. Each new plan draws on earlier check-ins, completed work, the student's preferred session length and their plan feedback.

```
Daily check-in → Student Context Engine → Academic Pressure Radar
  → Live AI micro-plan → Student action → Feedback → Adapted next plan
```

**Value proposition:** turn an overwhelming academic day into a realistic, personalized plan that adapts to the student's time, energy, workload and feedback.

**Not:** a diagnostic tool, a counsellor replacement, or a mental-health risk scorer.

## 2. Problem and hypothesis

Students juggle assignments, quizzes, exams and projects alongside personal obligations. Generic to-do lists and one-off chatbot answers ignore today's energy, real available time, actual deadlines and whether yesterday's plan was manageable, so students keep receiving plans they can't finish.

**Hypothesis (to validate, not a claim):** quick check-in + structured tasks + feasible plan + feedback → students prioritize better and the day feels more manageable.

**Users:** university students, initially in Pakistan. Future buyers: university student-affairs and wellbeing teams (aggregate-only, opt-in).

**Personas:** the overloaded student (3–5 tasks due soon), the low-energy student (wants a smaller plan), the inconsistent planner (wants plans that learn from feedback), and a future student-support team.

## 3. Principles

Non-clinical · student agency (plans are suggestions) · feasibility enforced by the backend, not the LLM · explainable · non-judgmental (missed tasks are planning signal, not failure) · privacy minimization · **real live AI, never faked** · honest failure states · local context (English + Roman Urdu).

## 4. Scope

**P0 (must ship):** anonymous onboarding · 3-question check-in (mood, sleep, perceived workload) plus energy and available time · task manager · Academic Pressure Radar · live AI plan with validated structured output · plan with study blocks, breaks, wellbeing activity and supportive line · item completion + feedback · feedback-driven adaptation · persistent history · weekly charts · delete-data + privacy/safety notice · synthetic demo data · README and `.env.example`.

**P1 (if P0 is stable):** resource library · weekly insight cards with evidence thresholds · English/Roman Urdu switch · printable plan · in-app reminders · calendar view.

**P2 (future):** full Urdu RTL UI · verified university support directory · sponsored deployment with aggregate-only reporting · LMS/calendar integrations · real auth and multi-device sync · native mobile app.

**Scope rule:** never trade live AI, the feedback loop, reliability or safety for a P1/P2 feature.

## 5. Functional requirements

| ID | Requirement | Key acceptance criteria |
|---|---|---|
| FR-01 | Anonymous onboarding: optional nickname, language (`en`/`roman_urdu`), preferred session (15–45 min), consent to the non-clinical notice. Random `user_id` kept in localStorage. | No sign-up; refresh keeps the profile; reset removes the data. |
| FR-02 | Daily check-in: mood 1–5, sleep `poor/okay/good`, workload 1–5 (mandatory); energy 1–5 and available minutes (planning inputs). One per local day; edits update rather than duplicate. | Out-of-range values rejected; persists after refresh. |
| FR-03 | Task CRUD: title, subject, type, deadline, estimated minutes (5–720), priority, status. Filters: today, upcoming, overdue, completed. The student's own priority is never rewritten. | CRUD persists; completed tasks excluded from workload; deleting a task keeps its title snapshot in old plans. |
| FR-04 | Academic Pressure Radar: `workload_ratio = due_soon_minutes / max(available, 1)`; `<0.75` manageable, `0.75–1.00` tight, `>1.00` over capacity. Labelled an academic time estimate, **not** a stress score. | Totals match the tasks; the ratio changes when tasks or time change. |
| FR-05 | Student Context Engine: minimal JSON (preferences, today's check-in, pending tasks, last 7 days, recent feedback, adaptation events). | Only the current user's data; no secrets or identifiers. |
| FR-06 | Live AI micro-plan: supportive message, workload status, 1–3 priority study actions with reasons, break(s), one wellbeing activity, a study tip, an affirmation, "why this plan", deferred tasks, a fallback, total minutes. | Never exceeds available time; only real task IDs; no completed tasks; one corrective retry, then an honest error. |
| FR-07 | Feedback (followed yes/partially/no, manageable 1–5, helpful 1–5, per-item completion, reason code) → deterministic adaptation rules → `adaptation_events`. | The next plan's context contains the adaptation; ≥2 tests show different feedback giving different constraints; the reason is visible. |
| FR-08 | History and weekly insights: 7-day mood, sleep, workload and energy trends; tasks done vs pending; ratings once enough exist. Descriptive language with sample size; no causal claims. | Empty state when data is insufficient. |
| FR-09 | Wellbeing micro-activities + resource library (WHO / NHS links, metadata and our own short summaries only, rights notes, `reviewed: false`). | No copied guide content, logos or implied endorsement. |
| FR-10 | Safety: prominent non-clinical disclaimer. Explicit statements of immediate danger stop plan generation and show a compassionate message (trusted person, local emergency services, nearest emergency department). **No invented hotline numbers.** | |
| FR-11 | Privacy: anonymous ID, data minimization, full delete, no sensitive logging, CORS allowlist, keys only on the backend. | |
| FR-12 | Synthetic demo mode: labelled "Demo data — synthetic example"; 5–7 days of history; overloaded and manageable scenarios. | Never presented as real outcomes. |
| FR-13 | Localization and accessibility: central dictionary; AI output in the chosen language; keyboard access, contrast, text alongside colour. | |
| FR-14 | Coarse product events only (no check-in values or free text). | |

## 6. Architecture

React + Vite + TypeScript + Tailwind + Recharts → FastAPI (Pydantic, SQLAlchemy, SQLite) → Gemini (primary) or Groq (optional) behind an `AIProvider` abstraction.

**Deterministic backend owns:** deadlines, ownership, workload totals, priority order, the time budget, valid task IDs, adaptation rules, safety gating and output validation.
**AI owns:** natural-language personalization, study instructions, choice of wellbeing activity, language, tone and concise rationale.

Entities: `users`, `checkins`, `tasks`, `plans`, `plan_items`, `feedback`, `adaptation_events`, `resources`, `events`.

API: see README → *API reference*.

## 7. Safety, privacy and limits

Not a medical device. No clinical scores. Prompt-injection resistance: task titles and notes are untrusted data, kept inside a delimited JSON payload under a fixed server-side system prompt. Real deployment would still need authentication, encryption, a retention policy, a security review, a legal review, a licensing review and human-reviewed support pathways.

## 8. Success metrics (hackathon)

The scripted demo completes every time · CRUD and persistence tests pass · radar maths is deterministic · at least one live AI call during the demo · 100% of plans returned to the UI fit the time budget · ≥2 adaptation scenarios pass · delete removes every record · the frontend builds.

Pilot hypotheses (**future, unproven**): ≥70% of onboarded users check in · ≥60% of check-ins lead to a plan · ≥50% of plans get feedback · average helpfulness ≥4/5.

## 9. Demo scenario

Synthetic profile with three tasks: DBMS assignment (due today, 90 min, high) · AI quiz revision (due tomorrow, 60 min, medium) · DSA practice (later today, 30 min, medium). Available time 120 min; mood 3, sleep okay, workload 5, energy 2.
Radar shows 180 min of work against 120 min available → over capacity → live plan → low-manageability feedback ("sessions too long") → the next plan uses shorter blocks and explains why.

**Pitch line:** General AI can generate a study plan. UniWell connects a student's actual workload, daily check-ins, available time and feedback into a planning experience that adapts over time.

**Business model hypothesis:** B2B2C. Universities sponsor student access; individual check-ins stay private; any institutional analytics would be opt-in, aggregated and governed.

## 10. References

WHO, *Doing What Matters in Times of Stress* · NHS, *Breathing exercises for stress* · NHS, *Get help with stress* · NHS Every Mind Matters, *Stress* — see `DATA_SOURCES.md`.
Do not claim UniWell is the first or a globally unique product; competing student-wellbeing products exist.
