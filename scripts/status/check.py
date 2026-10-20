#!/usr/bin/env python3
"""Produce public status data. Network checks live in the vendored monitor module."""

import argparse
from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import monitor

UTC = timezone.utc
ROOT = Path(__file__).resolve().parents[2]
SYSTEMS = (
    ("demo", "Aidecis demo"), ("app", "Aidecis app"), ("website", "Aidecis website"),
    ("csm", "CSM"), ("crm", "CRM"), ("libi", "LIBI"),
)
BACKUPS = {
    "app-nightly": "App nightly",
    "libi-base": "LIBI dumps and base backups",
    "libi-wal": "LIBI WAL",
    "crm-csm": "CRM/CSM",
    "mac-mirror": "Mac mirror",
    "internxt-archive": "Internxt archive",
}
EXTERNAL = {"mac-mirror", "internxt-archive"}
EXTERNAL_LIMIT = 26 * 60
RANK = {"up": 0, "ok": 0, "maintenance": 1, "unknown": 2,
        "degraded": 3, "stale": 3, "down": 4, "failed": 4}


def stamp(value):
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_time(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("timestamps must include a timezone")
    return result.astimezone(UTC)


def worst(states):
    return max(states, key=RANK.__getitem__, default="unknown")


def http_health(url, kind, status, location, body):
    """Upstream checks plus the exact deployed CRM/CSM and LIBI destinations."""
    host = urlsplit(url).hostname
    target = urlsplit(urljoin(url, location))
    path = "/desk" if host == "libi.aidecis.com" else "/google-login.php"
    if host in {"libi.aidecis.com", "crm.aidecis.com", "csm.aidecis.com"}:
        if (status in monitor.REDIRECTS and location and target.scheme == "https"
                and target.hostname == host and target.username is None
                and target.port in (None, 443) and target.path.rstrip("/") == path):
            return (True, f"HTTP {status}, Location=https://{host}{target.path}",
                    f"HTTP 200 or expected HTTPS redirect on {host}")
    return monitor.http_health(url, kind, status, location, body)


def check_systems(now):
    result = []
    for (item_id, name), (url, kind) in zip(SYSTEMS, monitor.TARGETS):
        try:
            healthy, measured, expected = http_health(url, kind, *monitor.http_probe(url))
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


def empty_backup(item_id, note="No data: no source configured."):
    return {"id": item_id, "name": BACKUPS[item_id], "last_success": None,
            "age_minutes": None, "size_bytes": None, "state": "unknown", "note": note}


def evidence(item_id, mtime, size, limit, now, note):
    item = empty_backup(item_id, note)
    if mtime is None:
        item.update(state="failed", note=note + " No matching file.")
        return item
    age = (now.timestamp() - mtime) / 60
    state = "failed" if age < -5 else ("ok" if age < limit else "stale")
    item.update(last_success=stamp(datetime.fromtimestamp(mtime, UTC)),
                age_minutes=round(age, 2), size_bytes=size, state=state)
    if age < -5:
        item["note"] += " File timestamp is more than five minutes in the future."
    return item


def backup_snapshot(sftp, user, now):
    # Keep the upstream traversal and service attribution rules, collecting size metadata too.
    records = []

    class RecordingTree:
        def listdir_iter(self, folder):
            for entry in sftp.listdir_iter(folder):
                records.append((folder, entry))
                yield entry

    newest, services = monitor.scan_backups(RecordingTree())

    def size_at(mtime, predicate):
        sizes = [getattr(entry, "st_size", None) for folder, entry in records
                 if monitor.stat.S_ISREG(entry.st_mode) and entry.st_mtime == mtime and predicate(folder, entry)]
        return next((size for size in sizes if size is not None), None)

    if user == "u690159-sub1":
        mtime = newest["manifest"]
        size = size_at(mtime, lambda folder, entry: monitor.fnmatch.fnmatchcase(entry.filename, "aidecis-*.sha256"))
        return {"app-nightly": evidence("app-nightly", mtime, size, 26 * 60, now,
                "Newest aidecis-*.sha256 manifest. Size is the manifest, not the backup payload.")}
    mtime = newest["any"]
    result = {"libi-wal": evidence("libi-wal", mtime, size_at(mtime, lambda folder, entry: True), 60, now,
              "Newest file anywhere in sub2, matching the app monitor's WAL-copy check; not proof of restoreability.")}
    if services:
        # Every subtree must pass, including the future-clock check in each tree.
        candidates = []
        for service, mtime in services.items():
            size = size_at(mtime, lambda folder, entry: service in monitor.crm_paths(folder))
            candidates.append(evidence("crm-csm", mtime, size, 26 * 60, now,
                    "Worst freshness across all readable CRM/CSM subtrees; size is its latest file."))
        result["crm-csm"] = max(candidates, key=lambda row: (RANK[row["state"]],
                                math.inf if row["age_minutes"] is None else row["age_minutes"]))
    else:
        result["crm-csm"] = empty_backup("crm-csm", "No data: no readable CRM/CSM subtree; encrypted names cannot identify the service.")
    return result


def check_backups(previous, now):
    items = {item_id: empty_backup(item_id) for item_id in BACKUPS}
    items["libi-base"]["note"] = "No data: dumps and base backups have no separately identifiable evidence. WAL freshness does not establish this tier."
    for old in previous.get("backups", []):
        if old.get("id") in EXTERNAL:
            items[old["id"]] = refresh_external(old, now)
    if not all(os.environ.get(key, "").strip() for key in ("STORAGEBOX_READONLY_KEY", "STORAGEBOX_KNOWN_HOSTS")):
        for item_id in ("app-nightly", "libi-wal", "crm-csm"):
            items[item_id]["note"] = "No data: Storage Box read-only key or pinned host keys are not configured."
        return list(items.values())

    # Use upstream's pinned-key connection and private temporary files, replacing only its reporter.
    class Collector:
        def check(self, name, measured, expected, healthy):
            user = name.split()[-1]
            ids = ("app-nightly",) if user == "u690159-sub1" else ("libi-wal", "crm-csm")
            for item_id in ids:
                old = next((row for row in previous.get("backups", []) if row.get("id") == item_id), None)
                if old:
                    for field in ("last_success", "size_bytes"):
                        items[item_id][field] = old.get(field)
                    if old.get("last_success"):
                        items[item_id]["age_minutes"] = round((now - parse_time(old["last_success"])).total_seconds() / 60, 2)
                items[item_id].update(state="failed", note=f"Storage Box check failed ({measured}); last known evidence retained.")

    original = monitor.check_backup_tree
    try:
        monitor.check_backup_tree = lambda report, user, sftp, timestamp: items.update(backup_snapshot(sftp, user, now))
        monitor.backup(Collector())
    finally:
        monitor.check_backup_tree = original
    return list(items.values())


def validate_external(payload, now):
    if not isinstance(payload, dict) or payload.get("id") not in EXTERNAL:
        raise ValueError("only mac-mirror and internxt-archive accept external updates")
    if payload.get("state") not in {"ok", "stale", "failed", "unknown"}:
        raise ValueError("invalid external state")
    reported = parse_time(payload["reported_at"])
    if reported > now + timedelta(minutes=5):
        raise ValueError("reported_at is in the future")
    success = payload.get("last_success")
    if success is not None and parse_time(success) > reported + timedelta(minutes=5):
        raise ValueError("last_success is later than reported_at")
    if payload["state"] == "ok" and success is None:
        raise ValueError("ok requires last_success")
    size = payload.get("size_bytes")
    if size is not None and (type(size) is not int or size < 0):
        raise ValueError("size_bytes must be a nonnegative integer or null")
    note = payload.get("note", "")
    if not isinstance(note, str) or len(note) > 500:
        raise ValueError("note must be a public string of at most 500 characters")
    limit = payload.get("max_age_minutes", EXTERNAL_LIMIT)
    if type(limit) is not int or not 1 <= limit <= 366 * 24 * 60:
        raise ValueError("max_age_minutes must be an integer between 1 and 527040")
    item = empty_backup(payload["id"], note)
    item.update(last_success=success, size_bytes=size, reported_at=stamp(reported),
                reported_state=payload["state"], max_age_minutes=limit)
    return refresh_external(item, now)


def refresh_external(item, now):
    result = dict(item)
    result["name"] = BACKUPS[item["id"]]
    if not item.get("reported_at"):
        return empty_backup(item["id"], "No data: waiting for a Mac report.")
    age = None if not item.get("last_success") else (now - parse_time(item["last_success"])).total_seconds() / 60
    report_age = (now - parse_time(item["reported_at"])).total_seconds() / 60
    state = item["reported_state"]
    limit = item.get("max_age_minutes", EXTERNAL_LIMIT)
    if state == "ok" and (age is None or age >= limit or report_age >= limit):
        state = "stale"
    if age is not None and age < -5:
        state = "failed"
    result.update(age_minutes=None if age is None else round(age, 2), state=state)
    return result


def merge_external(backups, payload, now):
    incoming = validate_external(payload, now)
    for index, old in enumerate(backups):
        if old["id"] != incoming["id"]:
            continue
        if old.get("reported_at") and parse_time(old["reported_at"]) >= parse_time(incoming["reported_at"]):
            return  # Retries and out-of-order dispatches cannot replace newer evidence.
        if incoming["last_success"] is None:
            incoming.update(last_success=old.get("last_success"), size_bytes=old.get("size_bytes"))
        backups[index] = refresh_external(incoming, now)
        return


def validate_notices(maintenance, incidents):
    if not isinstance(maintenance, list) or not isinstance(incidents, list):
        raise ValueError("maintenance and incidents must be lists")
    for notice in maintenance:
        if notice["id"] not in {"all", *BACKUPS, *(row[0] for row in SYSTEMS)}:
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


def build_status(previous, now, maintenance, incidents, payload=None):
    validate_notices(maintenance, incidents)
    systems = check_systems(now)
    backups = check_backups(previous, now)
    if payload is not None:
        merge_external(backups, payload, now)
    active = active_maintenance(maintenance, now)
    for system in systems:
        if any(row["id"] in ("all", system["id"]) for row in active):
            system["measured_state"] = system["state"]
            system["state"] = "maintenance"
    return {"generated_at": stamp(now), "systems": systems, "backups": backups,
            "history": roll_history(previous.get("history", {}), systems + backups, now),
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
    payload = None
    if os.environ.get("GITHUB_EVENT_NAME") == "repository_dispatch":
        payload = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())["client_payload"]
    status = build_status(previous, datetime.now(UTC),
                          json.loads((ROOT / "status/maintenance.json").read_text()),
                          json.loads((ROOT / "status/incidents.json").read_text()), payload)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(status, indent=2, allow_nan=False) + "\n")


if __name__ == "__main__":
    main()
