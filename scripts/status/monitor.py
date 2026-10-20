#!/usr/bin/env python3
"""Outside-in checks. Uptime and alerting use only the Python standard library."""

import fnmatch
import http.client
import json
import os
from pathlib import Path, PurePosixPath
import re
import socket
import ssl
import stat
import sys
import tempfile
import time
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen


TIMEOUT = 20
DAY = 86400
TARGETS = (
    ("https://demo.app.aidecis.com/api/health/ready", "ready"),
    ("https://app.aidecis.com", "demo"),
    ("https://aidecis.com", "website"),
    ("https://csm.aidecis.com", "signin"),
    ("https://crm.aidecis.com", "signin"),
    ("https://libi.aidecis.com", "signin"),
)
REDIRECTS = {301, 302, 303, 307, 308}


class Report:
    def __init__(self):
        self.failures = []

    def check(self, name, measured, expected, healthy):
        message = f"{name}: measured {measured}; expected {expected}"
        print(f"{'OK' if healthy else 'FAIL'}: {message}", flush=True)
        if not healthy:
            self.failures.append(message)


def http_probe(url):
    """GET without following redirects, so a redirect cannot hide a broken endpoint."""
    parsed = urlsplit(url)
    connection = http.client.HTTPSConnection(parsed.hostname, timeout=TIMEOUT)
    try:
        connection.request("GET", parsed.path or "/", headers={"User-Agent": "Aidecis-monitor/1"})
        response = connection.getresponse()
        body = response.read(65536)
        return response.status, response.getheader("Location", ""), body
    finally:
        connection.close()


def http_health(url, kind, status, location, body):
    if kind == "ready":
        try:
            data = json.loads(body)
        except (ValueError, UnicodeError):
            data = None
        healthy = (status == 200 and isinstance(data, dict)
                   and data.get("ok") is True and data.get("database") == "reachable")
        # Do not print arbitrary response bodies (they could contain credentials or tenant data).
        return healthy, f"HTTP {status}, healthy JSON={healthy}", 'HTTP 200, ok=true and database="reachable"'
    target = urlsplit(urljoin(url, location))
    secure = target.scheme == "https" and target.username is None and target.port in (None, 443)
    if kind == "demo":
        healthy = status in REDIRECTS and bool(location) and secure and target.hostname == "demo.app.aidecis.com"
        expected = "HTTP redirect to https://demo.app.aidecis.com"
    elif kind == "signin":
        signin = re.search(r"(?:^|/)(?:login|signin|sign-in)(?:/|$)", target.path, re.IGNORECASE)
        healthy = status == 200 or (status in REDIRECTS and bool(location) and secure
                                   and target.hostname == urlsplit(url).hostname and bool(signin))
        expected = "HTTP 200 or HTTPS sign-in redirect on the same host"
    else:
        healthy = status == 200
        expected = "HTTP 200"
    # Drop query strings, which can include auth tokens; Slack receives only status and destination.
    measured = f"HTTP {status}"
    if location:
        measured += f", Location={target.scheme}://{target.hostname}{target.path}"
    return healthy, measured, expected


def tls_expiry(host):
    context = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=TIMEOUT) as tcp:
        with context.wrap_socket(tcp, server_hostname=host) as tls:
            return ssl.cert_time_to_seconds(tls.getpeercert()["notAfter"])


def uptime(report):
    for url, kind in TARGETS:
        try:
            healthy, measured, expected = http_health(url, kind, *http_probe(url))
            report.check(url, measured, expected, healthy)
        except Exception as error:
            report.check(url, type(error).__name__, "successful HTTPS response with expected status/body", False)
        host = urlsplit(url).hostname
        try:
            days = (tls_expiry(host) - time.time()) / DAY
            report.check(f"TLS {host}", f"{days:.2f} days remaining", ">= 14 days, valid trusted certificate", days >= 14)
        except Exception as error:
            report.check(f"TLS {host}", type(error).__name__, ">= 14 days, valid trusted certificate", False)


def crm_paths(path):
    """Identify each visible CRM/CSM subtree; encrypted names cannot identify a service."""
    parts = PurePosixPath(path).parts
    return [str(PurePosixPath(*parts[:index + 1])) for index, part in enumerate(parts)
            if re.match(r"^(crm|csm)(?:$|[-_.])", part, re.IGNORECASE)]


def scan_backups(sftp):
    """Read metadata only; ignore symlinks, and fail on unreadable directories."""
    newest = {"any": None, "manifest": None}
    crm_newest = {}
    pending = ["."]
    while pending:
        folder = pending.pop()
        for entry in sftp.listdir_iter(folder):
            if entry.filename in (".", ".."):
                continue
            path = str(PurePosixPath(folder) / entry.filename)
            if stat.S_ISDIR(entry.st_mode):
                for service_path in crm_paths(path):
                    crm_newest.setdefault(service_path, None)
                pending.append(path)
            elif stat.S_ISREG(entry.st_mode):
                if entry.st_mtime is None:
                    raise ValueError("file has no modification time")
                for group, matches in (("any", True), ("manifest", fnmatch.fnmatchcase(entry.filename, "aidecis-*.sha256"))):
                    if matches and (newest[group] is None or entry.st_mtime > newest[group]):
                        newest[group] = entry.st_mtime
                for service_path in crm_paths(folder):
                    if crm_newest[service_path] is None or entry.st_mtime > crm_newest[service_path]:
                        crm_newest[service_path] = entry.st_mtime
    return newest, crm_newest


def freshness(report, name, mtime, limit, now):
    age = None if mtime is None else now - mtime
    measured = "no matching file" if age is None else f"{age / 3600:.2f} hours old"
    report.check(name, measured, f"age < {limit / 3600:g} hours (no future timestamp beyond 5 minutes)",
                 age is not None and -300 <= age < limit)


def check_backup_tree(report, user, sftp, now):
    newest, crm_newest = scan_backups(sftp)
    if user == "u690159-sub1":
        freshness(report, f"{user} newest aidecis-*.sha256", newest["manifest"], 26 * 3600, now)
    else:
        freshness(report, f"{user} newest file anywhere (WAL copy)", newest["any"], 3600, now)
        if crm_newest:
            for service_path, mtime in sorted(crm_newest.items()):
                freshness(report, f"{user} newest CRM/CSM file in {service_path}", mtime, 26 * 3600, now)
        else:
            note = "CRM/CSM freshness not checked separately: no readable CRM/CSM path; encrypted names cannot identify it."
            print(note, flush=True)
            if os.environ.get("GITHUB_STEP_SUMMARY"):
                with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
                    summary.write(note + "\n")


def backup(report):
    import paramiko  # Installed only in the backup job; uptime needs no third-party packages.

    if not os.environ.get("STORAGEBOX_KNOWN_HOSTS", "").strip():
        report.check("Storage Box host-key pin", "STORAGEBOX_KNOWN_HOSTS is absent", "verified known_hosts entries for both hosts on port 23", False)
        return
    with tempfile.TemporaryDirectory(prefix="monitor-sftp-") as directory:
        key = Path(directory) / "key"
        known_hosts = Path(directory) / "known_hosts"
        # Create the files with private permissions before writing the secret.
        for path, value in ((key, os.environ["STORAGEBOX_READONLY_KEY"]),
                            (known_hosts, os.environ["STORAGEBOX_KNOWN_HOSTS"])):
            with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as output:
                output.write(value.rstrip() + "\n")
        for user in ("u690159-sub1", "u690159-sub2"):
            try:
                with paramiko.SSHClient() as client:
                    client.load_host_keys(str(known_hosts))
                    client.set_missing_host_key_policy(paramiko.RejectPolicy())
                    client.connect(f"{user}.your-storagebox.de", port=23, username=user,
                                   key_filename=str(key), allow_agent=False, look_for_keys=False,
                                   timeout=TIMEOUT, banner_timeout=TIMEOUT, auth_timeout=TIMEOUT,
                                   channel_timeout=TIMEOUT)
                    with client.open_sftp() as sftp:
                        sftp.get_channel().settimeout(TIMEOUT)
                        check_backup_tree(report, user, sftp, time.time())
            except Exception as error:
                report.check(f"SFTP {user}", type(error).__name__, "pinned host key, key authentication and readable backup tree on port 23", False)


def alert(directory):
    failures = []
    for job, result in json.loads(os.environ["MONITOR_JOB_RESULTS"]).items():
        path = Path(directory) / f"{job}.json"
        details = []
        if path.exists():
            try:
                details = json.loads(path.read_text())["failures"]
            except (ValueError, KeyError):
                pass
        failures.extend(details)
        if result["result"] in ("failure", "cancelled") and not details:
            status = "cancelled" if result["result"] == "cancelled" else "failed"
            failures.append(f"{job}: measured {status} without a check report; expected successful check execution (see Actions logs)")
    if not failures:
        return 0
    webhook = os.environ.get("SLACK_ALERTS_WEBHOOK", "")
    if not webhook:
        print("SLACK_ALERTS_WEBHOOK is absent; failures remain visible in the red Actions run.")
        return 1
    text = "Aidecis monitoring failed\n" + "\n".join(f"• {item}" for item in failures)
    text += "\n" + os.environ["MONITOR_RUN_URL"]
    payload = json.dumps({"text": text, "unfurl_links": False, "unfurl_media": False}).encode()
    try:
        request = Request(webhook, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        # One attempt: retrying a POST after an ambiguous timeout could send duplicate alerts.
        with urlopen(request, timeout=TIMEOUT) as response:
            if response.status != 200 or response.read(100).strip() != b"ok":
                raise ValueError("Slack did not acknowledge the message")
    except Exception as error:
        # Exception strings can contain the webhook URL; never print them.
        print(f"Slack delivery failed ({type(error).__name__}); see the failed check jobs.")
        return 1
    return 0


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("uptime", "backup", "alert"):
        print("Usage: monitor.py {uptime|backup|alert} REPORT_PATH")
        return 2
    mode, path = sys.argv[1:]
    if mode == "alert":
        return alert(path)
    report = Report()
    try:
        {"uptime": uptime, "backup": backup}[mode](report)
    except Exception as error:
        report.check(mode, type(error).__name__, "successful check execution", False)
    Path(path).write_text(json.dumps({"failures": report.failures}) + "\n")
    return int(bool(report.failures))


if __name__ == "__main__":
    sys.exit(main())
