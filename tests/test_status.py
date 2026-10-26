"""Deterministic public-status tests. All HTTPS responses are fake."""

from datetime import datetime, timedelta
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/status"))
import check
import monitor
import render

NOW = datetime(2026, 10, 20, 12, 20, tzinfo=check.UTC)
ROOT = Path(__file__).resolve().parents[1]
# Internal systems and backups must never reach the public page or this repository.
PRIVATE = ("u690159", "storagebox", "libi", "crm.aidecis", "csm.aidecis", "demo.app", "app.aidecis",
           "mac mirror", "mac-mirror", "internxt", "backup", "wal")


class ScopeTests(unittest.TestCase):
    def test_only_the_website_is_checked(self):
        self.assertEqual(check.SYSTEMS, (("website", "Aidecis website"),))
        self.assertEqual(monitor.TARGETS, (("https://aidecis.com", "website"),))

    def test_status_sources_name_no_internal_system_or_backup(self):
        for path in [*(ROOT / "scripts/status").glob("*.py"), ROOT / "status/template.html",
                     ROOT / "status/closed.html", ROOT / ".github/workflows/status.yml"]:
            text = path.read_text().lower()
            for word in PRIVATE:
                if word in ("backup", "wal") and path.suffix in (".py", ".yml"):
                    continue  # the comments say internal backups are monitored elsewhere
                with self.subTest(path=path.name, word=word):
                    self.assertNotIn(word, text)
        self.assertFalse((ROOT / "status/reports").exists())


class SystemTests(unittest.TestCase):
    def test_fake_https_and_tls_produce_the_website(self):
        with patch.object(check.monitor, "http_probe", return_value=(200, "", b"")) as probe, \
                patch.object(check.monitor, "tls_expiry", return_value=NOW.timestamp() + 30 * 86400):
            rows = check.check_systems(NOW)
        probe.assert_called_once_with("https://aidecis.com")
        self.assertEqual([(row["id"], row["state"]) for row in rows], [("website", "up")])
        self.assertEqual(rows[0]["tls_days"], 30)
        self.assertEqual(rows[0]["checked_at"], check.stamp(NOW))

    def test_redirect_is_down_and_query_strings_are_dropped(self):
        healthy, measured, expected = monitor.http_health("https://aidecis.com", "website", 302, "/x?token=secret", b"")
        self.assertFalse(healthy)
        self.assertEqual(measured, "HTTP 302, Location=https://aidecis.com/x")
        self.assertEqual(expected, "HTTP 200")

    def test_network_failures_do_not_expose_exception_text(self):
        with patch.object(check.monitor, "http_probe", side_effect=TimeoutError("secret")), \
                patch.object(check.monitor, "tls_expiry", side_effect=OSError("secret")):
            rows = check.check_systems(NOW)
        self.assertEqual(rows[0]["state"], "down")
        self.assertNotIn("secret", json.dumps(rows))

    def test_tls_warning_and_exact_boundary(self):
        for days, state in ((14, "up"), (13.99, "degraded"), (0, "degraded")):
            with self.subTest(days=days), patch.object(check.monitor, "http_probe", return_value=(200, "", b"")), \
                    patch.object(check.monitor, "tls_expiry", return_value=NOW.timestamp() + days * 86400):
                self.assertEqual(check.check_systems(NOW)[0]["state"], state)


class HistoryTests(unittest.TestCase):
    def test_worst_hour_survives_recovery(self):
        history = check.roll_history({}, [{"id": "website", "state": "down"}], NOW)
        history = check.roll_history(history, [{"id": "website", "state": "up"}], NOW + timedelta(minutes=10))
        self.assertEqual(history["website"][0]["state"], "down")

    def test_cap_720_hours_drop_old_future_removed_items_and_old_states(self):
        rows = [{"hour": check.stamp(NOW.replace(minute=0) - timedelta(hours=age)), "state": "up"} for age in range(-2, 750)]
        rows.append({"hour": check.stamp(NOW.replace(minute=0) - timedelta(hours=800)), "state": "stale"})
        history = check.roll_history({"website": rows, "mac-mirror": rows}, [{"id": "website", "state": "up"}], NOW)
        self.assertEqual(len(history["website"]), 720)
        self.assertEqual(list(history), ["website"])
        empty = check.roll_history({}, [{"id": "website", "state": "up"}], NOW)
        self.assertEqual(len(empty["website"]), 1)

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
        check.validate_notices([dict(notices[0], id="website")], [])
        self.assertEqual(check.active_maintenance(notices, NOW), notices)
        self.assertFalse(check.active_maintenance(notices, NOW + timedelta(hours=1)))
        for bad in ("typo", "libi", "mac-mirror"):
            with self.assertRaises(ValueError):
                check.validate_notices([dict(notices[0], id=bad)], [])
        with self.assertRaises(ValueError):
            check.validate_notices([dict(notices[0], until=check.stamp(NOW))], [])
        with self.assertRaises(ValueError):
            check.validate_notices([], [{"title": "Issue", "started": check.stamp(NOW), "resolved": check.stamp(NOW - timedelta(hours=1)), "message": "Work"}])

    def test_end_to_end_previous_public_state_is_reduced_to_the_website(self):
        maintenance = [{"id": "website", "from": check.stamp(NOW), "until": check.stamp(NOW + timedelta(hours=1)), "message": "Work"}]
        hour = check.stamp(NOW - timedelta(hours=1))
        previous = {"backups": [{"id": "mac-mirror"}],
                    "history": {"website": [{"hour": hour, "state": "up"}], "libi": [{"hour": hour, "state": "up"}],
                                "app-nightly": [{"hour": hour, "state": "ok"}]}}
        with patch.object(check, "check_systems", return_value=[{"id": "website", "state": "down"}]):
            data = check.build_status(previous, NOW, maintenance, [])
        self.assertEqual(set(data), {"generated_at", "systems", "history", "maintenance", "incidents"})
        self.assertEqual(data["systems"][0]["state"], "maintenance")
        self.assertEqual(data["systems"][0]["measured_state"], "down")
        self.assertEqual(list(data["history"]), ["website"])
        self.assertEqual(len(data["history"]["website"]), 2)

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

    def test_producer_command_writes_website_only_status(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            previous, output = folder / "previous.json", folder / "status.json"
            previous.write_text('{"history": {"crm": [], "website": []}}')
            with patch("sys.argv", ["check.py", "--previous", str(previous), "--output", str(output)]), \
                    patch.object(check, "datetime", wraps=datetime) as clock, \
                    patch.object(check.monitor, "http_probe", return_value=(200, "", b"")), \
                    patch.object(check.monitor, "tls_expiry", return_value=NOW.timestamp() + 30 * 86400):
                clock.now.return_value = NOW
                check.main()
            text = output.read_text()
            data = json.loads(text)
            self.assertEqual([row["id"] for row in data["systems"]], ["website"])
            self.assertEqual(list(data["history"]), ["website"])
            html = render.render(data, (check.ROOT / "status/template.html").read_text())
            for word in PRIVATE:
                self.assertNotIn(word, (text + html).lower())
            self.assertIn("All systems operational", html)
            self.assertNotIn("Sample preview", html)


class RenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sample = render.sample_status()
        cls.template = (check.ROOT / "status/template.html").read_text()

    def test_sample_renders_the_website_history_and_refresh_without_js(self):
        html = render.render(self.sample, self.template)
        HTMLParser().feed(html)
        self.assertEqual(html.count('class="system-tile"'), 1)
        self.assertNotIn("backup", html.lower())
        self.assertEqual(html.count('class="history-day '), 30)
        self.assertIn('http-equiv="refresh" content="300"', html)
        self.assertIn("Sample preview", html)
        self.assertIn("Incident in progress", html)
        self.assertIn("Scheduled preview maintenance", html)
        self.assertNotIn("<script", html)
        self.assertNotIn("$systems", html)

    def test_editorial_text_is_escaped(self):
        sample = json.loads(json.dumps(self.sample))
        sample["maintenance"][0]["message"] = '<script>alert("x")</script>'
        sample["incidents"][0]["message"] = '<img src=x onerror=alert(1)>'
        html = render.render(sample, self.template)
        self.assertIn("&lt;script&gt;", html)
        self.assertIn("&lt;img", html)
        self.assertNotIn("<script", html)
        self.assertNotIn("<img src=x", html)

    def test_overall_priority_and_missing_data_never_claims_operational(self):
        data = {"systems": [{"state": "up"}], "maintenance": [], "incidents": []}
        self.assertEqual(render.overall(data, NOW), ("up", "All systems operational"))
        for state, expected in (("maintenance", "maintenance"), ("degraded", "degraded"), ("down", "down"), ("unknown", "unknown")):
            data["systems"][0]["state"] = state
            self.assertEqual(render.overall(data, NOW)[0], expected)
        self.assertEqual(render.overall({"systems": []}, NOW)[0], "unknown")

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
