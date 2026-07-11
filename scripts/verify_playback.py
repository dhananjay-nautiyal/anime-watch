#!/usr/bin/env python3
"""Automated playback verification script.

Tests every anime in the database for end-to-end playback:
  Anime Details → Search Provider → Find Correct Anime → Fetch Episodes → Fetch Stream → Resolve Embed URL

Usage:
  python3 scripts/verify_playback.py [--base-url URL] [--mal-id ID] [--verbose]

Examples:
  python3 scripts/verify_playback.py
  python3 scripts/verify_playback.py --mal-id 1
  python3 scripts/verify_playback.py --base-url http://localhost:8080 --verbose
"""

import argparse
import json
import sys
import time
import requests
from urllib.parse import urljoin

BASE_URL = "http://localhost:8080"
VERBOSE = False
TIMEOUT = 30
EMBED_TIMEOUT = 20

PASS = "PASS"
FAIL = "FAIL"
SKIP = "SKIP"

results = {"pass": 0, "fail": 0, "skip": 0, "details": []}

def log(msg, level="INFO"):
    if VERBOSE or level in ("ERROR", "RESULT"):
        print(f"[{level}] {msg}", flush=True)

def api_get(path, timeout=TIMEOUT, params=None):
    url = urljoin(BASE_URL, path)
    try:
        resp = requests.get(url, params=params, timeout=timeout)
        return resp.status_code, resp.json() if resp.text else None
    except requests.Timeout:
        log(f"Timeout: {url}", "ERROR")
        return None, None
    except Exception as e:
        log(f"Request failed: {url} error={e}", "ERROR")
        return None, None

def api_post(path, timeout=TIMEOUT):
    url = urljoin(BASE_URL, path)
    try:
        resp = requests.post(url, timeout=timeout)
        return resp.status_code, resp.json() if resp.text else None
    except requests.Timeout:
        log(f"Timeout: {url}", "ERROR")
        return None, None
    except Exception as e:
        log(f"Request failed: {url} error={e}", "ERROR")
        return None, None

def test_anime(mal_id):
    log(f"\n{'='*60}")
    log(f"Testing malId={mal_id}", "RESULT")
    log(f"{'='*60}")

    # Step 1: Fetch anime details
    log(f"[Step 1] Fetch anime details...")
    status, data = api_get(f"/api/anime/{mal_id}")
    if status is None:
        record(mal_id, FAIL, "API_UNREACHABLE", "Cannot reach server")
        return
    
    if status != 200 or data is None:
        record(mal_id, FAIL, "FETCH_ANIME_FAILED", f"HTTP {status}")
        return

    anime = data.get("data")
    if not anime:
        record(mal_id, FAIL, "ANIME_NOT_FOUND", "No anime data returned")
        return

    title = anime.get("title", "Unknown")
    log(f"  Title: {title}", "RESULT")

    # Step 2: Try fetching episodes (may be empty)
    log(f"[Step 2] Fetch episodes (DB)...")
    status, ep_data = api_get(f"/api/anime/{mal_id}/episodes")
    has_db_episodes = False
    if status == 200 and ep_data:
        eps = ep_data.get("data", [])
        has_db_episodes = len(eps) > 0
        log(f"  DB episodes: {len(eps)}")

    # Step 3: Sync episodes from provider
    log(f"[Step 3] Sync episodes from provider (Anineko → GoGoAnime)...")
    sync_start = time.time()
    status, sync_data = api_post(f"/api/anime/{mal_id}/episodes/sync", timeout=60)
    sync_duration = time.time() - sync_start

    if status is None:
        record(mal_id, FAIL, "SYNC_UNREACHABLE", "Cannot reach server during sync")
        return

    if status != 200 or sync_data is None:
        record(mal_id, FAIL, "SYNC_FAILED", f"HTTP {status}")
        return

    if not sync_data.get("success", False):
        error_code = sync_data.get("errorCode") or sync_data.get("status", "UNKNOWN")
        error_msg = sync_data.get("message", "Unknown error")
        log(f"  Sync failed: [{error_code}] {error_msg}", "ERROR")
        record(mal_id, FAIL, error_code, f"Sync failed: {error_msg}")
        return

    synced_eps = sync_data.get("episodes") or sync_data.get("data", [])
    ep_count = len(synced_eps)
    log(f"  Episodes synced: {ep_count} (in {sync_duration:.1f}s)", "RESULT")

    if ep_count == 0:
        record(mal_id, SKIP, "NO_EPISODES", "Provider returned 0 episodes")
        return

    # Step 4: Test embed URL resolution for first 5 episodes
    max_test = min(5, ep_count)
    failed_embeds = 0
    tested_episodes = []

    for i in range(max_test):
        ep = synced_eps[i]
        ep_num = ep.get("episodeNumber", i + 1)
        ep_url = ep.get("embedUrl", "")
        
        if not ep_url:
            log(f"  Episode {ep_num}: no embedUrl in synced data", "ERROR")
            failed_embeds += 1
            continue

        log(f"[Step 4.{i+1}] Fetch embed for episode {ep_num}...")
        embed_start = time.time()
        status, embed_data = api_get(f"/api/anime/{mal_id}/episode/embed", params={"episodeUrl": ep_url}, timeout=EMBED_TIMEOUT)
        embed_duration = time.time() - embed_start

        if status is None:
            log(f"  Episode {ep_num}: API unreachable", "ERROR")
            failed_embeds += 1
            tested_episodes.append((ep_num, FAIL, "API_UNREACHABLE"))
            continue

        if embed_data is None:
            log(f"  Episode {ep_num}: empty response", "ERROR")
            failed_embeds += 1
            tested_episodes.append((ep_num, FAIL, "EMPTY_RESPONSE"))
            continue

        payload = embed_data.get("data", {})
        embed_url = payload.get("embedUrl", "") if payload else ""
        stream_type = payload.get("type", "") if payload else ""

        if embed_url:
            log(f"  Episode {ep_num}: type={stream_type} url_preview='{embed_url[:80]}...' ({embed_duration:.1f}s)", "RESULT")
            tested_episodes.append((ep_num, PASS, f"type={stream_type}"))
        else:
            error_msg = embed_data.get("message", "No embed URL")
            log(f"  Episode {ep_num}: FAILED - {error_msg}", "ERROR")
            failed_embeds += 1
            tested_episodes.append((ep_num, FAIL, error_msg))

        time.sleep(0.5)

    # Final result
    if failed_embeds == 0:
        record(mal_id, PASS, "OK",
               f"title='{title}' episodes={ep_count} tested={max_test} all_embeds_ok",
               episodes=ep_count, tested=max_test)
    elif failed_embeds == max_test:
        record(mal_id, FAIL, "ALL_EMBEDS_FAILED",
               f"title='{title}' episodes={ep_count} tested={max_test} all_embeds_failed",
               episodes=ep_count, tested=max_test)
    else:
        record(mal_id, FAIL, "SOME_EMBEDS_FAILED",
               f"title='{title}' episodes={ep_count} tested={max_test} failed={failed_embeds}",
               episodes=ep_count, tested=max_test)

def record(mal_id, status, code, message, **extra):
    result = {"malId": mal_id, "status": status, "code": code, "message": message, **extra}
    results["details"].append(result)
    if status == PASS:
        results["pass"] += 1
        log(f"  RESULT: {status} | code={code} | {message}", "RESULT")
    elif status == FAIL:
        results["fail"] += 1
        log(f"  RESULT: {status} | code={code} | {message}", "ERROR")
    else:
        results["skip"] += 1
        log(f"  RESULT: {status} | code={code} | {message}", "INFO")

def main():
    global BASE_URL, VERBOSE

    parser = argparse.ArgumentParser(description="Verify anime playback end-to-end")
    parser.add_argument("--base-url", default="http://localhost:8080", help="Backend base URL")
    parser.add_argument("--mal-id", type=int, help="Test specific MAL ID only")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    BASE_URL = args.base_url
    VERBOSE = args.verbose

    start_time = time.time()

    if args.mal_id:
        test_anime(args.mal_id)
    else:
        # Fetch all anime from DB
        log("Fetching all anime from database...")
        status, data = api_get("/api/anime/trending", params={"page": 0, "size": 100})
        if status != 200 or data is None:
            log("Failed to fetch anime list", "ERROR")
            sys.exit(1)

        anime_list = data.get("data", [])
        log(f"Found {len(anime_list)} anime in database", "RESULT")

        if not anime_list:
            log("No anime in database to test", "ERROR")
            sys.exit(0)

        for i, anime in enumerate(anime_list):
            mal_id = anime.get("malId") or anime.get("id")
            if mal_id:
                log(f"\n--- Testing [{i+1}/{len(anime_list)}] malId={mal_id} ---")
                test_anime(mal_id)
                # Rate limiting
                if i < len(anime_list) - 1:
                    delay = 2.0
                    log(f"  Waiting {delay}s before next test...")
                    time.sleep(delay)

    # Summary
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"VERIFICATION SUMMARY")
    print(f"{'='*60}")
    print(f"  Duration: {elapsed:.1f}s")
    print(f"  PASS:     {results['pass']}")
    print(f"  FAIL:     {results['fail']}")
    print(f"  SKIP:     {results['skip']}")
    print(f"  TOTAL:    {results['pass'] + results['fail'] + results['skip']}")
    print()

    if results["fail"] > 0:
        print("FAILED TESTS:")
        for d in results["details"]:
            if d["status"] == FAIL:
                print(f"  malId={d['malId']}: [{d['code']}] {d['message']}")
        print()

    # Output JSON for CI
    report = {
        "duration": round(elapsed, 1),
        "pass": results["pass"],
        "fail": results["fail"],
        "skip": results["skip"],
        "results": results["details"]
    }
    with open("scripts/verify_report.json", "w") as f:
        json.dump(report, f, indent=2)
    log(f"Report written to scripts/verify_report.json")

    sys.exit(0 if results["fail"] == 0 else 1)

if __name__ == "__main__":
    main()
