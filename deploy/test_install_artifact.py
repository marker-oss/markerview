#!/usr/bin/env python3
import hashlib
import os
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INSTALLER = ROOT / "deploy" / "install-artifact.sh"
REVISION = "a" * 40


class ArtifactInstallerTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="install-artifact-test-")
        self.addCleanup(temporary.cleanup)
        self.tmp = Path(temporary.name)
        self.app = self.tmp / "app"
        self.app.mkdir()
        self.binary = self.app / "reviews"
        self.binary.write_text("old\n")
        self.binary.chmod(0o755)
        self.database = self.app / "reviews.db"
        with sqlite3.connect(self.database) as connection:
            connection.execute("create table marker (value text)")
            connection.execute("insert into marker values ('before')")
        service_env = os.environ.copy()
        service_env.update(
            REVIEWS_DB_DRIVER="sqlite", REVIEWS_DB_DSN=str(self.database)
        )
        self.service = subprocess.Popen(["sleep", "60"], env=service_env)
        self.addCleanup(self.stop_service)
        self.fakebin = self.tmp / "bin"
        self.fakebin.mkdir()
        self.restart_log = self.tmp / "restarts"
        self.health_ok = self.tmp / "healthy"
        scripts = {
            "id": "#!/bin/sh\nprintf '%s\\n' 0\n",
            "systemctl": '#!/bin/sh\ncase "$1" in\n show) printf \'%s\\n\' "$FAKE_MAIN_PID" ;;\n restart) printf \'restart\\n\' >> "$RESTART_LOG" ;;\n *) exit 1 ;;\nesac\n',
            "curl": '#!/bin/sh\ntest -f "$HEALTH_OK"\n',
        }
        for name, script in scripts.items():
            command = self.fakebin / name
            command.write_text(script)
            command.chmod(0o755)

    def stop_service(self):
        if self.service.poll() is None:
            self.service.terminate()
            self.service.wait()

    def run_installer(self, artifact, checksum):
        env = os.environ.copy()
        env.update(
            PATH=f"{self.fakebin}:{env['PATH']}",
            APP_DIR=str(self.app),
            HEALTH_TIMEOUT="1",
            FAKE_MAIN_PID=str(self.service.pid),
            RESTART_LOG=str(self.restart_log),
            HEALTH_OK=str(self.health_ok),
        )
        return subprocess.run(
            ["sh", str(INSTALLER), str(artifact), REVISION, checksum],
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )

    def artifact(self):
        artifact = self.tmp / "new"
        artifact.write_text("new\n")
        artifact.chmod(0o755)
        return artifact

    def test_bad_checksum_does_not_mutate_existing_binary(self):
        result = self.run_installer(self.artifact(), "0" * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.binary.read_text(), "old\n")
        self.assertFalse((self.app / "backups").exists())

    def test_failed_health_restores_old_binary(self):
        artifact = self.artifact()
        checksum = hashlib.sha256(artifact.read_bytes()).hexdigest()
        result = self.run_installer(artifact, checksum)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.binary.read_text(), "old\n")
        backups = list((self.app / "backups").iterdir())
        self.assertEqual(len(backups), 1)
        with sqlite3.connect(backups[0] / "database.sqlite") as connection:
            self.assertEqual(
                connection.execute("select value from marker").fetchone()[0], "before"
            )
        self.assertEqual((backups[0] / "reviews").read_text(), "old\n")
        self.assertIn(str(backups[0]), result.stderr)

    def test_success_records_revision_and_keeps_backup(self):
        self.health_ok.touch()
        artifact = self.artifact()
        checksum = hashlib.sha256(artifact.read_bytes()).hexdigest()
        result = self.run_installer(artifact, checksum)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.binary.read_text(), "new\n")
        self.assertEqual((self.app / "deployed-revision").read_text(), REVISION + "\n")
        backup = next((self.app / "backups").iterdir())
        self.assertEqual((backup / "reviews").read_text(), "old\n")


if __name__ == "__main__":
    unittest.main()
