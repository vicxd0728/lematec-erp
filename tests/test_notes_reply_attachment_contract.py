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
    assert "const replyKey=noteReplyAttachmentKeyFromParts" in submit
    assert "await writeNotePrimary" in submit
    assert "_notesNotionPendingFiles[n.id]=uploadableFiles" in submit
    assert "_notesNotionPendingAttachmentContexts[n.id]={replyKey}" in submit
    assert "queueNoteNotionMirror(n,'upsert')" in submit
    assert "flushNotesNotionMirrorQueue({quiet:true})" in submit


def test_reply_attachments_are_marked_and_rendered_inline_with_thread():
    attachment_helpers = section("function noteAttachmentName", "async function countNoteAttachmentBlocks")
    formatter = section("function formatNoteThread", "function noteRelationSummary")
    detail = section("async function openNoteDetail", "async function resyncNoteCustomer")
    mirror = section("async function flushNotesNotionMirrorQueue", "async function loadLiveNoteConversation")
    assert "ERP_REPLY_ATTACHMENT" in attachment_helpers
    assert "noteAttachmentReplyKey" in attachment_helpers
    assert "noteGroupAttachmentsByReply" in attachment_helpers
    assert "noteReplyAttachmentGrid" in attachment_helpers
    assert "formatNoteThread(text='',attachmentsByKey={},noteId='')" in formatter
    assert "noteReplyAttachmentGrid(attachmentsByKey[key])" in formatter
    assert 'id="note_thread_box"' in detail
    assert "loadNoteAttachments(n.actualNotionPageId,n.files||[],n)" in detail
    assert "uploadNoteAttachments(notionId,files,_notesNotionPendingAttachmentContexts[task.noteKey]||{})" in mirror


def test_file_selection_renderer_supports_reply_target():
    renderer = section("function renderNoteFileSelection", "function formatNoteFileSize")
    assert "input?.dataset?.selectionTarget" in renderer
    assert "'note_file_selection'" in renderer
