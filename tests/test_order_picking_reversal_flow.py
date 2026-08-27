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
    assert "回料後刪除" in INDEX


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


def test_picking_tab_can_focus_related_order_and_offer_reversal_action():
    assert "window._PICK_FOCUS_ORDER" in INDEX
    assert "已自動定位相關領料單" in INDEX
    assert "顯示全部領料" in INDEX


def test_worker_allows_completed_picking_to_be_marked_reversed_only():
    assert "'已沖銷'" in WORKER
    assert "!['已領料', '已確認扣料', '已沖銷'].includes(status)" in WORKER


def test_delete_audit_allows_fully_reversed_picking_logs():
    assert "orderDeleteAuditIsResolvedByPickingReversal" in INDEX
    assert "isOrderPickingDeductLog" in INDEX
    assert "isOrderPickingReversalLog" in INDEX
    assert "!orderDeleteAuditIsResolvedByPickingReversal(rows)" in INDEX


def test_shopee_cancel_allowed_after_picking_reversal():
    assert "orderCanCancelAfterPickingReversal" in INDEX
    assert "if(orderCanCancelAfterPickingReversal(o?.id))" in INDEX
