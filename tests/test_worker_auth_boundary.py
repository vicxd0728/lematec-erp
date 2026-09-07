from pathlib import Path
import subprocess


def test_worker_company_authorization_behavior():
    result = subprocess.run(
        ["node", "--test", str(Path(__file__).with_name("worker_auth_boundary.cjs"))],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
