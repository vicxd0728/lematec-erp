import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('gate', Path(__file__).parents[1] / 'scripts/wait_worker_acceptance.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def test_exact_commit_completed_success_required():
    run = dict(head_sha='release', head_branch='main', run_number=1, status='completed', conclusion='success')
    assert gate.acceptance([run], 'other') == 'wait'
    assert gate.acceptance([run], 'release') == 'success'
    assert gate.acceptance([{**run, 'status': 'in_progress'}], 'release') == 'wait'
    for conclusion in ['failure', 'cancelled', 'timed_out', 'skipped', None]:
        assert gate.acceptance([{**run, 'conclusion': conclusion}], 'release') == 'failed'
    assert gate.acceptance([run, {**run, 'run_number': 2, 'status': 'in_progress'}], 'release') == 'wait'
