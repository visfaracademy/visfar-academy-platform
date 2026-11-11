#!/usr/bin/env python3
"""Apply migrations 0025-0031 to Supabase PROD via Management API.

Usage:
    SUPABASE_ACCESS_TOKEN=$(cat) python3 scripts/apply-migrations-0025-0031-prod.py
    # or: read -s SUPABASE_ACCESS_TOKEN; export SUPABASE_ACCESS_TOKEN; python3 scripts/apply-migrations-0025-0031-prod.py

- One file at a time, in order 0025 -> 0031. HTTP 201 = success.
- Verifies after each file; STOPS immediately on any non-201 (does not
  run the next file).
- The token is read ONLY from the SUPABASE_ACCESS_TOKEN env var and is
  NEVER printed, logged or written to any file.
- Manual API runs do NOT write supabase_migrations.schema_migrations:
  record the run in docs/supabase/MIGRATION_GUIDE.md §3.2 afterwards.
- Prod ref: ugynqjqyfynkmqutoarp. Staging ref (for dry runs):
  scskhplczrxlnxzruweu (pass --ref to override; default is PROD).
"""
import json
import os
import sys
import urllib.request
import urllib.error

PROD_REF = "ugynqjqyfynkmqutoarp"
MIGRATIONS = [
    ("0025_master_library.sql", "master_library_items"),
    ("0026_rename_course_08.sql", "courses"),
    ("0027_assessments_11d.sql", "assessments_11d"),
    ("0028_fix_s03_lessons_rls.sql", "lessons"),
    ("0029_ai_mentor.sql", "ai_knowledge_chunks"),
    ("0030_community.sql", "community_posts"),
    ("0031_gamification.sql", "learning_points"),
]

VERIFY_SQL = {
    "0025_master_library.sql":
        "select count(*) as n from public.master_library_items where is_published = true;",
    "0026_rename_course_08.sql":
        "select title from public.courses where slug = 'master-tam-thuc-nhan-hieu';",
    "0027_assessments_11d.sql":
        "select count(*) as n from pg_tables where schemaname='public' and tablename='assessments_11d';",
    "0028_fix_s03_lessons_rls.sql":
        "select policyname from pg_policies where schemaname='public' and tablename='lessons';",
    "0029_ai_mentor.sql":
        "select count(*) as n from public.ai_knowledge_chunks;",
    "0030_community.sql":
        "select count(*) as n from pg_tables where schemaname='public' and tablename like 'community_%';",
    "0031_gamification.sql":
        "select count(*) as n from pg_tables where schemaname='public' and tablename in "
        "('learning_points','badges','user_badges','learning_streaks');",
}


def run_query(ref, token, sql):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    ref = PROD_REF
    if "--ref" in sys.argv:
        ref = sys.argv[sys.argv.index("--ref") + 1]
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        print("ERROR: SUPABASE_ACCESS_TOKEN env var is empty. Aborting.", file=sys.stderr)
        sys.exit(2)
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations")
    print(f"Target project ref: {ref}")
    for fname, _table in MIGRATIONS:
        path = os.path.join(base, fname)
        with open(path, encoding="utf-8") as f:
            sql = f.read()
        print(f"\n== {fname} ({len(sql)} chars) ==")
        status, body = run_query(ref, token, sql)
        print(f"HTTP {status}")
        if status != 201:
            print(f"FAILED. Body (first 2000 chars): {body[:2000]}", file=sys.stderr)
            print("STOPPED. Do not run the next file. See docs/supabase/MIGRATION_GUIDE.md §8.", file=sys.stderr)
            sys.exit(1)
        vstatus, vbody = run_query(ref, token, VERIFY_SQL[fname])
        print(f"verify HTTP {vstatus}: {vbody[:500]}")
        if vstatus != 201:
            print("VERIFY FAILED. Stopping.", file=sys.stderr)
            sys.exit(1)
    print("\nALL 7 MIGRATIONS APPLIED (HTTP 201 each).")
    print("Next: run scripts/verify-prod-p0.py (anon probes) + record in MIGRATION_GUIDE.md §3.2.")


if __name__ == "__main__":
    main()
