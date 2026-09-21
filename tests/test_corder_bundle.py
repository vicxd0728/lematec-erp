import subprocess
from pathlib import Path


def test_corder_bundle_behaviors():
    subprocess.run(['node', '--test', 'tests/corder_bundle.cjs'],cwd=Path(__file__).resolve().parents[1],check=True)
