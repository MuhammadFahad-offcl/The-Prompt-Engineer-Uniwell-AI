"""Seed a clearly labelled SYNTHETIC demo student into the local SQLite database.

Usage (from the repo root, with the backend virtualenv):
    backend/.venv/Scripts/python scripts/seed_demo.py --user-id <your anonymous ID> [--scenario overloaded|manageable]

Your anonymous ID is shown in the app under Settings → Privacy notice. Seeding REPLACES all data
for that ID. The easier path in the running app is Settings → Demo data (or the buttons on the
onboarding screen), which calls POST /api/demo/seed.
"""
import argparse
import sys
import uuid
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.core.security import validate_user_id  # noqa: E402
from app.db.database import SessionLocal, init_db  # noqa: E402
from app.services.demo_service import seed_demo  # noqa: E402
from app.services.resource_service import seed_resources  # noqa: E402


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--user-id", default=None, help="anonymous ID to seed (default: a new random one)")
    parser.add_argument("--scenario", choices=["overloaded", "manageable"], default="overloaded")
    parser.add_argument("--timezone", default="Asia/Karachi")
    args = parser.parse_args()

    user_id = validate_user_id(args.user_id or "uw-demo-" + uuid.uuid4().hex[:12])
    init_db()
    with SessionLocal() as db:
        seed_resources(db)
        result = seed_demo(db, user_id, args.scenario, args.timezone)
    print(f"Seeded {result['label']!r} — scenario={args.scenario}")
    print(f"  anonymous user_id: {user_id}")
    for k, v in result["counts"].items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
