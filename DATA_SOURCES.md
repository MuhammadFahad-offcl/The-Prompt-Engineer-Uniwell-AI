# Data sources and provenance

UniWell AI uses **no external student or mental-health dataset**. It trains no model and uses no scraped personal data. Data comes from three places:

| Data | How it is collected | Used for |
|---|---|---|
| Mood, sleep, perceived workload, energy, available time | The student's own voluntary check-in | Personalizing that student's plan |
| Tasks, deadlines, durations, priorities | Entered by the student | Pressure Radar and the plan |
| Plan feedback and item completion | Entered by the student | Adaptation rules |
| Wellbeing resource metadata | Official WHO / NHS public pages (below) | Links and citations in the Resources screen |
| Demo check-ins, tasks, plan and feedback | Generated locally by `backend/app/services/demo_service.py` | Repeatable demo only; always labelled synthetic |

## Wellbeing resources

**Date checked:** 17 November 2026.
**Method:** one HTTP GET per page, made with a descriptive user agent. We first read each site's `robots.txt`. NHS disallows all paths only for the Ultraseek crawler; WHO blocks only a list of named bad bots. Neither restricts these pages for general user agents. From each page we recorded only the page title, publisher, URL, the listed language versions, a "page last reviewed" date where one was clearly shown, and the licence statement where one was shown. Every summary is our own short description. **No page text, PDFs, illustrations, audio, exercises or logos were copied, downloaded or rehosted.** Records are stored in `backend/app/data/resources.json` and seeded into SQLite at startup.

| ID | Title | Publisher | URL | Result on 17 Nov 2026 | Date shown on page | Rights note |
|---|---|---|---|---|---|---|
| `who-doing-what-matters` | Doing What Matters in Times of Stress: An Illustrated Guide | World Health Organization | https://www.who.int/publications-detail-redirect/9789240003927 | HTTP 200. Title read from `og:title`. Page lists Arabic, Bengali, Chinese, French, Hindi, Russian, Spanish and **Urdu** versions. | No publication date found in the fetched page, so none is recorded | Page states **CC BY-NC-SA 3.0 IGO** (non-commercial). Commercial use or adaptation needs WHO permission. We link to it only and do not host or adapt the guide. |
| `nhs-breathing-exercises` | Breathing exercises for stress | NHS (UK) | https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/ | HTTP 200, title matched | "Page last reviewed: 12 June 2026" | External link only. Review NHS website terms before any commercial reuse. |
| `nhs-get-help-with-stress` | Get help with stress | NHS (UK) | https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/feelings-and-symptoms/stress/ | HTTP 200, title matched | "Page last reviewed: 4 October 2024" | External link only. The UK service details on the page may not apply in Pakistan. |
| `nhs-every-mind-matters-stress` | Stress — Every Mind Matters | NHS Every Mind Matters (UK) | https://www.nhs.uk/every-mind-matters/mental-health-issues/stress/ | HTTP 200, title matched | No review date found, so none is recorded | External link only. |

The WHO rights listing page (https://www.who.int/publications/b/53604) also returned HTTP 200 and shows the same CC BY-NC-SA 3.0 IGO statement.

**Verification fields.** `verification_status: "verified"` means only that the URL resolved and its title and metadata matched on the date checked. Every record keeps `reviewed: false` until a human checks the summary and licence position. If a future check fails, set the record to `"unverified"`; never fill in missing dates or details.

**Endorsement.** UniWell is not affiliated with or endorsed by WHO or the NHS and does not use their logos.

## Crisis and helpline numbers

No hotline numbers are included. None has been verified from an official source for this build. The safety message tells students to contact a trusted person, local emergency services or the nearest emergency department. A verified local or university contact can be added once one has been checked.

## Synthetic demo data

`POST /api/demo/seed` (development only), the onboarding and Settings buttons, and `scripts/seed_demo.py` all create a synthetic student:

- 7 days of check-ins
- 4–5 tasks
- one synthetic plan from "yesterday" (`provider: "synthetic-seed"`, labelled as **not AI output**)
- one feedback entry, processed by the real adaptation engine

Every seeded row has `is_synthetic = true`, and the UI shows **"Demo data — synthetic example"** wherever these records appear. The values are invented. They do not describe real students and are not measured outcomes.
