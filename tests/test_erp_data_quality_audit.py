import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "audit_erp_data_quality.py"

spec = importlib.util.spec_from_file_location("audit_erp_data_quality", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def test_stock_audit_treats_legacy_picking_increase_as_reversal():
    row = {
        "id": "row-1",
        "source": "erp_frontend",
        "ref_no": "JP26072102",
        "material_code": "Y-AB-25B",
        "change_type": "領料",
        "quantity": 17,
        "before_stock": 537,
        "after_stock": 554,
    }

    report = audit.audit_stock_logs([row])

    assert report["issue_count"] == 0
    assert report["auto_resolved_count"] == 1
    assert report["auto_resolved"][0]["reason"] == "semantic_direction_inferred"
    assert "領料沖銷" in report["auto_resolved"][0]["detail"]


def test_stock_audit_still_flags_real_quantity_math_error():
    row = {
        "id": "row-2",
        "source": "erp_frontend",
        "ref_no": "PK-ERROR",
        "material_code": "Y-TEST",
        "change_type": "領料",
        "quantity": 3,
        "before_stock": 10,
        "after_stock": 9,
    }

    report = audit.audit_stock_logs([row])

    assert report["issue_count"] == 1
    assert report["issues"][0]["category"] == "數量異常"
