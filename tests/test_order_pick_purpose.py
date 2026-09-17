import subprocess
from pathlib import Path


def test_order_pick_purpose_behaviors():
    subprocess.run(['node', '--test', 'tests/order_pick_purpose.cjs'],
                   cwd=Path(__file__).resolve().parents[1], check=True)
