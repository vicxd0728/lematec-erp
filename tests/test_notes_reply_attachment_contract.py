from pathlib import Path


ROOT = Path(__file__).parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


def section(start: str, end: str) -> str:
    a = INDEX.index(start)
    b = INDEX.index(end, a)
    return INDEX[a:b]


def test_note_reply_modal_accepts_multiple_files():
    modal = section("function openNoteReply", "async function submitNoteReplyPrimary")
    assert 'id="note_reply_files" type="file" multiple' in modal
    assert 'data-selection-target="note_reply_file_selection"' in modal
    assert "回覆附件" in modal
    assert "單次最多 5 個，每個 20MB 以內" in modal


def test_note_reply_submit_queues_attachments_after_primary_write():
    submit = section("async function submitNoteReplyPrimary", "async function completeNote")
    assert "document.getElementById('note_reply_files')" in submit
    assert "replyFiles.length>NOTE_MAX_ATTACHMENTS" in submit
    assert "const uploadableFiles=replyFiles.filter" in submit
    assert "const replyAttachmentNote=uploadableFiles.length" in submit
    assert "await writeNotePrimary" in submit
    assert "_notesNotionPendingFiles[n.id]=uploadableFiles" in submit
    assert "queueNoteNotionMirror(n,'upsert')" in submit
    assert "flushNotesNotionMirrorQueue({quiet:true})" in submit


def test_file_selection_renderer_supports_reply_target():
    renderer = section("function renderNoteFileSelection", "function formatNoteFileSize")
    assert "input?.dataset?.selectionTarget" in renderer
    assert "'note_file_selection'" in renderer
