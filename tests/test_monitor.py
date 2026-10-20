"""Deterministic monitoring tests: no service connections or real Slack messages."""

import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch


SPEC = importlib.util.spec_from_file_location("monitor", Path(__file__).resolve().parents[1] / "scripts/status/monitor.py")
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


def entry(name, mtime=0, mode=stat.S_IFREG):
    return SimpleNamespace(filename=name, st_mtime=mtime, st_mode=mode)


class Tree:
    def __init__(self, folders):
        self.folders = folders

    def listdir_iter(self, folder):
        return iter(self.folders[folder])


class HttpTests(unittest.TestCase):
    def check(self, kind, status=200, location="", body=b"", host=None):
        host = host or ("app.aidecis.com" if kind == "demo" else "demo.app.aidecis.com")
        return monitor.http_health(f"https://{host}", kind, status, location, body)[0]

    def test_readiness_requires_status_and_exact_health_fields(self):
        healthy = b'{"ok":true,"database":"reachable"}'
        self.assertTrue(self.check("ready", body=healthy))
        for status, body in ((503, healthy), (200, b'{"ok":false}'), (200, b'{"ok":"true","database":"reachable"}'),
                             (200, b'{"ok":true}'), (200, b"<html>error</html>"), (200, b"[]"), (302, healthy)):
            with self.subTest(status=status, body=body):
                self.assertFalse(self.check("ready", status, body=body))

    def test_app_requires_redirect_to_demo_over_https(self):
        self.assertTrue(self.check("demo", 302, "https://demo.app.aidecis.com/"))
        for location in ("https://example.com", "http://demo.app.aidecis.com", "/login", "https://demo.app.aidecis.com:444"):
            self.assertFalse(self.check("demo", 302, location))
        self.assertFalse(self.check("demo", 200))

    def test_tools_accept_200_or_signin_redirect_but_reject_other_redirects(self):
        self.assertTrue(self.check("signin"))
        for location in ("/login", "/auth/sign-in?callbackUrl=/", "/api/auth/signin", "/signin/"):
            for status in (302, 303, 307):
                self.assertTrue(self.check("signin", status, location))
        for location in ("", "/maintenance", "https://example.com/login", "http://demo.app.aidecis.com/login"):
            self.assertFalse(self.check("signin", 302, location))
        self.assertFalse(self.check("signin", 503))
        self.assertFalse(self.check("website", 302, "/login"))

    def test_all_hosts_and_tls_are_checked_after_network_failures(self):
        report = monitor.Report()
        with patch.object(monitor, "http_probe", side_effect=TimeoutError), patch.object(monitor, "tls_expiry", side_effect=OSError):
            monitor.uptime(report)
        self.assertEqual(len(report.failures), 12)

    def test_tls_warns_strictly_below_fourteen_days(self):
        with patch.object(monitor, "time") as clock, patch.object(monitor, "http_probe", return_value=(200, "", b"")), \
                patch.object(monitor, "tls_expiry", side_effect=[100 + days * monitor.DAY for days in (14, 13.99, 0, 90, 20, 20)]):
            clock.time.return_value = 100
            report = monitor.Report()
            monitor.uptime(report)
        failures = [message for message in report.failures if message.startswith("TLS")]
        self.assertEqual(len(failures), 2)
        self.assertIn("13.99 days", failures[0])


class BackupTests(unittest.TestCase):
    def test_manifest_search_is_recursive_and_ignores_fresh_nonmatching_files(self):
        tree = Tree({".": [entry("backups", mode=stat.S_IFDIR), entry("fresh.age", 10000), entry("link", mode=stat.S_IFLNK)],
                     "backups": [entry("aidecis-20261019.sha256", 1), entry("aidecis-20261020.sha256", 100)]})
        newest, crm_newest = monitor.scan_backups(tree)
        self.assertEqual(newest, {"any": 10000, "manifest": 100})
        self.assertEqual(crm_newest, {})

    def test_freshness_boundaries_empty_and_future_files(self):
        for limit in (3600, 26 * 3600):
            for age, healthy in ((limit - 1, True), (limit, False), (limit + 1, False), (-301, False), (0, True)):
                report = monitor.Report()
                monitor.freshness(report, "test", 200000 - age, limit, 200000)
                self.assertEqual(not report.failures, healthy)
        report = monitor.Report()
        monitor.freshness(report, "empty", None, 3600, 0)
        self.assertIn("no matching file", report.failures[0])

    def test_stale_crm_is_not_hidden_by_fresh_wal(self):
        tree = Tree({".": [entry("crm", mode=stat.S_IFDIR), entry("libi", mode=stat.S_IFDIR)],
                     "crm": [entry("encrypted-name", 1)], "libi": [entry("encrypted-wal", 200000)]})
        report = monitor.Report()
        monitor.check_backup_tree(report, "u690159-sub2", tree, 200000)
        self.assertEqual(len(report.failures), 1)
        self.assertIn("CRM/CSM", report.failures[0])

    def test_empty_visible_crm_directory_alerts(self):
        tree = Tree({".": [entry("CRM-backups", mode=stat.S_IFDIR), entry("wal", 200000)], "CRM-backups": []})
        report = monitor.Report()
        monitor.check_backup_tree(report, "u690159-sub2", tree, 200000)
        self.assertIn("no matching file", report.failures[0])

    def test_each_visible_service_tree_must_be_fresh(self):
        for fresh, other in (("crm", "csm"), ("csm", "crm"), ("CRM-backups", "CSM_snapshots"),
                             ("crm-primary", "crm-secondary")):
            for files in ([], [entry("old-backup", 1)]):
                with self.subTest(fresh=fresh, other=other, files=files):
                    tree = Tree({".": [entry(fresh, mode=stat.S_IFDIR), entry(other, mode=stat.S_IFDIR)],
                                 fresh: [entry("daily", mode=stat.S_IFDIR)],
                                 f"{fresh}/daily": [entry("fresh-backup", 200000)], other: files})
                    report = monitor.Report()
                    monitor.check_backup_tree(report, "u690159-sub2", tree, 200000)
                    self.assertEqual(len(report.failures), 1)
                    self.assertIn(f"CRM/CSM file in {other}:", report.failures[0])
                    self.assertIn("55.56 hours old" if files else "no matching file", report.failures[0])

    def test_same_service_name_under_different_parents_is_checked_separately(self):
        tree = Tree({".": [entry("host-a", mode=stat.S_IFDIR), entry("host-b", mode=stat.S_IFDIR)],
                     "host-a": [entry("crm", mode=stat.S_IFDIR)], "host-a/crm": [entry("fresh", 200000)],
                     "host-b": [entry("crm", mode=stat.S_IFDIR)], "host-b/crm": []})
        report = monitor.Report()
        monitor.check_backup_tree(report, "u690159-sub2", tree, 200000)
        self.assertEqual(len(report.failures), 1)
        self.assertIn("CRM/CSM file in host-b/crm:", report.failures[0])

    def test_all_visible_service_trees_fresh_passes(self):
        tree = Tree({".": [entry("crm", mode=stat.S_IFDIR), entry("csm", mode=stat.S_IFDIR)],
                     "crm": [entry("fresh", 200000)], "csm": [entry("fresh", 199000)]})
        report = monitor.Report()
        monitor.check_backup_tree(report, "u690159-sub2", tree, 200000)
        self.assertFalse(report.failures)

    def test_crm_backup_filenames_use_only_matching_ancestor_directories(self):
        for folder in ("backups", "crm"):
            with self.subTest(folder=folder):
                tree = Tree({".": [entry(folder, mode=stat.S_IFDIR)],
                             folder: [entry("crm-20261019.age", 1), entry("crm-20261020.age", 200000)]})
                newest, crm_newest = monitor.scan_backups(tree)
                self.assertEqual(newest["any"], 200000)
                self.assertEqual(crm_newest, {"crm": 200000} if folder == "crm" else {})
                report = monitor.Report()
                monitor.check_backup_tree(report, "u690159-sub2", tree, 200000)
                self.assertFalse(report.failures)

    def test_encrypted_paths_document_uncheckable_crm(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(Path(folder) / "summary")}):
            report = monitor.Report()
            monitor.check_backup_tree(report, "u690159-sub2", Tree({".": [entry("encrypted", 200000)]}), 200000)
            self.assertFalse(report.failures)
            self.assertIn("not checked separately", (Path(folder) / "summary").read_text())

    def test_directory_errors_are_not_silently_ignored(self):
        tree = Tree({".": [entry("inaccessible", mode=stat.S_IFDIR)]})
        with self.assertRaises(KeyError):
            monitor.scan_backups(tree)

    def test_sftp_uses_both_pinned_hosts_no_agent_and_private_temporary_files(self):
        paramiko = MagicMock()
        client = paramiko.SSHClient.return_value.__enter__.return_value
        key_paths = []

        def connected(host, **kwargs):
            self.assertIn(host, ("u690159-sub1.your-storagebox.de", "u690159-sub2.your-storagebox.de"))
            self.assertEqual(kwargs["port"], 23)
            self.assertFalse(kwargs["allow_agent"])
            self.assertFalse(kwargs["look_for_keys"])
            key_path = Path(kwargs["key_filename"])
            key_paths.append(key_path)
            self.assertEqual(stat.S_IMODE(key_path.stat().st_mode), 0o600)
            self.assertEqual(key_path.read_text(), "test-key\n")

        client.connect.side_effect = connected
        with patch.dict("sys.modules", {"paramiko": paramiko}), \
                patch.dict(os.environ, {"STORAGEBOX_READONLY_KEY": "test-key", "STORAGEBOX_KNOWN_HOSTS": "test-pin"}), \
                patch.object(monitor, "check_backup_tree") as check:
            monitor.backup(monitor.Report())
        self.assertEqual(client.connect.call_count, 2)
        self.assertEqual(client.load_host_keys.call_count, 2)
        self.assertEqual(client.set_missing_host_key_policy.call_args.args, (paramiko.RejectPolicy.return_value,))
        self.assertEqual(check.call_count, 2)
        self.assertTrue(all(not path.exists() for path in key_paths))
        client.exec_command.assert_not_called()

    def test_missing_host_pin_fails_before_connecting(self):
        paramiko = MagicMock()
        report = monitor.Report()
        with patch.dict("sys.modules", {"paramiko": paramiko}), patch.dict(os.environ, {"STORAGEBOX_KNOWN_HOSTS": ""}):
            monitor.backup(report)
        self.assertEqual(len(report.failures), 1)
        paramiko.SSHClient.assert_not_called()


class AlertTests(unittest.TestCase):
    def send(self, reports, jobs, webhook="https://example.invalid/test"):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
                "MONITOR_JOB_RESULTS": json.dumps({job: {"result": result} for job, result in jobs.items()}),
                "MONITOR_RUN_URL": "https://github.com/test/actions/runs/1", "SLACK_ALERTS_WEBHOOK": webhook}), \
                patch.object(monitor, "urlopen") as post:
            for job, failures in reports.items():
                (Path(folder) / f"{job}.json").write_text(json.dumps({"failures": failures}))
            post.return_value.__enter__.return_value.status = 200
            post.return_value.__enter__.return_value.read.return_value = b"ok"
            status = monitor.alert(folder)
            return status, post

    def test_healthy_and_skipped_jobs_send_nothing(self):
        status, post = self.send({"uptime": []}, {"uptime": "success", "backup": "skipped"})
        self.assertEqual(status, 0)
        post.assert_not_called()

    def test_multiple_check_failures_send_exactly_one_message(self):
        status, post = self.send({"uptime": ["HTTP measured 503; expected 200"], "backup": ["age measured 27h; expected <26h"]},
                                 {"uptime": "failure", "backup": "failure"})
        self.assertEqual(status, 0)
        post.assert_called_once()
        payload = json.loads(post.call_args.args[0].data)
        self.assertIn("503", payload["text"])
        self.assertIn("27h", payload["text"])
        self.assertIn("actions/runs/1", payload["text"])

    def test_failed_job_without_artifact_still_alerts(self):
        status, post = self.send({}, {"backup": "failure"})
        self.assertEqual(status, 0)
        self.assertIn("failed without a check report", json.loads(post.call_args.args[0].data)["text"])

    def test_cancelled_job_with_missing_or_empty_report_still_alerts(self):
        for job in ("uptime", "backup", "backup-config"):
            for reports in ({}, {job: []}):
                with self.subTest(job=job, reports=reports):
                    status, post = self.send(reports, {job: "cancelled"})
                    self.assertEqual(status, 0)
                    post.assert_called_once()
                    message = json.loads(post.call_args.args[0].data)["text"]
                    self.assertIn(f"{job}: measured cancelled without a check report", message)
                    self.assertIn("actions/runs/1", message)

    def test_cancelled_job_with_failures_uses_report(self):
        detail = "age measured 27h; expected <26h"
        status, post = self.send({"backup": [detail]}, {"backup": "cancelled"})
        self.assertEqual(status, 0)
        post.assert_called_once()
        message = json.loads(post.call_args.args[0].data)["text"]
        self.assertEqual(message.count(detail), 1)
        self.assertNotIn("without a check report", message)

    def test_absent_webhook_does_not_mask_failure(self):
        status, post = self.send({}, {"uptime": "failure"}, webhook="")
        self.assertEqual(status, 1)
        post.assert_not_called()

    def test_slack_failure_is_not_retried(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
                "MONITOR_JOB_RESULTS": '{"uptime":{"result":"failure"}}',
                "MONITOR_RUN_URL": "test-run", "SLACK_ALERTS_WEBHOOK": "https://example.invalid/test"}), \
                patch.object(monitor, "urlopen", side_effect=TimeoutError) as post:
            self.assertEqual(monitor.alert(folder), 1)
        post.assert_called_once()

    def test_invalid_webhook_never_prints_its_value(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
                "MONITOR_JOB_RESULTS": '{"uptime":{"result":"failure"}}',
                "MONITOR_RUN_URL": "test-run", "SLACK_ALERTS_WEBHOOK": "invalid-private-webhook"}), \
                patch("builtins.print") as output:
            self.assertEqual(monitor.alert(folder), 1)
            self.assertNotIn("invalid-private-webhook", str(output.call_args_list))


class CommandTests(unittest.TestCase):
    def test_uptime_command_is_green_without_secrets_for_healthy_services(self):
        def response(url):
            if "health/ready" in url:
                return 200, "", b'{"ok":true,"database":"reachable"}'
            if url == "https://app.aidecis.com":
                return 302, "https://demo.app.aidecis.com/", b""
            return 200, "", b""

        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {}, clear=True), \
                patch.object(monitor, "http_probe", side_effect=response) as probe, \
                patch.object(monitor, "tls_expiry", return_value=monitor.time.time() + 90 * monitor.DAY):
            path = Path(folder) / "uptime.json"
            with patch("sys.argv", ["monitor.py", "uptime", str(path)]):
                self.assertEqual(monitor.main(), 0)
            self.assertEqual(json.loads(path.read_text()), {"failures": []})
            self.assertEqual(probe.call_count, 6)

    def test_failed_command_writes_report_and_returns_nonzero(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(monitor, "uptime", side_effect=RuntimeError):
            path = Path(folder) / "uptime.json"
            with patch("sys.argv", ["monitor.py", "uptime", str(path)]):
                self.assertEqual(monitor.main(), 1)
            self.assertIn("RuntimeError", json.loads(path.read_text())["failures"][0])


if __name__ == "__main__":
    unittest.main()
