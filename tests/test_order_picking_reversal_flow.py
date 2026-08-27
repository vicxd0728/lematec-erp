from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(encoding="utf-8")


def test_blocked_order_delete_offers_guided_picking_reversal():
    assert "openOrderPickingBlockedModal" in INDEX
    assert "renderPickingReversalPreview(rows)" in INDEX
    assert "openOrderPickingReversalAssist" in INDEX
    assert "刪除前需要先回料" in INDEX
    assert "order-reversal-summary" in INDEX
    assert "回料沖銷" in INDEX
    assert "送出回料申請" in INDEX
    assert "確認已回料並完成" in INDEX


def test_reversed_picking_no_longer_blocks_order_edit_or_delete():
    assert "ORDER_PICKING_INACTIVE_STATUSES" in INDEX
    assert "'已沖銷'" in INDEX
    assert "'已退料'" in INDEX
    assert "orderActivePickingRecords" in INDEX


def test_picking_reversal_uses_supabase_batch_with_idempotency_source():
    assert "applyInventoryBatchAndMirror(" in INDEX
    assert "sourceType:'order_pick_reversal'" in INDEX
    assert "領料沖銷" in INDEX
    assert "updateSupabasePickingStatus(pick,'已沖銷'" in INDEX
    assert "skipConfirm:true" in INDEX


def test_order_picking_reversal_is_two_role_return_request_flow():
    assert "ORDER_RETURN_REQUEST_STATUS='待回料確認'" in INDEX
    assert "canConfirmOrderReturnRequest" in INDEX
    assert "submitOrderReturnRequest" in INDEX
    assert "confirmOrderReturnRequestAndContinue" in INDEX
    assert "這一步不改庫存" in INDEX
    assert "等待倉管確認" in INDEX
    assert "notes:pick.note||''" in INDEX
    assert "待回料確認" in WORKER


def test_picking_tab_can_focus_related_order_and_offer_reversal_action():
    assert "window._PICK_FOCUS_ORDER" in INDEX
    assert "已自動定位相關領料單" in INDEX
    assert "顯示全部領料" in INDEX


def test_picking_page_exposes_return_request_work_queue():
    assert "PICKING_RETURN_REQUEST_BOARD_V1" in INDEX
    assert "目前卡關待辦" in INDEX
    assert "只看待回料" in INDEX
    assert "pickingStatusChip('return','待回料確認'" in INDEX
    assert "pickingStatusFilterLabel" in INDEX
    assert "isPickingReturnRequest" in INDEX
    assert "倉管可確認" in INDEX
    assert "業務提出回料申請；倉管確認實物回來；系統才補庫存" in INDEX


def test_order_picking_blocked_modal_has_role_specific_copy():
    assert "業務端" in INDEX
    assert "倉管端" in INDEX
    assert "這一步只送申請，不會修改庫存。" in INDEX
    assert "申請已送出，業務不用再調庫存" in INDEX


def test_worker_allows_completed_picking_to_be_marked_reversed_only():
    assert "'已沖銷'" in WORKER
    assert "'待回料確認'" in WORKER
    assert "!['已領料', '已確認扣料', '待回料確認', '已沖銷', '已退料'].includes(status)" in WORKER


def test_delete_audit_allows_fully_reversed_picking_logs():
    assert "orderDeleteAuditIsResolvedByPickingReversal" in INDEX
    assert "orderAuditPickingIsResolvedByReversal" in INDEX
    assert "isOrderPickingDeductLog" in INDEX
    assert "isOrderPickingReversalLog" in INDEX
    assert "!orderDeleteAuditIsResolvedByPickingReversal(rows)" in INDEX


def test_shopee_cancel_allowed_after_picking_reversal():
    assert "orderCanCancelAfterPickingReversal" in INDEX
    assert "if(orderCanCancelAfterPickingReversal(o?.id))" in INDEX


def test_reversal_can_repair_stale_picking_status_before_blocking_again():
    assert "repairOrderPickingStatusIfReversed" in INDEX
    assert "await repairOrderPickingStatusIfReversed(id,order.no||id)" in INDEX
    assert "const repaired=await repairOrderPickingStatusIfReversed(oid,no)" in INDEX


def test_completed_shopee_stock_in_requires_own_reversal_before_delete():
    assert "buildOrderStockInReversalRows" in INDEX
    assert "reverseOrderStockInAndDelete" in INDEX
    assert "reverseOrderStockInAndCancel" in INDEX
    assert "入庫沖銷後刪除" in INDEX
    assert "入庫沖銷後取消訂單" in INDEX
    assert "skipStockInAudit" in INDEX
    assert "sourceType:'order_stockin_reversal'" in INDEX


def test_delete_audit_includes_related_pick_numbers_and_shortfall_repair():
    assert "const pickRefs=new Set" in INDEX
    assert "pickRefs.has(String(row?.ref_no||''))" in INDEX
    assert "buildOrderPickingShortfallRows" in INDEX
    assert "補回剩餘領料後刪除訂單" in INDEX
    assert "reverseOrderPickingShortfallAndDelete" in INDEX
    assert "sourceType:'order_pick_reversal_shortfall'" in INDEX


def test_picking_status_constraint_migration_accepts_reversal_states():
    migration = (ROOT / "supabase/migrations/20260827_002_pick_return_request_status.sql").read_text(encoding="utf-8")
    assert "pick_lists_status_check" in migration
    assert "'待回料確認'" in migration
    assert "'已沖銷'" in migration
    assert "'已退料'" in migration
    workflow = (ROOT / ".github/workflows/supabase-pick-reversal-status.yml").read_text(encoding="utf-8")
    assert "20260827_002_pick_return_request_status.sql" in workflow
