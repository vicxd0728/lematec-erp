"""Publish only after the latest Worker run for this exact commit succeeds."""
import json
import os
import time
from urllib.request import Request, urlopen


def acceptance(runs, sha):
    matches = [r for r in runs if r.get('head_sha') == sha and r.get('head_branch') == 'main']
    if not matches:
        return 'wait'
    latest = max(matches, key=lambda r: (r['run_number'], r.get('run_attempt', 1)))
    if latest.get('status') != 'completed':
        return 'wait'
    return 'success' if latest.get('conclusion') == 'success' else 'failed'


def main():
    sha = os.environ['RELEASE_SHA']
    repo = os.environ['GH_REPO']
    url = f'https://api.github.com/repos/{repo}/actions/workflows/cloudflare-worker.yml/runs?head_sha={sha}&per_page=100'
    for attempt in range(120):
        request = Request(url, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
            'Accept': 'application/vnd.github+json', 'User-Agent': 'lematec-pages-acceptance'})
        with urlopen(request, timeout=30) as response:
            state = acceptance(json.load(response)['workflow_runs'], sha)
        if state == 'success':
            print('Exact-commit Worker workflow including production acceptance: PASS')
            return
        if state == 'failed':
            raise SystemExit('Worker workflow failed or was cancelled; Pages publication blocked.')
        print(f'Waiting for complete Worker acceptance ({attempt + 1}/120)', flush=True)
        time.sleep(10)
    raise SystemExit('Worker acceptance timed out; Pages publication blocked.')


if __name__ == '__main__':
    main()
