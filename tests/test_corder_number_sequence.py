from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)
MIGRATION = (
    ROOT / "supabase/migrations/20260731_015_corder_number_sequence.sql"
).read_text(encoding="utf-8")


def function_body(name: str) -> str:
    match = re.search(rf"(?:async\s+)?function\s+{name}\([^)]*\)\{{", INDEX)
    if not match:
        raise AssertionError(f"Missing function {name}")
    start = match.end()
    depth = 1
    pos = start
    while pos < len(INDEX) and depth:
        char = INDEX[pos]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        pos += 1
    return INDEX[start : pos - 1]


class CorderNumberSequenceTests(unittest.TestCase):
    def test_frontend_uses_shared_atomic_reservation(self):
        self.assertIn("/api/corder/number-state", INDEX)
        self.assertIn("/api/corder/number-reserve", INDEX)
        self.assertIn("reserveCorderNumbers(newOrderKeys.length)", INDEX)
        self.assertIn("reserveCorderNumbers(1)", INDEX)

    def test_sequence_ready_gate_exists_and_blocks_reservation(self):
        reserve_body = function_body("reserveCorderNumbers")
        self.assertIn("function corderSequenceReady()", INDEX)
        self.assertIn("async function ensureCorderSequenceReady", INDEX)
        self.assertLess(
            reserve_body.index("ensureCorderSequenceReady"),
            reserve_body.index("/api/corder/number-reserve"),
        )

    def test_manual_create_checks_sequence_before_modal_closes(self):
        body = function_body("submitCorder")
        self.assertLess(body.index("ensureCorderSequenceReady"), body.index("closeModal()"))
        self.assertLess(
            body.index("ensureCorderSequenceReady"),
            body.index("reserveCorderNumbers(1)"),
        )

    def test_excel_import_checks_sequence_before_batch_reservation(self):
        import_body = function_body("importShopeeExcel")
        apply_body = function_body("applyCorderImportPreflight")
        self.assertIn("buildCorderImportPreflight(incoming)", import_body)
        self.assertNotIn("reserveCorderNumbers(newOrderKeys.length)", import_body)
        self.assertLess(
            apply_body.index("ensureCorderSequenceReady"),
            apply_body.index("reserveCorderNumbers(newOrderKeys.length)"),
        )

    def test_sequence_unavailable_ui_disables_order_creation(self):
        self.assertIn("sequenceBlockedMessage", INDEX)
        self.assertIn("title=\"${sequenceBlockedMessage}\"", INDEX)
        self.assertIn("fetchCorderSequenceState().then(()=>renderTab('corders'))", INDEX)

    def test_manual_sequence_setting_uses_shared_worker_state(self):
        self.assertNotIn("saveCorderStartSerial()", INDEX)
        self.assertIn("openCorderSequenceAdmin", INDEX)
        self.assertIn("saveCorderSequenceAdmin", INDEX)
        self.assertIn("設定共享下一號", INDEX)
        self.assertIn("/api/corder/number-set", INDEX)
        save_body = function_body("saveCorderSequenceAdmin")
        self.assertIn("setCorderNextSerial(n)", save_body)
        self.assertNotIn("localStorage", save_body)
        self.assertIn("校正只能往前推進", save_body)

    def test_next_number_prefers_shared_state_over_local_cache(self):
        body = function_body("nextCorderInternalNo")
        self.assertLess(
            body.index("CORDER_SEQUENCE_STATE?.next_number"),
            body.index("getCorderStartSerial"),
        )

    def test_worker_keeps_supabase_credentials_server_side(self):
        self.assertIn("reserve_corder_numbers", WORKER)
        self.assertIn("get_corder_number_state", WORKER)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", INDEX)

    def test_migration_calibrates_against_existing_orders_and_locks(self):
        self.assertIn("from public.c_orders c", MIGRATION)
        self.assertIn("max(substring(c.internal_order_number", MIGRATION)
        self.assertIn("for update", MIGRATION.lower())
        self.assertIn("greatest(v_start, v_order_next)", MIGRATION)


if __name__ == "__main__":
    unittest.main()
