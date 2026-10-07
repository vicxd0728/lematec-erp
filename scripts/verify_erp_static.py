#!/usr/bin/env python3
"""Run deterministic, offline checks against the LEMATEC ERP deploy source."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path


REQUIRED_DB_KEYS = {
    "erpPage", "materials", "bom", "orders", "pickMaster", "pickDetail", "inbound", "custMaster"
}
REQUIRED_DEPLOY_FILES = ("index.html", "erp-action-receipts.js", "manifest.webmanifest", "sw.js", "_headers", "_redirects")
INDEX_REPLACEMENT_GUARD = "if(/[\u00a7\ufffd\u25a1\u25a0\u25af]/.test(s)) return true;"


class InlineScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_script = False
        self.external = False
        self.buffer: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "script":
            self.in_script = True
            self.external = bool(dict(attrs).get("src"))
            self.buffer = []

    def handle_data(self, data: str) -> None:
        if self.in_script:
            self.buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self.in_script:
            script = "".join(self.buffer)
            if not self.external and script.strip():
                self.scripts.append(script)
            self.in_script = False


def strict_text(path: Path, allowed_replacement_sequences: tuple[str, ...] = ()) -> str:
    text = path.read_text(encoding="utf-8", errors="strict")
    residual = text
    for sequence in allowed_replacement_sequences:
        if sequence not in residual:
            raise ValueError(f"required replacement-character guard is missing: {path}")
        residual = residual.replace(sequence, "")
    if "\ufffd" in residual:
        raise ValueError(f"replacement character found: {path}")
    return text


def find_node() -> str | None:
    direct = shutil.which("node") or shutil.which("node.exe")
    if direct:
        return direct
    bundled = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
    return str(bundled) if bundled.exists() else None


def check_javascript(scripts: list[str], node: str) -> list[dict[str, object]]:
    results = []
    with tempfile.TemporaryDirectory(prefix="erp-static-js-") as folder:
        for index, script in enumerate(scripts, start=1):
            target = Path(folder) / f"inline-{index}.js"
            target.write_text(script, encoding="utf-8")
            process = subprocess.run(
                [node, "--check", str(target)], check=False, capture_output=True,
                text=True, encoding="utf-8"
            )
            results.append({
                "index": index,
                "bytes": len(script.encode("utf-8")),
                "valid": process.returncode == 0,
                "error": process.stderr.strip() if process.returncode else "",
            })
    return results


def verify(root: Path, node: str | None = None) -> dict[str, object]:
    root = root.resolve()
    missing = [name for name in REQUIRED_DEPLOY_FILES if not (root / name).is_file()]
    if not (root / "icons").is_dir():
        missing.append("icons/")
    if missing:
        raise ValueError("missing deploy assets: " + ", ".join(missing))

    index_path = root / "index.html"
    html = strict_text(index_path, (INDEX_REPLACEMENT_GUARD,))
    service_worker = strict_text(root / "sw.js")
    action_receipts = strict_text(root / "erp-action-receipts.js")
    manifest = json.loads(strict_text(root / "manifest.webmanifest"))
    workflow = strict_text(root / ".github/workflows/cloudflare-pages.yml")

    if 'rel="manifest" href="./manifest.webmanifest"' not in html:
        raise ValueError("index.html does not reference manifest.webmanifest")
    if "serviceWorker.register('./sw.js')" not in html:
        raise ValueError("index.html does not register ./sw.js")
    if '<script src="./erp-action-receipts.js"></script>' not in html:
        raise ValueError("index.html does not load action receipts helper")
    if "'./erp-action-receipts.js'" not in service_worker:
        raise ValueError("service worker does not cache action receipts helper")
    if not re.search(r"const\s+FIRST_LOAD_DAYS\s*=\s*30\s*;", html):
        raise ValueError("FIRST_LOAD_DAYS=30 contract is missing")

    db_match = re.search(r"const\s+DB\s*=\s*\{(?P<body>.*?)\n\};", html, re.DOTALL)
    if not db_match:
        raise ValueError("const DB object not found")
    db_keys = set(re.findall(r"^\s*([A-Za-z][A-Za-z0-9_]*)\s*:", db_match.group("body"), re.MULTILINE))
    missing_keys = sorted(REQUIRED_DB_KEYS - db_keys)
    if missing_keys:
        raise ValueError("missing DB keys: " + ", ".join(missing_keys))

    missing_icons = []
    for icon in manifest.get("icons", []):
        source = str(icon.get("src", "")).removeprefix("./").lstrip("/")
        if source and not (root / source).is_file():
            missing_icons.append(source)
    if missing_icons:
        raise ValueError("manifest icons missing: " + ", ".join(missing_icons))

    for asset in REQUIRED_DEPLOY_FILES:
        if f"cp {asset}" not in workflow:
            raise ValueError(f"Cloudflare workflow does not package {asset}")
    if "cp -R icons" not in workflow:
        raise ValueError("Cloudflare workflow does not package icons/")

    parser = InlineScriptParser()
    parser.feed(html)
    node = node or find_node()
    js_results = check_javascript(parser.scripts + [action_receipts], node) if node else []
    if any(not item["valid"] for item in js_results):
        raise ValueError("inline JavaScript syntax check failed")

    return {
        "root": str(root),
        "index_bytes": index_path.stat().st_size,
        "index_sha256": hashlib.sha256(index_path.read_bytes()).hexdigest(),
        "strict_utf8": True,
        "allowlisted_replacement_guards": 1,
        "first_load_days": 30,
        "required_db_keys": sorted(REQUIRED_DB_KEYS),
        "manifest_icon_count": len(manifest.get("icons", [])),
        "service_worker_bytes": len(service_worker.encode("utf-8")),
        "inline_script_checks": js_results,
        "node_check": "passed" if js_results else "not-run",
        "deploy_assets": list(REQUIRED_DEPLOY_FILES) + ["icons/"],
        "mode": "offline-shadow",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--node")
    args = parser.parse_args()
    try:
        result = verify(Path(args.root), args.node)
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        raise SystemExit(f"ERP_STATIC_VERIFY_FAILED: {exc}") from exc
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
