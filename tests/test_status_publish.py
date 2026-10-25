"""Exercise the real publish scripts with fake curl/lftp; never contact a server."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which("ruby"), "Ruby is needed to parse workflow YAML")
class PublishTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(["ruby", "-ryaml", "-rjson", "-e",
                                 "puts JSON.generate(YAML.load_file(ARGV[0]))", str(ROOT / ".github/workflows/publish.yml")],
                                check=True, capture_output=True, text=True)
        cls.steps = {row.get("name"): row for row in json.loads(result.stdout)["jobs"]["publish"]["steps"]}

    def test_status_survives_publish_and_is_excluded_from_live_comparison(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ("assets", "demo", "demo-v9.1", "status", "bin", "server"):
                (root / name).mkdir()
            for name in ("index.html", "robots.txt", "llms.txt", "sitemap.xml", "assets/style.css", "demo/index.html", "demo-v9.1/index.html"):
                (root / name).write_text("published " + name)
            (root / "status/template.html").write_text("private template")
            (root / "status/reports").mkdir()
            (root / "status/reports/mac-mirror.json").write_text('{"id": "mac-mirror"}')
            env = dict(os.environ, PATH=str(root / "bin") + os.pathsep + os.environ["PATH"],
                       FAKE_ROOT=str(root), GITHUB_RUN_ID="123")
            subprocess.run(["bash", "-c", self.steps["Collect the publishable files"]["run"]], cwd=root, env=env, check=True, capture_output=True)
            self.assertFalse((root / "site/status").exists())
            shutil.copytree(root / "site", root / "server", dirs_exist_ok=True)
            (root / "server/status").mkdir()
            (root / "server/status/status.json").write_text("independently generated")
            # Even accidental local status staging must never be compared to production.
            (root / "site/status").mkdir()
            (root / "site/status/status.json").write_text("different preview")
            curl = root / "bin/curl"
            curl.write_text('''#!/usr/bin/env python3
import os, sys
from pathlib import Path
from urllib.parse import unquote, urlsplit
root = Path(os.environ['FAKE_ROOT'])
url = next(arg for arg in sys.argv[1:] if arg.startswith('https://'))
path = unquote(urlsplit(url).path).lstrip('/')
with (root / 'requests').open('a') as log:
    log.write(path + '\\n')
sys.stdout.buffer.write((root / 'server' / path).read_bytes())
''')
            for name, body in (("sleep", "exit 0\n"), ("git", "echo abc123\n"), ("lftp", 'printf "%s\\n" "$*" > "$FAKE_ROOT/lftp-command"\n')):
                (root / "bin" / name).write_text("#!/bin/sh\n" + body)
            for executable in (root / "bin").iterdir():
                executable.chmod(0o755)
            result = subprocess.run(["bash", "-c", self.steps["Check the live site"]["run"]], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(len((root / "requests").read_text().splitlines()), 7)
            self.assertNotIn("status/", (root / "requests").read_text())
            env.update(SFTP_KEY="", LFTP_PASSWORD="fake-password", HOST="fake.example", SFTP_USER="fake", REMOTE="www", DRY="--dry-run")
            subprocess.run(["bash", "-c", self.steps["Upload over SFTP"]["run"]], cwd=root, env=env, check=True, capture_output=True)
            self.assertIn("--exclude '^status(/|$)'", (root / "lftp-command").read_text())
            self.assertEqual((root / "server/status/status.json").read_text(), "independently generated")
            # The check must still reject a mismatch in an ordinary published file.
            (root / "server/index.html").write_text("unexpected change")
            result = subprocess.run(["bash", "-c", self.steps["Check the live site"]["run"]], cwd=root, env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("differs on the live site: index.html", result.stdout)


if __name__ == "__main__":
    unittest.main()
