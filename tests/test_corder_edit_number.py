import subprocess
from pathlib import Path


def test_corder_edit_number_behaviors():
    subprocess.run(
        ['node', '--test', 'tests/corder_edit_number.cjs'],
        cwd=Path(__file__).resolve().parents[1], check=True,
    )
