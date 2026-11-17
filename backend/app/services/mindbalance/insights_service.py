"""Emotional pattern insights from the student's OWN self-reported history.

Every statement states its sample size, is shown only above a minimum number of observations,
and is worded as an observed pattern — never a cause, label or diagnosis.
"""
from collections import Counter, defaultdict
from datetime import date, timedelta
from statistics import mean

from app.core.clock import ensure_aware_utc, get_zone
from app.db.models import RecoverySession, Task, WellbeingCheckIn
from app.services.mindbalance.wellbeing_analysis import MOOD_SCORE

WINDOW_DAYS = 14
MIN_TREND_DAYS = 3
MIN_CORRELATION_DAYS = 5
MIN_GROUP_DAYS = 2


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2:
        return None
    mx, my = mean(xs), mean(ys)
    sx = sum((x - mx) ** 2 for x in xs) ** 0.5
    sy = sum((y - my) ** 2 for y in ys) ** 0.5
    if sx == 0 or sy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)


def build_insights(*, today: date, tz: str, checkins: list[WellbeingCheckIn], sessions: list[RecoverySession],
                   tasks: list[Task]) -> dict:
    start = today - timedelta(days=WINDOW_DAYS - 1)
    daily = [c for c in checkins if c.kind == "daily" and start <= c.local_date <= today]

    by_day: dict[date, list[WellbeingCheckIn]] = defaultdict(list)
    for c in daily:
        by_day[c.local_date].append(c)

    days = []
    for i in range(WINDOW_DAYS):
        d = start + timedelta(days=i)
        rows = by_day.get(d, [])
        days.append({
            "local_date": d.isoformat(),
            "weekday": d.strftime("%a"),
            "count": len(rows),
            "stress": round(mean(r.stress for r in rows), 1) if rows else None,
            "energy": round(mean(r.energy for r in rows), 1) if rows else None,
            "mood": round(mean(MOOD_SCORE[r.mood] for r in rows), 1) if rows else None,
        })
    recorded = [d for d in days if d["count"]]
    n_days = len(recorded)

    completed = [s for s in sessions if s.status == "completed"]
    usage = Counter(s.activity for s in completed)
    helpful = {a: Counter(s.helpful for s in completed if s.activity == a and s.helpful) for a in usage}
    with_change = [s for s in completed if None not in (s.pre_stress, s.post_stress, s.pre_energy, s.post_energy)]
    avg_change = None
    if with_change:
        avg_change = {
            "sessions": len(with_change),
            "stress": round(mean(s.post_stress - s.pre_stress for s in with_change), 1),
            "energy": round(mean(s.post_energy - s.pre_energy for s in with_change), 1),
        }

    observations: list[dict] = []

    # 1) Recent direction: last 3 recorded days, stress rising while energy falling.
    if n_days >= MIN_TREND_DAYS:
        last = recorded[-3:]
        s, e = [d["stress"] for d in last], [d["energy"] for d in last]
        if s[0] < s[1] < s[2] and e[0] > e[1] > e[2]:
            observations.append({"text": "Your reported stress has increased over your last three check-in days while your reported energy has decreased.",
                                 "sample_size": 3, "kind": "observed_trend"})
        elif s[0] > s[1] > s[2]:
            observations.append({"text": "Your reported stress has gone down across your last three check-in days.",
                                 "sample_size": 3, "kind": "observed_trend"})

    # 2) Stress vs energy relationship.
    if n_days >= MIN_CORRELATION_DAYS:
        r = _pearson([d["stress"] for d in recorded], [d["energy"] for d in recorded])
        if r is not None and abs(r) >= 0.5:
            direction = "lower" if r < 0 else "higher"
            observations.append({"text": f"On days you reported higher stress, you also tended to report {direction} energy (correlation {r:.2f}). This is a pattern in your entries, not a cause.",
                                 "sample_size": n_days, "kind": "observed_association"})

    # 3) Stress around upcoming deadlines (association only).
    if n_days >= MIN_CORRELATION_DAYS and tasks:
        zone = get_zone(tz)
        deadline_dates = [ensure_aware_utc(t.deadline).astimezone(zone).date() for t in tasks]
        near, far = [], []
        for d in recorded:
            dd = date.fromisoformat(d["local_date"])
            (near if any(0 <= (x - dd).days <= 2 for x in deadline_dates) else far).append(d["stress"])
        if len(near) >= MIN_GROUP_DAYS and len(far) >= MIN_GROUP_DAYS and mean(near) - mean(far) >= 1.5:
            observations.append({"text": f"Your reported stress was higher on days with a deadline within two days (average {mean(near):.1f} vs {mean(far):.1f}). This is an association in your data, not proof that deadlines caused it.",
                                 "sample_size": n_days, "kind": "observed_association"})

    # 4) Recovery breaks the student rated helpful.
    better = [s for s in with_change if s.post_stress < s.pre_stress and s.helpful in ("yes", "somewhat")]
    if len(better) >= 2:
        observations.append({"text": f"You reported lower stress after a recovery activity and rated it helpful on {len(better)} occasions.",
                             "sample_size": len(with_change), "kind": "self_reported_feedback"})

    return {
        "window_days": WINDOW_DAYS,
        "days": days,
        "days_with_checkins": n_days,
        "consistency_pct": round(100 * n_days / WINDOW_DAYS),
        "total_checkins": len(daily),
        "recovery_usage": dict(usage),
        "recovery_helpfulness": {a: dict(c) for a, c in helpful.items()},
        "average_change_after_recovery": avg_change,
        "observations": observations,
        "min_days_for_observations": MIN_TREND_DAYS,
        "scatter": [{"stress": d["stress"], "energy": d["energy"], "date": d["local_date"]} for d in recorded],
    }
