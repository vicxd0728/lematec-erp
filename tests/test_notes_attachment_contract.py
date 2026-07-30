from pathlib import Path
import unittest


ROOT = Path(__file__).parents[1]


class NotesAttachmentContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.worker = (
            ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js"
        ).read_text(encoding="utf-8")

    def test_form_accepts_multiple_arbitrary_files(self):
        self.assertIn('id="note_files" type="file" multiple', self.index)
        self.assertIn("圖片、影片、文件或其他檔案", self.index)
        self.assertNotIn('id="note_files" type="file" accept=', self.index)

    def test_direct_upload_limits_do_not_block_note_creation(self):
        self.assertIn("const NOTE_MAX_ATTACHMENTS=5", self.index)
        self.assertIn("const NOTE_MAX_ATTACHMENT_BYTES=20*1024*1024", self.index)
        self.assertIn("const oversizedFiles=noteFiles.filter", self.index)
        self.assertIn("const uploadableFiles=noteFiles.filter", self.index)
        self.assertNotIn(
            "附件 ${oversize.name} 超過 20MB，請先壓縮或改用雲端連結",
            self.index,
        )
        self.assertIn("開啟 Notion 原始頁", self.index)

    def test_supported_preview_types_and_generic_download(self):
        for block_type in ("image", "video", "audio", "pdf", "file"):
            self.assertIn(f"'{block_type}'", self.index)
        self.assertIn("<video controls playsinline", self.index)
        self.assertIn("<audio controls", self.index)
        self.assertIn("📎 ${name}", self.index)

    def test_partial_failure_is_reported_without_losing_the_note(self):
        self.assertIn("const outcome={uploaded:[],failed:[]}", self.index)
        self.assertIn("outcome.failed.push", self.index)
        self.assertIn("記事內容不會因附件失敗而遺失", self.index)
        self.assertIn("showNoteAttachmentOutcome", self.index)

    def test_worker_validates_size_and_retries_transient_notion_errors(self):
        self.assertIn("NOTION_DIRECT_UPLOAD_MAX_BYTES", self.worker)
        self.assertIn("FILE_TOO_LARGE", self.worker)
        self.assertIn("RETRYABLE_UPSTREAM_STATUSES", self.worker)
        self.assertIn("new Set([429, 500, 502, 503, 504])", self.worker)
        self.assertIn("fetchWithRetry", self.worker)
        self.assertIn("Retry-After", self.worker)


if __name__ == "__main__":
    unittest.main()
