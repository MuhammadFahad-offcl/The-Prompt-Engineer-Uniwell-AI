# UniWell AI

**Your academic journey, your wellbeing, intelligently connected.**

UniWell AI is a non-clinical student wellbeing and academic workload companion (SDG 03 — Good Health & Well-being).
It is under active development during the hackathon; full documentation lands with the final milestone.

> UniWell is a student wellbeing and planning companion, **not** a medical or mental-health diagnostic service.

## Quick start (development)

```bash
# backend
cd backend
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

Copy `.env.example` to `.env` and add an AI provider key. See `docs/PRD.md` for the product spec.
