from pathlib import Path
import subprocess


def test_inventory_conflict_runtime_behavior():
    result = subprocess.run(
        ["node", "--test", str(Path(__file__).with_name("inventory_conflict_resolution.cjs"))],
        capture_output=True, text=True, encoding="utf-8", timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
