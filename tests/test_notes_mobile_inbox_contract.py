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


class NotesMobileInboxContractTests(unittest.TestCase):
    def test_mobile_inbox_is_rendered_before_calendar(self):
        body = function_body("renderNotes")
        self.assertIn("renderNoteMobileInbox({data,myTodo,dueList,openList,selectedList,canAdd})", body)
        self.assertLess(body.index("renderNoteMobileInbox"), body.index("note-layout"))
        self.assertIn("window._NOTE_MOBILE_VIEW=window._NOTE_MOBILE_VIEW||(pendingAck?'todo':'all')", body)

    def test_mobile_inbox_keeps_simple_staff_views(self):
        body = function_body("renderNoteMobileInbox")
        for phrase in ["我的待辦", "提醒到期", "今日記事", "全部未完成", "月曆檢視"]:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)
        self.assertIn("點卡片可看完整對話與附件", body)
        self.assertIn("往下可用月曆選日期", body)
        self.assertIn("openModal('newNote')", body)
        self.assertIn("renderNoteList(active.list,true)", body)

    def test_mobile_css_prioritizes_inbox_without_removing_desktop_sections(self):
        self.assertIn(".note-mobile-inbox{display:none}", INDEX)
        self.assertIn(".note-mobile-inbox{display:block}", INDEX)
        self.assertIn(".note-layout,.note-desktop-section{display:none}", INDEX)
        self.assertIn(".note-layout.note-mobile-calendar{display:grid}", INDEX)
        self.assertIn("note-mobile-calendar", function_body("renderNotes"))
        self.assertIn("note-desktop-section", function_body("renderNotes"))

    def test_reply_attachment_and_reply_edit_contracts_still_exist(self):
        reply = function_body("openNoteReply")
        submit = function_body("submitNoteReplyPrimary")
        edit = function_body("openNoteReplyEdit")
        self.assertIn('id="note_reply_files" type="file" multiple', reply)
        self.assertIn("_notesNotionPendingAttachmentContexts[n.id]={replyKey}", submit)
        self.assertIn("note_reply_edit_text", edit)


if __name__ == "__main__":
    unittest.main()
