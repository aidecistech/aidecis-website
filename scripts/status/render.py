#!/usr/bin/env python3
"""Render status HTML using only the standard library; --sample makes an offline preview."""

import argparse
from datetime import datetime, timedelta
from html import escape
import json
from pathlib import Path
import shutil
from string import Template

from check import (BACKUPS, ROOT, SYSTEMS, UTC, active_maintenance, empty_backup,
                   parse_time, roll_history, stamp, worst)

LABELS = {"up": "Operational", "degraded": "Degraded", "down": "Down", "maintenance": "Maintenance",
          "unknown": "No data", "ok": "OK", "stale": "Stale", "failed": "Failed"}


def time_html(value):
    if not value:
        return "No data"
    when = parse_time(value)
    return f'<time datetime="{escape(stamp(when))}">{when:%d %b %Y, %H:%M} UTC</time>'


def badge(state):
    return f'<span class="state {state}"><span aria-hidden="true">●</span> {LABELS[state]}</span>'


def age_text(value):
    if value is None:
        return "No data"
    if value < 0:
        return "Future timestamp"
    if value < 60:
        return f"{value:.0f} min"
    if value < 1440:
        return f"{value / 60:.1f} h"
    return f"{value / 1440:.1f} days"


def size_text(value):
    if value is None:
        return "No data"
    size = float(value)
    for unit in ("B", "KiB", "MiB", "GiB", "TiB"):
        if size < 1024 or unit == "TiB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024


def history_html(rows, now):
    by_hour = {parse_time(row["hour"]): row["state"] for row in rows}
    bars = []
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    for offset in range(29, -1, -1):
        day = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=offset)
        hours = [day + timedelta(hours=hour) for hour in range(24) if day + timedelta(hours=hour) <= current_hour]
        states = [by_hour.get(hour, "unknown") for hour in hours]
        state = worst(states)
        count = sum(hour in by_hour for hour in hours)
        title = f"{day:%d %b %Y}: {LABELS[state]} ({count}/{len(hours)} hours observed)"
        bars.append(f'<span class="history-day {state}" role="img" aria-label="{escape(title)}" title="{escape(title)}"></span>')
    return '<div class="history" aria-label="30 days of history">' + "".join(bars) + '</div><div class="history-scale"><span>29 days ago</span><span>Today · UTC</span></div>'


def overall(data, now):
    states = [row["state"] for row in data["systems"] + data["backups"]]
    if (any(state in ("down", "failed") for state in states)
            or any(parse_time(row["started"]) <= now and (not row.get("resolved") or parse_time(row["resolved"]) > now)
                   for row in data.get("incidents", []))):
        return "down", "Incident in progress"
    # "unknown" means no evidence for a tier (no reporter yet); it is shown as "No data" on the row
    # and must not turn the whole page amber. Only measured degradation or stale evidence does.
    if any(state in ("degraded", "stale") for state in states):
        return "degraded", "Degraded service or stale backup evidence"
    if "maintenance" in states or active_maintenance(data.get("maintenance", []), now):
        return "maintenance", "Maintenance in progress"
    if "unknown" in states:
        return "up", "All systems operational; some backup tiers have no data yet"
    return "up", "All systems operational"


def render(data, template):
    now = parse_time(data["generated_at"])
    overall_state, overall_label = overall(data, now)
    history = data.get("history", {})
    tiles = []
    for item in data["systems"]:
        tls = "No data" if item.get("tls_days") is None else f'{item["tls_days"]:.1f} days'
        tiles.append(f'''<article class="system-tile" aria-labelledby="{escape(item['id'])}-title">
          <div class="item-heading"><h3 id="{escape(item['id'])}-title">{escape(item['name'])}</h3>{badge(item['state'])}</div>
          <p class="checked">Last check {time_html(item.get('checked_at'))}</p>
          <p>{escape(item['measured'])}</p><p class="expectation">Expected: {escape(item['expected'])}</p>
          <p class="tls">TLS certificate: {tls} remaining</p>
          {history_html(history.get(item['id'], []), now)}</article>''')
    backup_rows = []
    for item in data["backups"]:
        backup_rows.append(f'''<article class="backup-row" aria-labelledby="{escape(item['id'])}-title">
          <div class="item-heading"><h3 id="{escape(item['id'])}-title">{escape(item['name'])}</h3>{badge(item['state'])}</div>
          <dl class="backup-facts"><div><dt>Last success / evidence</dt><dd>{time_html(item.get('last_success'))}</dd></div>
          <div><dt>Age at update</dt><dd>{age_text(item.get('age_minutes'))}</dd></div>
          <div><dt>Evidence size</dt><dd>{size_text(item.get('size_bytes'))}</dd></div></dl>
          <p class="backup-note">{escape(item.get('note', ''))}</p>
          {history_html(history.get(item['id'], []), now)}</article>''')
    notices = []
    for row in active_maintenance(data.get("maintenance", []), now):
        target = dict(SYSTEMS).get(row["id"], BACKUPS.get(row["id"], "All systems and backups"))
        notices.append(f'<aside class="maintenance-notice"><h2>Maintenance · {escape(target)}</h2><p>{escape(row["message"])}</p><p>{time_html(row["from"])} – {time_html(row["until"])}</p></aside>')
    incidents = []
    for row in sorted(data.get("incidents", []), key=lambda item: parse_time(item["started"]), reverse=True):
        resolution = "Ongoing" if not row.get("resolved") or parse_time(row["resolved"]) > now else "Resolved " + time_html(row["resolved"])
        incidents.append(f'<article class="incident"><h3>{escape(row["title"])}</h3><p>Started {time_html(row["started"])} · {resolution}</p><p>{escape(row["message"])}</p></article>')
    return Template(template).substitute(
        overall_state=overall_state, overall_label=overall_label, updated=time_html(data["generated_at"]),
        systems="\n".join(tiles), backups="\n".join(backup_rows), maintenance="\n".join(notices),
        incidents="\n".join(incidents) or '<p>No published incidents.</p>',
        sample_notice='<p class="sample-notice">Sample preview · fictional data, not live service status.</p>' if data.get("sample") else "",
    )


def sample_status():
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    systems = [{"id": item_id, "name": name, "state": "up", "measured": "HTTP 200; expected response",
                "expected": "Expected HTTPS response; TLS >= 14 days", "tls_days": 65,
                "checked_at": stamp(now)} for item_id, name in SYSTEMS]
    systems[-1].update(state="maintenance", measured="HTTP 302, Location=https://libi.aidecis.com/desk")
    backups = [empty_backup(item_id) for item_id in BACKUPS]
    for row in backups:
        row.update(last_success=stamp(now - timedelta(minutes=35)), age_minutes=35,
                   size_bytes=128 * 1024 * 1024, state="ok", note="Fictional preview evidence.")
    backups[1].update(last_success=None, age_minutes=None, size_bytes=None, state="unknown", note="No separate dump/base evidence available in this sample.")
    backups[-1].update(last_success=stamp(now - timedelta(hours=30)), age_minutes=1800, state="stale")
    history = {}
    for hour in range(719, -1, -1):
        when = now - timedelta(hours=hour)
        history = roll_history(history, systems + backups, when)
    return {"sample": True, "generated_at": stamp(now), "systems": systems, "backups": backups, "history": history,
            "maintenance": [{"id": "libi", "from": stamp(now - timedelta(minutes=10)),
                             "until": stamp(now + timedelta(minutes=50)), "message": "Scheduled preview maintenance."}],
            "incidents": [{"title": "Sample delayed archive", "started": stamp(now - timedelta(hours=3)),
                           "resolved": None, "message": "Fictional incident for previewing the page."}]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", action="store_true")
    parser.add_argument("--input", type=Path, default=ROOT / "status/status.json")
    parser.add_argument("--output", type=Path, default=ROOT / "status/index.html")
    args = parser.parse_args()
    data = sample_status() if args.sample else json.loads(args.input.read_text())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    html = render(data, (ROOT / "status/template.html").read_text())
    if args.sample:
        # Package local assets so both file:// previews and downloaded CI artifacts work.
        assets = args.output.parent.parent / "assets"
        assets.mkdir(parents=True, exist_ok=True)
        for name in ("styles.css", "status.css", "aidecis-logo.png"):
            source, target = ROOT / "assets" / name, assets / name
            if source.resolve() != target.resolve():
                shutil.copyfile(source, target)
        html = html.replace("https://aidecis.com/assets/", "../assets/")
    args.output.write_text(html)
    if args.sample:
        args.output.with_name("status.json").write_text(json.dumps(data, indent=2) + "\n")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
