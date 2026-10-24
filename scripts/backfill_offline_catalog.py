#!/usr/bin/env python3
"""Backfill the offline catalog with the detail fields the seed does not ship.

The catalog file (src/main/resources/static-data/offline-catalog.json) carries
only the browse fields: title, synonyms, score, episodes, type, status, year,
season and imageUrl. Detail pages also need synopsis, studios, duration,
source, aired, rating, members, popularity, favorites and rank.

Jikan is unreachable from some networks, so this script reads the very same
values off the MyAnimeList detail page, which is what AnimeMetadataEnricher
does at runtime - just eagerly, once, so seeded rows are complete from boot.

    python3 scripts/backfill_offline_catalog.py --limit 5   # smoke test
    python3 scripts/backfill_offline_catalog.py             # full backfill
    python3 scripts/backfill_offline_catalog.py --clean     # scrub MAL placeholders, no network

Progress is written to a JSONL checkpoint after every page, so an interrupted
run resumes where it stopped. The catalog is rewritten atomically at the end,
keeping the original key order and formatting of the seed file.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request

# Fields added to each catalog row, in the order they are written.
NEW_FIELDS = [
    "synopsis",
    "studios",
    "duration",
    "source",
    "aired",
    "rating",
    "members",
    "popularity",
    "favorites",
    "rank",
]

MAL_URL = "https://myanimelist.net/anime/{mal_id}"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
# MyAnimeList renders these in place of a real value. Capturing them verbatim
# would persist literal "None found" studios and a "No synopsis information"
# synopsis that no later pass can correct, because the seeder and the enricher
# only ever replace empty values.
EMPTY_VALUES = {
    "none found", "add some", "unknown", "not available", "not found",
    "none", "n/a", "na", "-", "?", "tba", "to be added", "nothing found",
}
SYNOPSIS_PLACEHOLDER = re.compile(
    r"no synopsis information has been added|help improve our database", re.I
)

_console_lock = threading.Lock()


def log(message: str) -> None:
    with _console_lock:
        print(message, flush=True)


def fetch(mal_id: int, timeout: float) -> str:
    """Fetch one MAL detail page, retrying on transient failures."""
    url = MAL_URL.format(mal_id=mal_id)
    last_error = None
    for attempt in range(4):
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Encoding": "identity",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, errors="replace")
        except urllib.error.HTTPError as error:
            if error.code in (404, 410):
                # Removed/de-listed title: no detail page to read.
                raise
            if error.code not in (429, 500, 502, 503, 504):
                raise
            last_error = error
        except Exception as error:  # URLError, timeout, ConnectionResetError
            last_error = error
        time.sleep(2 ** (attempt + 1))
    raise RuntimeError(f"give up after retries: {last_error}")


def info_value(page: str, label: str) -> str | None:
    match = re.search(
        r'<span class="dark_text">' + re.escape(label) + r":</span>(.*?)</div>",
        page,
        flags=re.S,
    )
    if not match:
        return None
    text = re.sub(r"<[^>]+>", " ", match.group(1))
    text = html.unescape(text).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if not text or is_placeholder(text):
        return None
    return text


def is_placeholder(text: str) -> bool:
    """True for MAL's stand-in text ("None found", "None", "Unknown", ...).

    A value like "None found, add some" is a single label MAL renders when a
    field is empty; splitting it on commas would fabricate studios out of it.
    """
    parts = [part.strip().lower().strip(".") for part in text.split(",")]
    return bool(parts) and all(part in EMPTY_VALUES for part in parts)


def first_int(value: str | None) -> int | None:
    """Read '2,738,830', '#17' or '#62 of 23,000' as an int; None is unranked."""
    if not value:
        return None
    match = re.search(r"#?([\d,]+)", value)
    if not match:
        return None
    try:
        return int(match.group(1).replace(",", ""))
    except ValueError:
        return None


def synopsis(page: str) -> str | None:
    match = re.search(r'<p[^>]*itemprop="description"[^>]*>(.*?)</p>', page, flags=re.S)
    if not match:
        return None
    text = re.sub(r"<br\s*/?>", "\n", match.group(1), flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).replace("\xa0", " ").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text or SYNOPSIS_PLACEHOLDER.search(text):
        return None
    return text


def studios(page: str) -> list[dict]:
    """Studio anchors carry the MAL producer id the import pipeline matches on."""
    match = re.search(
        r'<span class="dark_text">Studios:</span>(.*?)</div>', page, flags=re.S
    )
    if match:
        block = match.group(1)
        found = [
            {"malId": int(mal_id), "name": html.unescape(name).strip()}
            for mal_id, name in re.findall(
                r'<a href="/anime/producer/(\d+)/[^"]*"[^>]*>([^<]+)</a>', block
            )
        ]
        found = [s for s in found if s["name"]]
        if found:
            return found
    # Fall back to the plain text list ("Studio A, Studio B"); the seeder
    # assigns a stable synthetic id when MAL did not give us one. A bare
    # "None found, add some" is MAL saying there is no studio, not two names.
    text = info_value(page, "Studios")
    names = [name.strip() for name in (text or "").split(",")]
    return [
        {"malId": None, "name": name}
        for name in names
        if name and not is_placeholder(name)
    ]


def parse(page: str) -> dict:
    return {
        "synopsis": synopsis(page),
        "studios": studios(page),
        "duration": info_value(page, "Duration"),
        "source": info_value(page, "Source"),
        "aired": info_value(page, "Aired"),
        "rating": info_value(page, "Rating"),
        "members": first_int(info_value(page, "Members")),
        "popularity": first_int(info_value(page, "Popularity")),
        "favorites": first_int(info_value(page, "Favorites")),
        "rank": first_int(info_value(page, "Ranked")),
    }


def load_checkpoint(path: str) -> dict[int, dict | None]:
    done: dict[int, dict | None] = {}
    if not os.path.exists(path):
        return done
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "malId" in entry:
                # None marks a title that could not be fetched (404/removed).
                done[entry["malId"]] = entry.get("fields")
    return done


def backfill(args: argparse.Namespace) -> tuple[dict[int, dict], list[int]]:
    rows = json.loads(open(args.input, encoding="utf-8").read())
    pending = [row["malId"] for row in rows if row["malId"] not in args.done]
    if args.limit:
        pending = pending[: args.limit]
    log(f"{len(rows)} catalog rows, {len(args.done)} already checkpointed, {len(pending)} to fetch")

    results: dict[int, dict] = dict(args.done)
    queue: list[int] = list(pending)
    failed: list[int] = []
    lock = threading.Lock()

    def worker() -> None:
        while True:
            with lock:
                if not queue:
                    return
                mal_id = queue.pop(0)
            fields = None
            error = None
            try:
                fields = parse(fetch(mal_id, args.timeout))
            except Exception as exc:  # 404, or network gives up
                error = str(exc)
                failed.append(mal_id)
            with lock:
                results[mal_id] = fields
                with open(args.checkpoint, "a", encoding="utf-8") as handle:
                    handle.write(
                        json.dumps({"malId": mal_id, "fields": fields, "error": error},
                                   ensure_ascii=False)
                        + "\n"
                    )
                log(f"[{len(results) - len(args.done)}/{len(pending)}] "
                    f"malId={mal_id} {'OK' if fields else 'FAILED: ' + str(error)}")
            time.sleep(args.delay)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(args.workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results, failed


def merge(rows: list[dict], results: dict[int, dict]) -> int:
    """Add the new fields to each row, keeping the seed's key order intact."""
    updated = 0
    for row in rows:
        fields = results.get(row["malId"])
        if not fields:
            continue
        touched = False
        for key in NEW_FIELDS:
            value = fields.get(key)
            if value in (None, "") or value == []:
                continue
            if row.get(key) in (None, ""):
                row[key] = value
                touched = True
        updated += touched
    return updated


def clean(rows: list[dict]) -> int:
    """Drop MyAnimeList's stand-in text that a run captured as a real value.

    Junk is not empty, so neither the seeder nor the enricher would ever
    replace it: "None found" studios and a "No synopsis information..." blurb
    would ship to production as if they were data.
    """
    scrubbed = 0
    for row in rows:
        touched = False
        for key in ("synopsis", "duration", "source", "aired", "rating"):
            value = row.get(key)
            if isinstance(value, str) and (
                is_placeholder(value) or SYNOPSIS_PLACEHOLDER.search(value)
            ):
                row[key] = None
                touched = True
        studios_value = row.get("studios")
        if isinstance(studios_value, list) and studios_value:
            kept = [
                studio for studio in studios_value
                if isinstance(studio, dict)
                and studio.get("name")
                and not is_placeholder(studio["name"])
            ]
            if len(kept) != len(studios_value):
                row["studios"] = kept
                touched = True
        scrubbed += touched
    return scrubbed


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_catalog = os.path.join(root, "src", "main", "resources", "static-data", "offline-catalog.json")

    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", default=default_catalog)
    parser.add_argument("--output", default=None, help="defaults to --input (in place)")
    parser.add_argument("--checkpoint", default="/tmp/offline-catalog-backfill.jsonl")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--delay", type=float, default=1.0, help="seconds between requests per worker")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--limit", type=int, default=0, help="fetch at most N rows (smoke test)")
    parser.add_argument("--refetch", action="store_true", help="ignore an existing checkpoint")
    parser.add_argument("--clean", action="store_true",
                        help="scrub MyAnimeList placeholder text from the catalog and exit (no network)")
    args = parser.parse_args()
    args.output = args.output or args.input
    if args.refetch and os.path.exists(args.checkpoint):
        os.remove(args.checkpoint)
    args.done = load_checkpoint(args.checkpoint)

    if args.clean:
        rows = json.loads(open(args.input, encoding="utf-8").read())
        scrubbed = clean(rows)
        tmp = args.output + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(rows, ensure_ascii=False))
        os.replace(tmp, args.output)
        log(f"scrubbed MyAnimeList placeholder text from {scrubbed}/{len(rows)} rows -> {args.output}")
        return 0

    results, failed = backfill(args)

    rows = json.loads(open(args.input, encoding="utf-8").read())
    updated = merge(rows, results)
    tmp = args.output + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(rows, ensure_ascii=False))
    os.replace(tmp, args.output)

    log(f"updated {updated}/{len(rows)} rows -> {args.output}")
    if failed:
        log(f"{len(failed)} titles could not be fetched: {failed[:20]}"
            + (" ..." if len(failed) > 20 else ""))
    return 1 if updated == 0 and results else 0


if __name__ == "__main__":
    sys.exit(main())
