# Public status page

`https://aidecis.com/status/` is a static page on the website's TransIP host. GitHub Actions measures the public endpoints and read-only backup metadata. No monitored application server produces or hosts the page. This repository does not install anything on those servers.

## Runs and publication

`.github/workflows/status.yml` runs at minutes 7, 22, 37 and 52 of every hour, on pushes to `main` that change `status/reports/*.json`, on `workflow_dispatch`, and on payload-free `repository_dispatch` with event type `status-update`. GitHub schedules can be delayed; this is a 15-minute target, not a real-time guarantee. The page refreshes every five minutes without JavaScript. Times are UTC.

Each run:

1. Runs the unit tests and downloads the previous `https://aidecis.com/status/status.json`. A 404 starts empty history. Other download errors or invalid JSON stop the run, preserving the published history.
2. Creates a Python virtual environment with the pinned Paramiko dependency for SFTP. The HTTP checks, JSON handling and renderer use the standard library.
3. Runs `scripts/status/check.py`, reads every `status/reports/*.json` from the checkout, merges those reports with the previous public backup state (newest `reported_at` wins), applies freshness and active maintenance, and rolls up hourly history.
4. Runs `scripts/status/render.py` with `status/template.html` and uploads a `status-page` Actions artifact containing `status/index.html` and `status/status.json`.
5. On `main` only, if TransIP is configured, uploads those two generated files over SFTP to `${TRANSIP_SFTP_PATH}/status/` (normally `www/status/`) and compares them with the public responses. Branch dispatches produce an artifact without publishing.

Generated HTML, status JSON and history are never committed. External reporters each commit their own JSON report on `main`. Runs share the `public-status` concurrency group with `cancel-in-progress: false` to serialize the download/merge/publication of history. A later trigger can replace a pending run, but the reports persist in Git. Checkout reads the latest branch contents when the job starts, so a surviving run sees all committed reports even if its triggering commit was older. A report committed after checkout is picked up by a subsequent push, schedule or manual run.

The website workflow publishes the site's assets, including `assets/status.css`. Its SFTP mirror explicitly excludes `status/`, and its live comparison prunes that directory. Each report commit also triggers that website publish workflow, which leaves the public `status/` directory alone. It never stages or publishes `status/template.html`, `status/maintenance.json`, `status/incidents.json` or `status/reports/`; those are inputs to generation. Both workflows can run without overwriting each other's files.

## Configuration

Set these in **aidecistech/aidecis-website → Settings → Secrets and variables → Actions**. Names are shared with the existing publishing and app-monitor workflows, but values must exist in this repository too.

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `TRANSIP_SFTP_KEY` | Dedicated private publish key, preferred; or use the password below. |
| Secret | `TRANSIP_SFTP_PASSWORD` | Alternative SFTP authentication. |
| Variable | `TRANSIP_SFTP_HOST` | TransIP SFTP host; absent means generate an artifact without uploading. |
| Variable | `TRANSIP_SFTP_USER` | TransIP SFTP user. |
| Variable | `TRANSIP_SFTP_PATH` | Website root, normally `www`; status is published in its `status/` child. |
| Variable | `TRANSIP_SFTP_KNOWN_HOSTS` | Verified, pinned OpenSSH host-key entry for TransIP. Required for publishing. |
| Secret | `STORAGEBOX_READONLY_KEY` | Private SSH key without a passphrase, registered for both read-only Storage Box sub-accounts. Read-only access must be enforced by Storage Box. Never reuse a backup writer key. |
| Variable | `STORAGEBOX_KNOWN_HOSTS` | Verified OpenSSH host-key entries for `[u690159-sub1.your-storagebox.de]:23` and `[u690159-sub2.your-storagebox.de]:23`. |

No credentials belong in source files, public reports, notes or logs. SSH host keys are pinned; neither workflow accepts a new server key automatically. Missing either Storage Box input produces **No data** for its tiers without attempting a connection. Configured but failed connections produce **Failed**, with last known timestamps retained where available.

## What is checked

HTTP requests do not follow redirects. TLS uses the default trust store and hostname verification. A response outside the endpoint's rules is **Down**. A valid certificate with less than 14 days remaining makes an otherwise healthy system **Degraded**; an untrusted, expired or inaccessible TLS connection is **Down**.

| System ID | URL | Accepted response |
| --- | --- | --- |
| `demo` | `https://demo.app.aidecis.com/api/health/ready` | HTTP 200, JSON `ok: true` and `database: "reachable"`. |
| `app` | `https://app.aidecis.com` | HTTPS redirect to `demo.app.aidecis.com`. |
| `website` | `https://aidecis.com` | HTTP 200. |
| `csm` | `https://csm.aidecis.com` | HTTP 200 or same-host HTTPS sign-in redirect, including `/google-login.php`. |
| `crm` | `https://crm.aidecis.com` | HTTP 200 or same-host HTTPS sign-in redirect, including `/google-login.php`. |
| `libi` | `https://libi.aidecis.com` | HTTP 200 or same-host HTTPS sign-in redirect, including `/desk`. |

Redirects must use the standard HTTPS port and have no username. Arbitrary response bodies, query strings and exception details are not published. The readiness check exposes only whether the expected JSON was present.

Storage Box checks recursively list regular-file metadata over SFTP on port 23, ignore symlinks and fail on unreadable directories. They do not download, decrypt or restore backups. `last_success` for these checks means the modification time of the selected evidence file. Sizes describe that file, not the size of a complete backup set.

| Backup ID | Display name | Evidence and freshness rule |
| --- | --- | --- |
| `app-nightly` | App nightly | Newest `aidecis-*.sha256` under sub1, strictly under 26 hours. Size is the manifest size. |
| `libi-base` | LIBI dumps and base backups | **No data** until a separate, identifiable source is specified. The current app monitor has no distinct dump/base check; WAL freshness cannot establish it. |
| `libi-wal` | LIBI WAL | Newest regular file anywhere under sub2, strictly under 60 minutes, matching the app monitor's existing WAL-copy proxy. An unrelated fresh file can satisfy this proxy; it does not independently establish a complete WAL chain. |
| `crm-csm` | CRM/CSM | Every visible CRM/CSM subtree under sub2 must have evidence strictly under 26 hours. Display the worst subtree. No readable subtree means **No data**. |
| `mac-mirror` | Mac mirror | `status/reports/mac-mirror.json`; report older than 36 hours is stale; last success must be under `max_age_minutes`, default 26 hours. |
| `internxt-archive` | Internxt archive | `status/reports/internxt-archive.json`; report older than 36 hours is stale; last success must be under `max_age_minutes`, default 26 hours. |

CRM/CSM directory components match `crm`, `csm`, or those names followed by `-`, `_` or `.`, ignoring case. Empty subtrees fail independently. Encrypted names cannot identify a service. Missing matching evidence is **Failed**, evidence at or beyond the age limit is **Stale**, and a file dated more than five minutes in the future is **Failed**. The Mac's 26-hour default assumes a daily job; set the limit to match each actual schedule before relying on those tiers. An archive with a longer cadence must send its own success-age limit and refresh its report at least every 36 hours, retaining the actual last-success timestamp.

The overall banner shows an incident for a down system, failed backup or started unresolved incident. Otherwise degraded or stale evidence produces the degraded banner; active maintenance follows; then all operational, with a note when some backup tiers have no evidence yet ("No data" never counts as degraded).

## JSON contract

The generated `status/status.json` has these top-level fields:

| Field | Shape |
| --- | --- |
| `generated_at` | ISO 8601 UTC timestamp for the check cycle. |
| `systems` | List of `{id, name, state, measured, expected, tls_days, checked_at}`. State is `up`, `degraded`, `down`, `maintenance` or `unknown`. TLS days can be null. Maintenance adds `measured_state`. |
| `backups` | List of `{id, name, last_success, age_minutes, size_bytes, state, note}`. Unknown evidence uses null values. State is `ok`, `stale`, `failed` or `unknown`. Mac rows also carry `reported_at`, `reported_state` and `max_age_minutes`, so later runs can recompute freshness without losing the sender's result. |
| `history` | Object keyed by system or backup ID. Each value is a sorted list of `{hour, state}`, with `hour` at the start of a UTC hour. |
| `maintenance` | List copied from `status/maintenance.json`. |
| `incidents` | List copied from `status/incidents.json`, which may be empty. |

History retains at most 720 hourly buckets per item, including the current hour. The worst state observed in an hour survives later recovery. Severity order is `up/ok`, `maintenance`, `unknown`, `degraded/stale`, `down/failed`. Missing hours are not backfilled. The page shows 30 UTC calendar days, including today, and treats missing hours as unknown when choosing the daily worst state. A tooltip and accessible label give each day's date and hourly coverage. This is sampled history, not an uptime percentage or a claim of continuous observation.

## Maintenance and incidents

Edit the source JSON files through a pull request. Use known IDs from the tables above; `all` is also accepted for maintenance. Each maintenance window includes its start and excludes its end:

```json
[
  {
    "id": "libi",
    "from": "2026-10-22T20:00:00Z",
    "until": "2026-10-22T21:00:00Z",
    "message": "Scheduled LIBI maintenance."
  }
]
```

An incident has a title, start, optional resolution timestamp and public message. Set `resolved` to null while it is ongoing, then replace null with the resolution timestamp through another PR:

```json
[
  {
    "title": "Delayed backup copy",
    "started": "2026-10-22T19:30:00Z",
    "resolved": null,
    "message": "The off-site copy is delayed. We are checking the transfer."
  }
]
```

These are examples, not reports of actual events. Leave the checked-in lists empty until a real notice is needed. The next status run after merge picks up the edits; use **Actions → Update public status → Run workflow** on `main` for an earlier refresh.

## Sending a Mac report

The Mac's mirror and Internxt archive jobs each write a small JSON file through the GitHub contents API: `status/reports/mac-mirror.json` and `status/reports/internxt-archive.json`. Authenticate `gh` with a token allowed to commit directly to `main` in this repository (fine-grained repository **Contents: write**, subject to branch rules). The status workflow itself retains read-only repository permissions. Keep the token in the Mac's existing credential store.

After a successful mirror, use this command in a shell script. Replace the timestamps and size with the actual job result; these example values do not assert a real success. The report schema is unchanged: `id`, canonical `name` (optional on input), `last_success`, `reported_at`, `size_bytes`, `state`, `note`, and optional `max_age_minutes`. The producer derives `age_minutes` from `last_success`; do not refresh evidence by changing that success timestamp.

```sh
set -eu
reporter_id=mac-mirror
report_file=$(mktemp)
cat > "$report_file" <<'JSON'
{
  "id": "mac-mirror",
  "name": "Mac mirror",
  "state": "ok",
  "last_success": "2026-10-20T10:00:00Z",
  "reported_at": "2026-10-20T10:01:00Z",
  "size_bytes": 123456789,
  "note": "Mirror completed."
}
JSON

# The reports directory exists in main, including before the first report.
# Read the current file's blob SHA from main. No match means first creation;
# authentication/network errors fail the script rather than implying no file.
report_sha=$(gh api --method GET \
  repos/aidecistech/aidecis-website/contents/status/reports \
  -f ref=main --jq ".[] | select(.name == \"${reporter_id}.json\") | .sha")

# Exactly one PUT creates one report commit on main. Omit sha for creation;
# for updates, sha must be the existing file's blob SHA, not a commit SHA.
set -- --method PUT \
  "repos/aidecistech/aidecis-website/contents/status/reports/$reporter_id.json" \
  -f branch=main \
  -f "message=Update $reporter_id status report" \
  -f "content=$(base64 < "$report_file" | tr -d '\n')"
if [ -n "$report_sha" ]; then
  set -- "$@" -f "sha=$report_sha"
fi
gh api "$@"
rm -f "$report_file"
```

For Internxt, set `reporter_id=internxt-archive` and use `id: "internxt-archive"`, `name: "Internxt archive"`, and that job's actual result. The filename must match `id`. Never submit report data in a dispatch payload. Use timezone-aware timestamps; UTC with `Z` is preferred. `reported_at` is when the source measured the result, unchanged on transport retries. Sizes are bytes or null; public notes are limited to 500 characters and must omit local paths, credentials and customer data.

The directory lookup obtains the current SHA for either creation or update without suppressing API errors. Serialize writes from the two Mac jobs; a concurrent commit can cause a conflict. On a 409 or SHA conflict, fetch the latest file and SHA before retrying the same report. If the stored `reported_at` is equal or newer, skip the retry; never overwrite a newer report with an older result. Keep the local report until its commit succeeds. GitHub's [contents API documentation](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents) describes the base64 content and update SHA fields.

`max_age_minutes` controls last-success freshness (integer minutes from 1 to 527040; default 1560). Include the same limit in failure reports. Report freshness has a separate fixed limit: any report older than 36 hours marks its tier **Stale**, including an old failure or unknown result, even when the success-age allowance is longer. Jobs with a long backup cadence must still write a current measurement at least every 36 hours, preserving the real `last_success`.

On failure, write `state: "failed"`, the failure's `reported_at`, `last_success: null`, `size_bytes: null` and a short public note. The merge retains the previous public success and size if available. `ok` requires a non-null last success. Only the two Mac IDs accept external reports; reports cannot overwrite probed services or Storage Box evidence. Newer reports win against the previous public state; equal timestamps are ignored. Reports more than five minutes in the future are rejected. Missing reports preserve previous public evidence and still age it. Malformed JSON, a mismatched filename/ID or an invalid report stops publication, preserving the published state.

A successful contents API response means the report was committed, not that the page was published. The report push triggers the status workflow and the website publish workflow; the latter excludes `status/` from staging, upload and comparison. Check **Actions → Update public status** and the public timestamp for publication.

For an immediate refresh of already committed reports, the existing `repository_dispatch` event remains a trigger only. It carries no `client_payload`, and any payload sent by an old reporter is ignored:

```sh
gh api --method POST repos/aidecistech/aidecis-website/dispatches \
  -f event_type=status-update
```

The workflow must exist on the default branch for this trigger. A dispatch is optional after a report commit because its push already triggers a run. Scheduled and manual runs use the same files.

## Preview and tests

```sh
python3 scripts/status/render.py --sample
open status/index.html
python3 -m unittest discover -s tests -v -b
ruby scripts/status/validate_workflows.rb
```

The sample is labelled fictional. It writes ignored `status/index.html` and `status/status.json`. `--output /tmp/status-preview/status/index.html` writes a separate preview, including copies of the required site assets in `/tmp/status-preview/assets/`. For real saved data, use `python3 scripts/status/render.py --input /path/to/status.json --output /tmp/status.html`.

`status-tests.yml` runs deterministic unit tests, YAML parsing, `bash -n` on all workflow run steps, and sample rendering on pull requests and pushes to main. It uploads a `status-preview` artifact. Tests fake all monitored HTTPS/SFTP responses and publishing commands; they do not contact monitored servers or TransIP. The publishing regression test runs the actual collect and live-check Bash against a fake site containing independently generated status files, and checks that ordinary content mismatches still fail.

### Keeping the app monitor in sync

`scripts/status/monitor.py` is a verbatim copy of `aidecistech/aidecis-app`'s `scripts/monitor.py` at file revision `b3b39c287e02f8bef104b7cae4705463770e03d9`. `tests/test_monitor.py` is its companion test file with only the import path changed. No cross-repository import is used.

When the app monitor changes, copy both files again, adjust the test import path to `scripts/status/monitor.py`, review the status adapter, run the tests above and update this revision. `check.py` delegates HTTPS probes, TLS, backup traversal, pinned SFTP setup and authentication to the copy. Its explicit redirect additions accept the deployed `/google-login.php` and `/desk` destinations. Its backup adapter records size metadata and translates checks into public states rather than Slack alerts. No Slack webhook is used by status runs. The default status command publishes failures as data and exits successfully; generation, configuration or publishing errors fail the workflow.

## Adding status.aidecis.com

Neil must add the DNS record for `status.aidecis.com` in TransIP and a hosting alias that serves the same website `status/` folder, including HTTPS for that name. The alias's document root should be `www/status/` when the website root is `www`. Confirm the exact DNS target and alias controls in the hosting account; this change supplies no DNS values and makes no hosting changes.

The page uses absolute `https://aidecis.com/assets/` links for the shared logo and styles, and a relative `status.json` link. Serving the same status folder at the subdomain root therefore requires no second publication. Verify both `/` and `/status.json` on the alias once Neil has configured it. Until then, use `aidecis.com/status/`.

## If the page is stale

Treat an update older than 45 minutes as out of date, even if the last banner is green. Static hosting cannot change the displayed state when its producer stops; the page states this explicitly. Check **Actions → Update public status** for a failed, queued or missing run. Then:

1. Read the failed step. A previous-state download failure stops publication to avoid discarding history; resolve the HTTP/JSON problem first. A first-time non-404 fallback page also needs correction rather than an empty reset.
2. Check Actions scheduling, repository settings and the pinned host-key/authentication configuration for the affected service. A red SFTP publish or verification step may mean the artifact exists while the public page is older.
3. Download the `status-page` artifact if generation succeeded. It contains only the two generated public files. Inspect its timestamps and notes without changing servers.
4. After fixing the cause, dispatch the workflow on `main`, confirm it is green and check the public timestamp and JSON. If the page or website host itself is unreachable, use GitHub Actions and the app monitoring runbook as the independent evidence.

Do not manufacture fresh timestamps, copy sample data into production or delete history to make a failing run green. A failed check of an application is normally represented in the page; a failed workflow means the page producer or publisher needs attention.
