from pathlib import Path


ROOT = Path(__file__).parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


def section(start: str, end: str) -> str:
    a = INDEX.index(start)
    b = INDEX.index(end, a)
    return INDEX[a:b]


def test_note_thread_reply_edit_button_only_in_detail_context():
    formatter = section("function parseNoteReplyLine", "function noteRelationSummary")
    detail = section("async function openNoteDetail", "async function resyncNoteCustomer")
    assert "function noteCanEditReplyLine" in formatter
    assert "openNoteReplyEdit" in formatter
    assert "修正" in formatter
    assert "formatNoteThread(n.replies,{},n.id)" in detail


def test_reply_edit_modal_preserves_original_reply_context():
    edit_modal = section("function openNoteReplyEdit", "async function submitNoteReplyEdit")
    assert "修正回覆" in edit_modal
    assert "note_reply_edit_action" in edit_modal
    assert "note_reply_edit_text" in edit_modal
    assert "儲存修正並通知" in edit_modal
    assert "沒有權限修正這則回覆" in edit_modal


def test_reply_edit_writes_primary_and_renotifies_audience():
    submit = section("async function submitNoteReplyEdit", "async function submitNoteReply(id")
    assert "await writeNotePrimary" in submit
    assert "action:'修正回覆'" in submit
    assert "const notifyRoles=noteAudienceRoles(n).filter" in submit
    assert "pendingRoles:notifyRoles.join" in submit
    assert "replyAction:'修正回覆'" in submit
    assert "queueNoteNotionMirror(n,'upsert')" in submit
    assert "已重新通知" in submit
