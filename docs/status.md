# Public status page

`https://aidecis.com/status/` is a static page on the website's TransIP host. It shows **the public website only**. GitHub Actions measures `https://aidecis.com` from outside; nothing is installed on any server.

Internal systems (the app, demo, CRM, CSM, LIBI) and every backup tier are **not public**. They are monitored privately by the aidecis-app monitor workflow, which alerts the team. Nothing about them is checked, published or stored in this public repository: no host names, backup locations, sizes, Storage Box accounts or Mac/Internxt reports. `tests/test_status.py` fails if such names reappear in the status sources or output.

## Runs and publication

`.github/workflows/status.yml` runs at minutes 7, 22, 37 and 52 of every hour, on `workflow_dispatch`, and on pushes to `main` that change the status scripts, template, closed notice or the workflow. GitHub schedules can be delayed; this is a 15-minute target, not a real-time guarantee. The page refreshes every five minutes without JavaScript. Times are UTC.

Each run:

1. Runs the unit tests and downloads the previous `https://aidecis.com/status/status.json`. A 404 starts empty history. Other download errors or invalid JSON stop the run, preserving the published history.
2. Runs `scripts/status/check.py` (standard library only): probes the website, applies active maintenance and rolls up hourly history. History for anything other than the website is dropped.
3. Runs `scripts/status/render.py` with `status/template.html` and uploads a `status-page` Actions artifact containing `status/index.html` and `status/status.json`.
4. On `main` only, if TransIP is configured, uploads those two files over SFTP to `${TRANSIP_SFTP_PATH}/status/` (normally `www/status/`) and compares them with the public responses. Branch dispatches produce an artifact without publishing.

Generated HTML, status JSON and history are never committed. Runs share the `public-status` concurrency group with `cancel-in-progress: false`. The website publish workflow excludes `status/` from staging, upload and comparison, so the two workflows never overwrite each other's files.

## Public or closed

The page is published only when the repository variable `STATUS_PAGE_PUBLIC` is `true` (Settings, Secrets and variables, Actions, Variables). Otherwise every run on `main` replaces `www/status/index.html` with the short notice in `status/closed.html` (noindex), removes `www/status/status.json`, and verifies both.

## Configuration

Set these in **aidecistech/aidecis-website → Settings → Secrets and variables → Actions**.

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `TRANSIP_SFTP_KEY` | Dedicated private publish key, preferred; or use the password below. |
| Secret | `TRANSIP_SFTP_PASSWORD` | Alternative SFTP authentication. |
| Variable | `TRANSIP_SFTP_HOST` | TransIP SFTP host; absent means generate an artifact without uploading. |
| Variable | `TRANSIP_SFTP_USER` | TransIP SFTP user. |
| Variable | `TRANSIP_SFTP_PATH` | Website root, normally `www`; status is published in its `status/` child. |
| Variable | `TRANSIP_SFTP_KNOWN_HOSTS` | Verified, pinned OpenSSH host-key entry for TransIP. Required for publishing. |
| Variable | `STATUS_PAGE_PUBLIC` | `true` publishes the page; anything else serves the closed notice. |

No credentials belong in source files, notes or logs. The host key is pinned; the workflow never accepts a new server key automatically.

## What is checked

| System ID | URL | Accepted response |
| --- | --- | --- |
| `website` | `https://aidecis.com` | HTTP 200. |

The request does not follow redirects. TLS uses the default trust store and hostname verification. Any other response is **Down**. A valid certificate with less than 14 days remaining makes a healthy site **Degraded**; an untrusted, expired or unreachable TLS connection is **Down**. Query strings and exception details are never published.

The banner shows an incident for a down website or a started, unresolved incident; otherwise degraded, then maintenance, then **All systems operational**. With no measurement it shows **No data**, never operational.

## JSON contract

| Field | Shape |
| --- | --- |
| `generated_at` | ISO 8601 UTC timestamp for the check cycle. |
| `systems` | List of `{id, name, state, measured, expected, tls_days, checked_at}`. State is `up`, `degraded`, `down`, `maintenance` or `unknown`. TLS days can be null. Maintenance adds `measured_state`. |
| `history` | Object keyed by system ID. Each value is a sorted list of `{hour, state}`, with `hour` at the start of a UTC hour. |
| `maintenance` | List copied from `status/maintenance.json`. |
| `incidents` | List copied from `status/incidents.json`, which may be empty. |

History keeps at most 720 hourly buckets, including the current hour. The worst state in an hour survives later recovery. Severity order is `up`, `maintenance`, `unknown`, `degraded`, `down`. Missing hours are not backfilled. The page shows 30 UTC days, treating missing hours as no data. This is sampled history, not an uptime percentage.

## Maintenance and incidents

Edit the source JSON files through a pull request. Maintenance IDs are `website` or `all`; each window includes its start and excludes its end:

```json
[
  {
    "id": "website",
    "from": "2026-10-22T20:00:00Z",
    "until": "2026-10-22T21:00:00Z",
    "message": "Scheduled website maintenance."
  }
]
```

An incident has a title, start, optional resolution timestamp and public message. Set `resolved` to null while it is ongoing:

```json
[
  {
    "title": "Website unavailable",
    "started": "2026-10-22T19:30:00Z",
    "resolved": null,
    "message": "The website is not responding. We are investigating."
  }
]
```

These are examples, not reports of actual events. Keep the checked-in lists empty until a real notice is needed. Public notices describe the website only; never mention internal systems or backups.

## Preview and tests

```sh
python3 scripts/status/render.py --sample
open status/index.html
python3 -m unittest discover -s tests -v -b
ruby scripts/status/validate_workflows.rb
```

The sample is labelled fictional and writes ignored `status/index.html` and `status/status.json`. `--output /tmp/status-preview/status/index.html` writes a separate preview with copies of the site assets. `status-tests.yml` runs the unit tests, YAML parsing, `bash -n` on all workflow steps and the sample render on pull requests and pushes to main. Tests fake every HTTPS response and publishing command.

`scripts/status/monitor.py` is a small website-only probe (HTTPS status and TLS expiry). It is no longer a copy of the app monitor and needs no syncing.

## Adding status.aidecis.com

Neil must add the DNS record for `status.aidecis.com` in TransIP and a hosting alias that serves the website's `status/` folder over HTTPS (document root `www/status/` when the website root is `www`). The page uses absolute `https://aidecis.com/assets/` links and a relative `status.json` link, so no second publication is needed. Until then, use `aidecis.com/status/`.

## If the page is stale

Treat an update older than 45 minutes as out of date, even if the banner is green. Check **Actions → Update public status** for a failed, queued or missing run, read the failed step, fix the cause, then dispatch the workflow on `main` and confirm the public timestamp. Do not manufacture timestamps, copy sample data into production or delete history to make a run green.
