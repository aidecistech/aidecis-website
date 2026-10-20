"""Deterministic public-status tests. All HTTPS/SFTP responses are fake."""

from datetime import datetime, timedelta
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/status"))
import check
import render

NOW = datetime(2026, 10, 20, 12, 20, tzinfo=check.UTC)


def entry(name, age=0, mode=stat.S_IFREG, size=123):
    return SimpleNamespace(filename=name, st_mtime=NOW.timestamp() - age * 60, st_mode=mode, st_size=size)


class Tree:
    def __init__(self, folders):
        self.folders = folders

    def listdir_iter(self, folder):
        return iter(self.folders[folder])


def external(item_id="mac-mirror", **changes):
    result = {"id": item_id, "state": "ok", "last_success": check.stamp(NOW - timedelta(minutes=30)),
              "reported_at": check.stamp(NOW), "size_bytes": 1234, "note": "Completed."}
    result.update(changes)
    return result


class SystemTests(unittest.TestCase):
    def test_real_redirects_only_allow_expected_secure_destination(self):
        for host, path in (("crm", "/google-login.php"), ("csm", "/google-login.php"), ("libi", "/desk")):
            url = f"https://{host}.aidecis.com"
            for location in (path, url + path + "?token=secret"):
                healthy, measured, _ = check.http_health(url, "signin", 302, location, b"")
                self.assertTrue(healthy)
                self.assertNotIn("secret", measured)
            for location in ("https://evil.example" + path, "http://" + host + ".aidecis.com" + path,
                             "https://user@" + host + ".aidecis.com" + path, url + ":444" + path,
                             path + "/unexpected", "/maintenance", "//evil.example" + path):
                self.assertFalse(check.http_health(url, "signin", 302, location, b"")[0], location)

    def test_fake_https_and_tls_produce_all_systems(self):
        responses = [(200, "", b'{"ok":true,"database":"reachable"}'),
                     (302, "https://demo.app.aidecis.com/", b""), (200, "", b""),
                     (302, "/google-login.php", b""), (302, "/google-login.php", b""), (302, "/desk", b"")]
        with patch.object(check.monitor, "http_probe", side_effect=responses) as probe, \
                patch.object(check.monitor, "tls_expiry", return_value=NOW.timestamp() + 30 * 86400):
            rows = check.check_systems(NOW)
        self.assertEqual([row["state"] for row in rows], ["up"] * 6)
        self.assertEqual(probe.call_count, 6)
        self.assertEqual(rows[0]["tls_days"], 30)
        self.assertEqual(rows[0]["checked_at"], check.stamp(NOW))

    def test_network_failures_do_not_stop_other_checks_or_expose_exception_text(self):
        with patch.object(check.monitor, "http_probe", side_effect=TimeoutError("secret")), \
                patch.object(check.monitor, "tls_expiry", side_effect=OSError("secret")) as tls:
            rows = check.check_systems(NOW)
        self.assertEqual(tls.call_count, 6)
        self.assertTrue(all(row["state"] == "down" for row in rows))
        self.assertNotIn("secret", json.dumps(rows))

    def test_tls_warning_and_exact_boundary(self):
        with patch.object(check.monitor, "http_probe", return_value=(200, "", b"")), \
                patch.object(check.monitor, "tls_expiry", side_effect=[NOW.timestamp() + days * 86400 for days in (30, 30, 14, 13.99, 0, 30)]):
            rows = check.check_systems(NOW)
        self.assertEqual(rows[2]["state"], "up")
        self.assertEqual(rows[3]["state"], "degraded")
        self.assertEqual(rows[4]["state"], "degraded")


class BackupTests(unittest.TestCase):
    def test_manifest_not_fresh_unrelated_file(self):
        tree = Tree({".": [entry("backup", mode=stat.S_IFDIR), entry("other", age=0)],
                     "backup": [entry("aidecis-old.sha256", age=1560), entry("symlink", mode=stat.S_IFLNK)]})
        row = check.backup_snapshot(tree, "u690159-sub1", NOW)["app-nightly"]
        self.assertEqual(row["state"], "stale")
        self.assertEqual(row["age_minutes"], 1560)
        self.assertEqual(row["size_bytes"], 123)

    def test_wal_newest_file_and_each_crm_subtree_independently(self):
        tree = Tree({".": [entry("wal", age=1), entry("crm", mode=stat.S_IFDIR), entry("CSM-snapshots", mode=stat.S_IFDIR)],
                     "crm": [entry("fresh", age=2)], "CSM-snapshots": [entry("old", age=1600, size=456)]})
        rows = check.backup_snapshot(tree, "u690159-sub2", NOW)
        self.assertEqual(rows["libi-wal"]["state"], "ok")
        self.assertEqual(rows["crm-csm"]["state"], "stale")
        self.assertEqual(rows["crm-csm"]["size_bytes"], 456)

    def test_empty_crm_fails_and_encrypted_only_is_unknown(self):
        tree = Tree({".": [entry("wal"), entry("crm", mode=stat.S_IFDIR)], "crm": []})
        self.assertEqual(check.backup_snapshot(tree, "u690159-sub2", NOW)["crm-csm"]["state"], "failed")
        rows = check.backup_snapshot(Tree({".": [entry("encrypted")]}), "u690159-sub2", NOW)
        self.assertEqual(rows["crm-csm"]["state"], "unknown")

    def test_future_crm_subtree_cannot_be_hidden_by_another_healthy_subtree(self):
        tree = Tree({".": [entry("crm", mode=stat.S_IFDIR), entry("csm", mode=stat.S_IFDIR)],
                     "crm": [entry("future", age=-6)], "csm": [entry("healthy", age=2)]})
        row = check.backup_snapshot(tree, "u690159-sub2", NOW)["crm-csm"]
        self.assertEqual(row["state"], "failed")
        self.assertIn("future", row["note"])

    def test_unreadable_tree_does_not_silently_pass(self):
        tree = MagicMock()
        tree.listdir_iter.side_effect = PermissionError
        with self.assertRaises(PermissionError):
            check.backup_snapshot(tree, "u690159-sub2", NOW)

    def test_freshness_boundaries_and_clock_skew(self):
        for limit in (60, 1560):
            for age, state in ((limit - .01, "ok"), (limit, "stale"), (-5, "ok"), (-5.01, "failed")):
                row = check.evidence("app-nightly", NOW.timestamp() - age * 60, 10, limit, NOW, "Evidence.")
                self.assertEqual(row["state"], state)
        self.assertEqual(check.evidence("app-nightly", None, None, 60, NOW, "Evidence.")["state"], "failed")

    def test_missing_credentials_never_connect_and_keep_external_evidence(self):
        for key, pin in (("", ""), ("key", ""), ("", "pin")):
            with patch.dict(os.environ, {"STORAGEBOX_READONLY_KEY": key, "STORAGEBOX_KNOWN_HOSTS": pin}), \
                    patch.object(check.monitor, "backup") as connect:
                rows = check.check_backups({"backups": [check.validate_external(external(), NOW)]}, NOW)
            connect.assert_not_called()
            self.assertEqual(len(rows), 6)
            self.assertEqual(next(row for row in rows if row["id"] == "mac-mirror")["state"], "ok")
            self.assertTrue(all(row["state"] == "unknown" for row in rows if row["id"] not in check.EXTERNAL))

    def test_pinned_readonly_sftp_checks_and_failure_retains_evidence(self):
        paramiko = MagicMock()
        client = paramiko.SSHClient.return_value.__enter__.return_value
        tree = Tree({".": [entry("aidecis-today.sha256", age=10)]})
        client.open_sftp.return_value.__enter__.return_value.listdir_iter.side_effect = tree.listdir_iter
        client.connect.side_effect = [None, TimeoutError("private connection data")]
        old = check.evidence("libi-wal", NOW.timestamp() - 120, 17, 60, NOW, "Old evidence")
        with patch.dict(sys.modules, {"paramiko": paramiko}), patch.dict(os.environ, {
                "STORAGEBOX_READONLY_KEY": "fake-key", "STORAGEBOX_KNOWN_HOSTS": "fake-pin"}):
            rows = {row["id"]: row for row in check.check_backups({"backups": [old]}, NOW)}
        self.assertEqual(rows["app-nightly"]["state"], "ok")
        self.assertEqual(rows["libi-wal"]["state"], "failed")
        self.assertEqual(rows["libi-wal"]["last_success"], old["last_success"])
        self.assertNotIn("private connection data", json.dumps(rows))
        self.assertEqual(client.connect.call_count, 2)
        options = client.connect.call_args.kwargs
        self.assertEqual(options["port"], 23)
        self.assertFalse(options["allow_agent"])
        self.assertFalse(options["look_for_keys"])
        client.set_missing_host_key_policy.assert_called_with(paramiko.RejectPolicy.return_value)


class ExternalTests(unittest.TestCase):
    def test_reports_age_even_when_the_mac_stops_sending(self):
        row = check.validate_external(external(), NOW)
        self.assertEqual(row["state"], "ok")
        later = check.refresh_external(row, NOW + timedelta(hours=26))
        self.assertEqual(later["state"], "stale")
        self.assertEqual(later["age_minutes"], 1590)
        self.assertEqual(check.refresh_external(row, NOW + timedelta(hours=1))["state"], "ok")

    def test_sender_can_declare_archive_cadence_instead_of_using_daily_default(self):
        row = check.validate_external(external("internxt-archive", max_age_minutes=32 * 24 * 60), NOW)
        self.assertEqual(check.refresh_external(row, NOW + timedelta(hours=36))["state"], "ok")
        self.assertEqual(check.refresh_external(row, NOW + timedelta(hours=36, seconds=1))["state"], "stale")
        self.assertEqual(check.refresh_external(row, NOW + timedelta(days=32))["state"], "stale")

    def test_report_freshness_is_independent_of_success_age_and_sender_state(self):
        for state in ("ok", "failed", "unknown", "stale"):
            with self.subTest(state=state):
                row = check.validate_external(external(state=state, max_age_minutes=32 * 24 * 60), NOW)
                self.assertEqual(check.refresh_external(row, NOW + timedelta(hours=36))["state"], state)
                later = check.refresh_external(row, NOW + timedelta(hours=36, seconds=1))
                self.assertEqual(later["state"], "stale")
                self.assertEqual(later["reported_state"], state)
        # Fresh reports still cannot make old successes healthy.
        row = check.validate_external(external(last_success=check.stamp(NOW - timedelta(hours=27))), NOW)
        self.assertEqual(row["state"], "stale")

    def test_report_files_require_matching_ids_and_valid_json(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            self.assertEqual(check.read_reports(directory), [])
            (directory / "README.md").write_text("Ignored non-report file")
            report = directory / "mac-mirror.json"
            for content in ('{', '[]', json.dumps(external("internxt-archive"))):
                report.write_text(content)
                with self.subTest(content=content), self.assertRaises(ValueError):
                    check.read_reports(directory)
            report.write_text(json.dumps(external()))
            self.assertEqual(check.read_reports(directory), [external()])

    def test_validate_only_expected_external_contract(self):
        for changes in ({"id": "app-nightly"}, {"state": "up"}, {"size_bytes": -1}, {"size_bytes": True},
                        {"size_bytes": "100"}, {"note": "x" * 501}, {"last_success": None},
                        {"reported_at": "2026-10-20T12:30:00Z"}, {"reported_at": "2026-10-20T12:20:00"},
                        {"max_age_minutes": 0}, {"max_age_minutes": True}, {"max_age_minutes": 600000},
                        {"last_success": "2026-10-20T13:00:00Z"}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                check.validate_external(external(**changes), NOW)

    def test_merge_ignores_old_reports_and_failure_keeps_last_success(self):
        rows = [check.validate_external(external(), NOW)]
        original = dict(rows[0])
        check.merge_external(rows, external(reported_at=check.stamp(NOW - timedelta(minutes=1))), NOW)
        self.assertEqual(rows[0], original)
        check.merge_external(rows, external(state="failed"), NOW)
        self.assertEqual(rows[0], original)
        check.merge_external(rows, external(state="failed", last_success=None, reported_at=check.stamp(NOW + timedelta(minutes=1))), NOW)
        self.assertEqual(rows[0]["state"], "failed")
        self.assertEqual(rows[0]["last_success"], original["last_success"])


class HistoryTests(unittest.TestCase):
    def test_worst_hour_survives_recovery_and_all_items_are_separate(self):
        history = check.roll_history({}, [{"id": "demo", "state": "down"}, {"id": "app-nightly", "state": "ok"}], NOW)
        history = check.roll_history(history, [{"id": "demo", "state": "up"}, {"id": "app-nightly", "state": "stale"}], NOW + timedelta(minutes=10))
        self.assertEqual(history["demo"][0]["state"], "down")
        self.assertEqual(history["app-nightly"][0]["state"], "stale")

    def test_cap_720_hours_drop_old_future_and_do_not_backfill(self):
        rows = [{"hour": check.stamp(NOW.replace(minute=0) - timedelta(hours=age)), "state": "up"} for age in range(-2, 750)]
        history = check.roll_history({"demo": rows, "removed": rows}, [{"id": "demo", "state": "up"}], NOW)
        self.assertEqual(len(history["demo"]), 720)
        self.assertNotIn("removed", history)
        empty = check.roll_history({}, [{"id": "demo", "state": "up"}], NOW)
        self.assertEqual(len(empty["demo"]), 1)

    def test_daily_worst_and_missing_hours_are_visible(self):
        rows = [{"hour": check.stamp(NOW.replace(hour=hour, minute=0)), "state": "up"} for hour in range(13)]
        html = render.history_html(rows, NOW)
        self.assertIn('20 Oct 2026: Operational (13/13 hours observed)', html)
        rows[-1]["state"] = "down"
        self.assertIn('20 Oct 2026: Down (13/13 hours observed)', render.history_html(rows, NOW))
        self.assertIn('20 Oct 2026: No data (1/13 hours observed)', render.history_html(rows[:1], NOW))
        self.assertEqual(html.count('class="history-day '), 30)


class StateTests(unittest.TestCase):
    def test_repository_editorial_sources_are_valid(self):
        check.validate_notices(json.loads((check.ROOT / "status/maintenance.json").read_text()),
                               json.loads((check.ROOT / "status/incidents.json").read_text()))

    def test_maintenance_bounds_and_incident_validation(self):
        notices = [{"id": "all", "from": check.stamp(NOW), "until": check.stamp(NOW + timedelta(hours=1)), "message": "Work"}]
        check.validate_notices(notices, [])
        self.assertEqual(check.active_maintenance(notices, NOW), notices)
        self.assertFalse(check.active_maintenance(notices, NOW + timedelta(hours=1)))
        with self.assertRaises(ValueError):
            check.validate_notices([dict(notices[0], id="typo")], [])
        with self.assertRaises(ValueError):
            check.validate_notices([dict(notices[0], until=check.stamp(NOW))], [])
        with self.assertRaises(ValueError):
            check.validate_notices([], [{"title": "Issue", "started": check.stamp(NOW), "resolved": check.stamp(NOW - timedelta(hours=1)), "message": "Work"}])

    def test_end_to_end_fake_checks_reports_and_history(self):
        systems = [{"id": "demo", "state": "down"}]
        backups = [check.empty_backup(item_id) for item_id in check.BACKUPS]
        maintenance = [{"id": "demo", "from": check.stamp(NOW), "until": check.stamp(NOW + timedelta(hours=1)), "message": "Work"}]
        previous = {"history": {"demo": [{"hour": check.stamp(NOW - timedelta(hours=1)), "state": "up"}]}}
        with patch.object(check, "check_systems", return_value=systems), patch.object(check, "check_backups", return_value=backups):
            data = check.build_status(previous, NOW, maintenance, [], [external("internxt-archive")])
        self.assertEqual(data["systems"][0]["state"], "maintenance")
        self.assertEqual(data["systems"][0]["measured_state"], "down")
        self.assertEqual(data["backups"][-1]["state"], "ok")
        self.assertEqual(len(data["history"]["demo"]), 2)
        self.assertEqual(data["maintenance"], maintenance)

    def test_previous_404_is_first_run_other_errors_preserve_history(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "previous.json"
            for code in (404, 403, 500):
                with patch.object(check, "urlopen", side_effect=HTTPError("url", code, "error", {}, None)):
                    if code == 404:
                        check.download_previous(output)
                        self.assertEqual(json.loads(output.read_text()), {})
                    else:
                        with self.assertRaises(HTTPError):
                            check.download_previous(output)
            response = MagicMock()
            response.__enter__.return_value.read.return_value = b"<html>upstream error</html>"
            with patch.object(check, "urlopen", return_value=response), self.assertRaises(ValueError):
                check.download_previous(output)
            self.assertEqual(json.loads(output.read_text()), {})

    def test_producer_command_reads_all_report_files_and_ignores_dispatch_payload(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            previous, event, output = folder / "previous.json", folder / "event.json", folder / "status.json"
            reports = folder / "reports"
            reports.mkdir()
            previous.write_text('{}')
            event.write_text(json.dumps({"client_payload": external("internxt-archive", state="failed")}))
            (reports / "internxt-archive.json").write_text(json.dumps(external("internxt-archive")))
            (reports / "mac-mirror.json").write_text(json.dumps(external()))
            responses = [(200, "", b'{"ok":true,"database":"reachable"}'),
                         (302, "https://demo.app.aidecis.com/", b""), (200, "", b""),
                         (302, "/google-login.php", b""), (302, "/google-login.php", b""), (302, "/desk", b"")]
            with patch.dict(os.environ, {"GITHUB_EVENT_NAME": "repository_dispatch", "GITHUB_EVENT_PATH": str(event),
                                         "STORAGEBOX_READONLY_KEY": "", "STORAGEBOX_KNOWN_HOSTS": ""}), \
                    patch("sys.argv", ["check.py", "--previous", str(previous), "--reports", str(reports), "--output", str(output)]), \
                    patch.object(check, "datetime", wraps=datetime) as clock, \
                    patch.object(check.monitor, "http_probe", side_effect=responses), \
                    patch.object(check.monitor, "tls_expiry", return_value=NOW.timestamp() + 30 * 86400):
                clock.now.return_value = NOW
                check.main()
            data = json.loads(output.read_text())
            self.assertEqual(data["backups"][-1]["state"], "ok")
            self.assertEqual(data["backups"][-2]["state"], "ok")
            self.assertEqual(len(data["history"]), 12)
            html = render.render(data, (check.ROOT / "status/template.html").read_text())
            self.assertIn("Internxt archive", html)
            self.assertNotIn("Sample preview", html)

    def test_files_merge_with_previous_public_state_and_age_on_later_runs(self):
        with tempfile.TemporaryDirectory() as folder:
            reports = Path(folder)
            (reports / "internxt-archive.json").write_text(json.dumps(external("internxt-archive", max_age_minutes=46080)))
            (reports / "mac-mirror.json").write_text(json.dumps(external()))
            with patch.object(check, "check_systems", return_value=[]), \
                    patch.dict(os.environ, {"STORAGEBOX_READONLY_KEY": "", "STORAGEBOX_KNOWN_HOSTS": ""}):
                first = check.build_status({}, NOW, [], [], check.read_reports(reports))
                # An older checkout cannot replace the newer report already published.
                (reports / "mac-mirror.json").write_text(json.dumps(external(state="failed", reported_at=check.stamp(NOW - timedelta(minutes=1)))))
                second = check.build_status(first, NOW + timedelta(hours=1), [], [], check.read_reports(reports))
                self.assertEqual(second["backups"][-2]["state"], "ok")
                self.assertEqual(second["backups"][-2]["reported_at"], check.stamp(NOW))
                self.assertEqual(second["backups"][-2]["age_minutes"], 90)
                # A newer file wins and preserves the last known success on failure.
                failure = external(state="failed", last_success=None, size_bytes=None,
                                   reported_at=check.stamp(NOW + timedelta(hours=1)))
                (reports / "mac-mirror.json").write_text(json.dumps(failure))
                third = check.build_status(second, NOW + timedelta(hours=1), [], [], check.read_reports(reports))
                self.assertEqual(third["backups"][-2]["state"], "failed")
                self.assertEqual(third["backups"][-2]["last_success"], external()["last_success"])
                self.assertEqual(third["backups"][-2]["size_bytes"], 1234)
                later = NOW + timedelta(hours=38)
                for files in (check.read_reports(reports), []):
                    stale = check.build_status(third, later, [], [], files)
                    self.assertEqual([row["state"] for row in stale["backups"][-2:]], ["stale", "stale"])
                    self.assertEqual(stale["history"]["internxt-archive"][-1]["state"], "stale")

    def test_schedule_and_payload_free_dispatch_read_default_checkout_reports(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            reports = root / "status/reports"
            reports.mkdir(parents=True)
            (reports / "mac-mirror.json").write_text(json.dumps(external()))
            (root / "status/maintenance.json").write_text('[]')
            (root / "status/incidents.json").write_text('[]')
            event = root / "event.json"
            event.write_text('{"event_type": "status-update"}')
            for trigger in ("schedule", "repository_dispatch"):
                with self.subTest(trigger=trigger), patch.object(check, "ROOT", root), \
                        patch.dict(os.environ, {"GITHUB_EVENT_NAME": trigger, "GITHUB_EVENT_PATH": str(event)}), \
                        patch("sys.argv", ["check.py"]), patch.object(check, "build_status", return_value={}) as build:
                    check.main()
                    self.assertEqual(build.call_args.args[-1], [external()])


class RenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sample = render.sample_status()
        cls.template = (check.ROOT / "status/template.html").read_text()

    def test_sample_renders_every_item_all_history_and_refresh_without_js(self):
        html = render.render(self.sample, self.template)
        HTMLParser().feed(html)
        self.assertEqual(html.count('class="system-tile"'), 6)
        self.assertEqual(html.count('class="backup-row"'), 6)
        self.assertEqual(html.count('class="history-day '), 12 * 30)
        self.assertIn('http-equiv="refresh" content="300"', html)
        self.assertIn("Sample preview", html)
        self.assertIn("Incident in progress", html)
        self.assertIn("Scheduled preview maintenance", html)
        self.assertNotIn("<script", html)
        self.assertNotIn("$systems", html)

    def test_external_and_editorial_text_is_escaped(self):
        sample = json.loads(json.dumps(self.sample))
        sample["backups"][0]["note"] = '<script>alert("x")</script>'
        sample["incidents"][0]["message"] = '<img src=x onerror=alert(1)>'
        html = render.render(sample, self.template)
        self.assertIn("&lt;script&gt;", html)
        self.assertIn("&lt;img", html)
        self.assertNotIn("<script", html)
        self.assertNotIn("<img src=x", html)

    def test_overall_priority_and_missing_data_never_claims_operational(self):
        data = {"systems": [{"state": "up"}], "backups": [{"state": "ok"}], "maintenance": [], "incidents": []}
        self.assertEqual(render.overall(data, NOW)[0], "up")
        data["systems"][0]["state"] = "maintenance"
        self.assertEqual(render.overall(data, NOW)[0], "maintenance")
        data["systems"][0]["state"] = "up"
        data["backups"][0]["state"] = "unknown"
        state, label = render.overall(data, NOW)
        self.assertEqual(state, "up")
        self.assertIn("no data", label)
        data["backups"][0]["state"] = "stale"
        self.assertEqual(render.overall(data, NOW)[0], "degraded")
        data["backups"][0]["state"] = "failed"
        self.assertEqual(render.overall(data, NOW)[0], "down")

    def test_sizes_and_ages(self):
        self.assertEqual(render.size_text(None), "No data")
        self.assertEqual(render.size_text(1024), "1.0 KiB")
        self.assertEqual(render.size_text(0), "0 B")
        self.assertEqual(render.age_text(None), "No data")
        self.assertEqual(render.age_text(30), "30 min")
        self.assertEqual(render.age_text(120), "2.0 h")
        self.assertEqual(render.age_text(2880), "2.0 days")

    def test_sample_cli_packages_assets_and_real_json_round_trip(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "status/index.html"
            with patch("sys.argv", ["render.py", "--sample", "--output", str(output)]), \
                    patch.object(render, "sample_status", return_value=self.sample):
                render.main()
            self.assertIn('../assets/status.css', output.read_text())
            for name in ("styles.css", "status.css", "aidecis-logo.png"):
                self.assertTrue((Path(folder) / "assets" / name).is_file())
            self.assertEqual(json.loads(output.with_name("status.json").read_text()), self.sample)
            with patch("sys.argv", ["render.py", "--input", str(output.with_name("status.json")), "--output", str(output)]):
                render.main()
            self.assertIn('https://aidecis.com/assets/status.css', output.read_text())


if __name__ == "__main__":
    unittest.main()
