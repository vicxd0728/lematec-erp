from pathlib import Path
import subprocess


def test_order_timeline_runtime():
    result = subprocess.run(['node','--test',str(Path(__file__).with_name('order_timeline.cjs'))],capture_output=True,text=True,encoding='utf-8',timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
