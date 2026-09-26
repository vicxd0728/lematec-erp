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


def test_failed_worker_summary_includes_attempt_and_run_url():
    run = dict(head_sha='release', head_branch='main', run_number=44, run_attempt=2,
               status='completed', conclusion='failure', html_url='https://github.com/example/repo/actions/runs/44')
    assert gate.failure_summary([run], 'release') == (
        'Worker run #44 attempt 2 concluded failure: https://github.com/example/repo/actions/runs/44'
    )
