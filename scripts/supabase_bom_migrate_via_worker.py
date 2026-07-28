from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.request
from decimal import Decimal
from pathlib import Path


DEFAULT_WORKER_URL = "https://green-wave-c22f.vic-e93.workers.dev"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def request_json(
    url: str,
    *,
    method: str = "GET",
    token: str = "",
    payload: dict | None = None,
    timeout: int = 240,
) -> dict:
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 LEMATEC-ERP-BOM-Migrator/1.0",
    }
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Worker HTTP {exc.code}: {detail}") from exc


def normalized_key(row: dict) -> tuple[str, str]:
    return (
        str(row.get("parent_notion_page_id") or "").strip(),
        str(row.get("child_notion_page_id") or "").strip(),
    )


def normalized_quantity(value: object) -> Decimal:
    return Decimal(str(value or "0")).normalize()


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate a validated Notion BOM export through the ERP Worker.")
    parser.add_argument("--export-dir", required=True, type=Path)
    parser.add_argument("--worker-url", default=DEFAULT_WORKER_URL)
    args = parser.parse_args()

    export_dir = args.export_dir.resolve()
    materials_path = export_dir / "materials_importable.csv"
    bom_path = export_dir / "bom_rows_importable.csv"
    if not materials_path.exists() or not bom_path.exists():
        raise SystemExit(f"Missing migration export files in {export_dir}")

    token = (os.environ.get("NOTION_TOKEN") or "").strip()
    if not token:
        raise SystemExit("Missing NOTION_TOKEN in the current process environment.")

    materials = read_csv(materials_path)
    bom_rows = read_csv(bom_path)
    expected: dict[tuple[str, str], Decimal] = {}
    for row in bom_rows:
        key = normalized_key(row)
        if not all(key):
            raise SystemExit(f"Invalid BOM relation ids: {row.get('notion_page_id')}")
        if key[0] == key[1]:
            raise SystemExit(f"Self-referencing BOM was not held back: {row.get('notion_page_id')}")
        if key in expected:
            raise SystemExit(f"Duplicate BOM pair in export: {key}")
        quantity = normalized_quantity(row.get("quantity"))
        if quantity <= 0:
            raise SystemExit(f"Invalid BOM quantity: {row.get('notion_page_id')}")
        expected[key] = quantity

    worker_url = args.worker_url.rstrip("/")
    result = request_json(
        f"{worker_url}/api/inventory/bom/migrate",
        method="POST",
        token=token,
        payload={
            "full_snapshot": True,
            "materials": materials,
            "bom_rows": bom_rows,
        },
    )
    (export_dir / "bom_migration_result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not result.get("ok"):
        raise SystemExit(f"Worker migration failed: {result}")

    live = request_json(f"{worker_url}/api/inventory/bom/list")
    actual: dict[tuple[str, str], Decimal] = {}
    duplicate_actual: list[tuple[str, str]] = []
    for row in live.get("rows") or []:
        key = normalized_key(row)
        if key in actual:
            duplicate_actual.append(key)
        actual[key] = normalized_quantity(row.get("quantity"))

    missing = sorted(key for key in expected if key not in actual)
    extra = sorted(key for key in actual if key not in expected)
    quantity_mismatches = sorted(
        ({
            "parent_notion_page_id": key[0],
            "child_notion_page_id": key[1],
            "expected": str(expected[key]),
            "actual": str(actual[key]),
        }
        for key in expected.keys() & actual.keys()
        if expected[key] != actual[key]),
        key=lambda row: (row["parent_notion_page_id"], row["child_notion_page_id"]),
    )
    report = {
        "ok": not missing and not extra and not quantity_mismatches and not duplicate_actual,
        "expected_rows": len(expected),
        "actual_rows": len(actual),
        "expected_parents": len({key[0] for key in expected}),
        "actual_parents": int(live.get("parent_count") or 0),
        "missing": [{"parent_notion_page_id": p, "child_notion_page_id": c} for p, c in missing],
        "extra": [{"parent_notion_page_id": p, "child_notion_page_id": c} for p, c in extra],
        "quantity_mismatches": quantity_mismatches,
        "duplicate_actual": [{"parent_notion_page_id": p, "child_notion_page_id": c} for p, c in duplicate_actual],
        "migration_result": result,
    }
    report_path = export_dir / "bom_worker_verify_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Report: {report_path}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
