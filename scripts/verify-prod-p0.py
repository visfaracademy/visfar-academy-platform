#!/usr/bin/env python3
"""Anon probes on Supabase PROD after migrations 0025-0031 (P0 verification).

Reads the anon key from apps/web/.env.local (never prints it).
Expected after a successful apply:
  - lessons:            anon SELECT -> 0 rows (0028 S-03 fix)
  - master_library_items: anon SELECT is_published=true -> 119 rows (0025)
  - ai_knowledge_chunks:  anon SELECT -> 138 rows (0029; content public by design)
  - community_posts / learning_points / assessments_11d:
                        anon -> 401 (authenticated-only, 0030/0031/0027)
  - lessons_preview_video: view exists (0028)
Usage: python3 scripts/verify-prod-p0.py [--url URL] [--key-file PATH]
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def load_env(path):
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
            if m:
                out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def get(url, key):
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    env = load_env(os.path.join(ROOT, "apps", "web", ".env.local"))
    base = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    if not base or not key:
        print("ERROR: .env.local missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY", file=sys.stderr)
        sys.exit(2)
    print(f"Supabase URL host: {base}")
    checks = [
        ("lessons (expect 0 rows)", f"{base}/rest/v1/lessons?select=id&limit=100"),
        ("master_library_items published (expect 119)",
         f"{base}/rest/v1/master_library_items?select=id&is_published=eq.true&limit=200"),
        ("ai_knowledge_chunks (expect 138)",
         f"{base}/rest/v1/ai_knowledge_chunks?select=id&limit=200"),
        ("community_posts (expect 401)",
         f"{base}/rest/v1/community_posts?select=id&limit=1"),
        ("learning_points (expect 401)",
         f"{base}/rest/v1/learning_points?select=id&limit=1"),
        ("assessments_11d (expect 200, 0 rows — own-only policy, anon uid is null)",
         f"{base}/rest/v1/assessments_11d?select=id&limit=1"),
        ("lessons_preview_video view (expect 200)",
         f"{base}/rest/v1/lessons_preview_video?select=id&limit=1"),
    ]
    ok = True
    for name, url in checks:
        status, body = get(url, key)
        try:
            n = len(json.loads(body)) if body.startswith("[") else body[:120]
        except Exception:
            n = body[:120]
        print(f"- {name}: HTTP {status} -> {n}")
        if "expect 0 rows" in name and not (status == 200 and n == 0):
            ok = False
        if "expect 119" in name and not (status == 200 and n == 119):
            ok = False
        if "expect 138" in name and not (status == 200 and n == 138):
            ok = False
        if "expect 401" in name and status != 401:
            ok = False
        if "expect 200, 0 rows" in name and not (status == 200 and n == 0):
            ok = False
        if "expect 200" in name and status != 200:
            ok = False
    print("RESULT:", "ALL P0 PROBES PASS" if ok else "MISMATCH — see lines above")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
