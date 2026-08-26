from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


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


class CorderReturnWorkflowTest(unittest.TestCase):
    def test_completed_corder_has_return_action_not_cancel_action(self):
        body = function_body("renderCorders")
        self.assertIn("['已完成','部分退貨'].includes(o.status)", body)
        self.assertIn("openReturnCorder('${o.id}')", body)
        self.assertIn("o.status==='出貨中'", body)
        self.assertIn("cancelCorder('${o.id}'", body)

    def test_return_corder_uses_return_statuses_and_reason_taxonomy(self):
        body = function_body("openReturnCorder")
        for phrase in ("買錯/不需要該產品", "故障", "寄錯產品", "其他"):
            self.assertIn(phrase, body)
        self.assertIn("已完成訂單不可直接取消", body)
        self.assertIn("部分退貨", body)
        self.assertIn("已退貨", body)

    def test_other_return_reason_is_required(self):
        body = function_body("submitReturnCorder")
        self.assertIn("reasonType==='其他'", body)
        self.assertIn("reasonOther.length<2", body)
        self.assertIn("選其他時請填寫原因", body)

    def test_return_inventory_uses_unique_return_batch_key(self):
        body = function_body("submitReturnCorder")
        self.assertIn("RET-${Date.now()}", body)
        self.assertIn("returnCorderStock([{id:refs[0].id,qty:returnQty}],returnRefNo,returnRefNo)", body)
        return_body = function_body("returnCorderStock")
        self.assertIn("sourceId:operationKey||refNo", return_body)

    def test_completed_return_does_not_mark_order_cancelled(self):
        body = function_body("submitReturnCorder")
        self.assertIn("const nextStatus=nextReturnedQty>=orderQty?'已退貨':'部分退貨';", body)
        self.assertNotIn("'已取消'", body)

    def test_return_statuses_are_filterable_but_fully_returned_is_not_active_recent(self):
        body = function_body("renderCorders")
        self.assertIn("['','出貨中','已完成','部分退貨','已退貨','已取消']", body)
        self.assertIn('data-icon="↩"', body)
        self.assertIn("退貨</span><strong>${countReturn}</strong>", body)
        recent_body = function_body("corderRecentFilter")
        self.assertIn("activeStatusFilter('狀態','已退貨')", recent_body)
        self.assertNotIn("activeStatusFilter('狀態','部分退貨')", recent_body)

    def test_partial_return_remaining_quantity_is_enforced(self):
        helper = function_body("getCorderReturnedQty")
        self.assertIn("const re=/退貨\\s+(\\d+)\\s*\\/\\s*(\\d+)/g;", helper)
        self.assertIn("total+=parseInt(m[1])||0;", helper)
        open_body = function_body("openReturnCorder")
        submit_body = function_body("submitReturnCorder")
        self.assertIn("const remainingQty=Math.max(qty-returnedQty,0);", open_body)
        self.assertIn('max="${remainingQty}" value="${remainingQty}"', open_body)
        self.assertIn("const remainingQty=Math.max(orderQty-returnedQty,0);", submit_body)
        self.assertIn("returnQty>remainingQty", submit_body)
        self.assertIn("const nextReturnedQty=returnedQty+returnQty;", submit_body)

    def test_return_workflow_uses_lock_and_notion_sync_queue(self):
        body = function_body("submitReturnCorder")
        self.assertIn("_corderReturnLocks.has(id)", body)
        self.assertIn("_corderReturnLocks.add(id)", body)
        self.assertIn("_corderReturnLocks.delete(id)", body)
        self.assertIn("updateWorkflowPageAfterInventory(id,{", body)
        self.assertIn("statusSync.pending", body)


if __name__ == "__main__":
    unittest.main()
