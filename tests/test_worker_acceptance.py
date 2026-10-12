import importlib.util
import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
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


class WorkerGateRecoveryTests(unittest.TestCase):
    def response(self, conclusion='success'):
        return io.BytesIO(json.dumps({'workflow_runs': [dict(
            head_sha='release', head_branch='main', run_number=1,
            status='completed', conclusion=conclusion)]}).encode())

    def invoke(self, effects, attempts=2):
        with patch.dict(gate.os.environ, RELEASE_SHA='release', GH_REPO='example/repo', GH_TOKEN='test-only'), \
                patch.object(gate, 'urlopen', side_effect=effects) as fetch, \
                patch.object(gate.time, 'sleep') as sleep:
            gate.main(attempts=attempts, interval=0)
        return fetch.call_count, sleep.call_count

    def test_transient_gateway_then_success(self):
        self.assertEqual(self.invoke([HTTPError('https://api.github.com', 502, 'Bad Gateway', {}, None), self.response()]), (2, 1))

    def test_connection_then_success(self):
        self.assertEqual(self.invoke([URLError('offline'), self.response()]), (2, 1))

    def test_auth_failure_does_not_retry_or_publish(self):
        with self.assertRaisesRegex(SystemExit, 'HTTP 401'):
            self.invoke([HTTPError('https://api.github.com', 401, 'Unauthorized', {}, None)], attempts=1)

    def test_unavailable_status_exhausts_budget_without_publishing(self):
        with self.assertRaisesRegex(SystemExit, 'timed out; Pages publication blocked'):
            self.invoke([TimeoutError(), TimeoutError()])

    def test_transient_recovery_does_not_override_failed_worker(self):
        with self.assertRaisesRegex(SystemExit, 'Worker workflow failed'):
            self.invoke([URLError('offline'), self.response('failure')])

    def test_exact_sha_contract(self):
        test_exact_commit_completed_success_required()

    def test_failure_summary_contract(self):
        test_failed_worker_summary_includes_attempt_and_run_url()
