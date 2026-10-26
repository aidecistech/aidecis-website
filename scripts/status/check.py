#!/usr/bin/env python3
"""Produce public status data. Network checks live in the vendored monitor module."""

import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import monitor

UTC = timezone.utc
ROOT = Path(__file__).resolve().parents[2]
# The public page shows the website only. Internal systems and backups are monitored privately
# (aidecis-app monitor workflow) and must never appear on this public page or in this repository.
SYSTEMS = (("website", "Aidecis website"),)
TARGETS = {"website": next(target for target in monitor.TARGETS if target[1] == "website")}
RANK = {"up": 0, "maintenance": 1, "unknown": 2, "degraded": 3, "down": 4}


def stamp(value):
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_time(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("timestamps must include a timezone")
    return result.astimezone(UTC)


def worst(states):
    return max(states, key=RANK.__getitem__, default="unknown")


def check_systems(now):
    result = []
    for item_id, name in SYSTEMS:
        url, kind = TARGETS[item_id]
        try:
            healthy, measured, expected = monitor.http_health(url, kind, *monitor.http_probe(url))
        except Exception as error:
            healthy, measured, expected = False, type(error).__name__, "successful HTTPS response with expected status/body"
        state = "up" if healthy else "down"
        try:
            days = (monitor.tls_expiry(urlsplit(url).hostname) - now.timestamp()) / monitor.DAY
            if days < 14 and healthy:
                state = "degraded"
            tls_note = f"TLS {days:.2f} days remaining"
        except Exception as error:
            days, state, tls_note = None, "down", f"TLS {type(error).__name__}"
        result.append({"id": item_id, "name": name, "state": state,
                       "measured": f"{measured}; {tls_note}",
                       "expected": f"{expected}; TLS >= 14 days, valid trusted certificate",
                       "tls_days": None if days is None else round(days, 2), "checked_at": stamp(now)})
    return result


def validate_notices(maintenance, incidents):
    if not isinstance(maintenance, list) or not isinstance(incidents, list):
        raise ValueError("maintenance and incidents must be lists")
    for notice in maintenance:
        if notice["id"] not in {"all", *(row[0] for row in SYSTEMS)}:
            raise ValueError("unknown maintenance id")
        if parse_time(notice["until"]) <= parse_time(notice["from"]):
            raise ValueError("maintenance until must follow from")
        if not isinstance(notice["message"], str):
            raise ValueError("maintenance message must be text")
    for incident in incidents:
        start = parse_time(incident["started"])
        if incident.get("resolved") and parse_time(incident["resolved"]) < start:
            raise ValueError("incident resolved must follow started")
        if not all(isinstance(incident[field], str) for field in ("title", "message")):
            raise ValueError("incident title and message must be text")


def active_maintenance(maintenance, now):
    return [row for row in maintenance if parse_time(row["from"]) <= now < parse_time(row["until"])]


def roll_history(previous, items, now):
    hour = now.replace(minute=0, second=0, microsecond=0)
    cutoff = hour - timedelta(hours=719)
    result = {}
    for item in items:
        buckets = {}
        for row in previous.get(item["id"], []):
            when = parse_time(row["hour"]).replace(minute=0, second=0, microsecond=0)
            if cutoff <= when <= hour and row["state"] in RANK:
                key = stamp(when)
                buckets[key] = worst([buckets[key], row["state"]]) if key in buckets else row["state"]
        key = stamp(hour)
        buckets[key] = worst([buckets[key], item["state"]]) if key in buckets else item["state"]
        result[item["id"]] = [{"hour": key, "state": state} for key, state in sorted(buckets.items())]
    return result


def build_status(previous, now, maintenance, incidents):
    validate_notices(maintenance, incidents)
    systems = check_systems(now)
    active = active_maintenance(maintenance, now)
    for system in systems:
        if any(row["id"] in ("all", system["id"]) for row in active):
            system["measured_state"] = system["state"]
            system["state"] = "maintenance"
    return {"generated_at": stamp(now), "systems": systems,
            "history": roll_history(previous.get("history", {}), systems, now),
            "maintenance": maintenance, "incidents": incidents}


def download_previous(output):
    """Only a 404 is a safe first run; other failures must not erase history."""
    run = os.environ.get("GITHUB_RUN_ID", "local") + "-" + os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    request = Request(f"https://aidecis.com/status/status.json?v={run}",
                      headers={"Cache-Control": "no-cache", "User-Agent": "Aidecis-status/1"})
    try:
        with urlopen(request, timeout=monitor.TIMEOUT) as response:
            data = response.read(8 * 1024 * 1024 + 1)
        if len(data) > 8 * 1024 * 1024:
            raise ValueError("previous status exceeds 8 MiB")
        previous = json.loads(data)
        if not isinstance(previous, dict) or not isinstance(previous.get("history"), dict):
            raise ValueError("invalid previous status")
    except HTTPError as error:
        if error.code != 404:
            raise
        previous = {}
    output.write_text(json.dumps(previous) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download-previous", type=Path)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "status/status.json")
    args = parser.parse_args()
    if args.download_previous:
        download_previous(args.download_previous)
        return
    previous = json.loads(args.previous.read_text()) if args.previous else {}
    status = build_status(previous, datetime.now(UTC),
                          json.loads((ROOT / "status/maintenance.json").read_text()),
                          json.loads((ROOT / "status/incidents.json").read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(status, indent=2, allow_nan=False) + "\n")


if __name__ == "__main__":
    main()
