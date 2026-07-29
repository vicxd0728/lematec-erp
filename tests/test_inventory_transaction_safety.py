from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)
RPC_SQL = (
    ROOT / "supabase" / "migrations" / "20260728_005_inventory_rpc_service_role.sql"
).read_text(encoding="utf-8")


class InventoryTransactionSafetyTest(unittest.TestCase):
    def test_frontend_inventory_writes_use_supabase_gateway(self):
        self.assertIn("async function applyInventoryDeltaAndMirror", INDEX)
        self.assertIn("postInventoryAdjustTask", INDEX)
        self.assertIn("idempotency_key:idempotencyKey", INDEX)
        self.assertIn("async function applyInventoryBatchAndMirror", INDEX)
        self.assertIn("postInventoryBatchAdjustTask", INDEX)
        self.assertIn("/api/inventory/adjust-batch", INDEX)

    def test_bom_flows_fail_closed(self):
        self.assertIn("if(!_bomDataReady)", INDEX)
        self.assertIn("requiresBOMMaterial", INDEX)
        self.assertIn("doPickNoDeduct", INDEX)
        self.assertIn("throw new Error('BOM", INDEX)

    def test_order_pick_is_atomic_and_resumable(self):
        self.assertNotIn("compensateInventoryChange", INDEX)
        self.assertNotIn("rollbackInventoryMoves", INDEX)
        self.assertIn("sourceType:'order_pick_batch'", INDEX)
        self.assertIn("pickingWorkerRequest('/api/picking/create'", INDEX)
        self.assertIn("if(stageResult.completed)", INDEX)
        self.assertIn("if(shortages.length)", INDEX)
        self.assertIn("updateSupabasePickingStatus(pick,'缺料待補'", INDEX)
        self.assertIn("criticalCommitted=true", INDEX)

    def test_manual_pick_and_shopee_bom_are_atomic(self):
        self.assertIn("sourceType:'manual_pick_batch'", INDEX)
        self.assertIn("sourceId:masterId", INDEX)
        self.assertIn("const grouped=[...batchItems.reduce", INDEX)
        self.assertIn("sourceType:'shopee_bom_deduct_batch'", INDEX)
        self.assertIn("const batchMoves=await applyInventoryBatchAndMirror", INDEX)
        self.assertIn("所有料號均未扣除", INDEX)

    def test_batch_idempotency_key_is_fixed_length_hash(self):
        self.assertIn("async function inventoryBatchIdempotencyKey", INDEX)
        self.assertIn("crypto.subtle.digest('SHA-256'", INDEX)
        self.assertIn("const batchKey=await inventoryBatchIdempotencyKey", INDEX)

    def test_corder_stages_record_before_stock_deduction(self):
        start = INDEX.index("async function submitCorder")
        end = INDEX.index("async function", start + 30)
        section = INDEX[start:end]
        self.assertLess(
            section.index("stagedOrder=await"),
            section.index("deductCorderStockByBom"),
        )
        self.assertIn("if(!committed){", section)
        self.assertIn("archiveNotionPageQuietly(stagedOrder?.id)", section)

    def test_workflow_and_notion_mirrors_are_queued(self):
        self.assertIn("queueInventoryNotionMirror", INDEX)
        self.assertIn(
            "queueInventoryNotionMirror(item.pageId,after,item.snap.sku,mirrorError)",
            INDEX,
        )
        self.assertIn("updateWorkflowPageAfterInventory", INDEX)
        self.assertIn("flushInventoryNotionMirrorQueue", INDEX)
        self.assertIn("flushWorkflowNotionSyncQueue", INDEX)

    def test_worker_uses_single_and_batch_atomic_rpcs(self):
        self.assertIn("/rest/v1/rpc/apply_inventory_transaction", WORKER)
        self.assertIn("/rest/v1/rpc/apply_inventory_batch", WORKER)
        self.assertIn("async function erpInventoryBatchAdjust", WORKER)
        self.assertIn("delta > 0", WORKER)
        self.assertIn("createIfMissing = true", WORKER)
        self.assertIn("inventory batch was not changed", WORKER)
        self.assertIn("duplicate: result.duplicate === true", WORKER)

    def test_sql_locks_rows_blocks_negative_and_is_idempotent(self):
        sql = RPC_SQL.lower()
        self.assertIn("for update;", sql)
        self.assertIn("p_quantity_delta < 0 and after_qty < 0", RPC_SQL)
        self.assertIn("delta_qty < 0 and after_qty < 0", RPC_SQL)
        self.assertIn("pg_advisory_xact_lock", RPC_SQL)
        self.assertIn("apply_inventory_batch", RPC_SQL)
        self.assertIn("inventory batch idempotency key is required", sql)
        self.assertIn("to service_role", sql)


if __name__ == "__main__":
    unittest.main()
