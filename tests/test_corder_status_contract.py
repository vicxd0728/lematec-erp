from pathlib import Path
import re
import unittest


ROOT = Path(__file__).parents[1]


class CorderStatusContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")

    def test_recent_filter_uses_only_real_cancelled_status(self):
        match = re.search(
            r"function corderRecentFilter\(\)\{(?P<body>.*?)\n\}",
            self.index,
            re.DOTALL,
        )
        self.assertIsNotNone(match)
        body = match.group("body")
        status = "\u72c0\u614b"
        cancelled = "\u5df2\u53d6\u6d88"
        legacy_cancelled = "\u53d6\u6d88"
        self.assertIn(f"activeStatusFilter('{status}','{cancelled}')", body)
        self.assertNotIn(f"activeStatusFilter('{status}','{legacy_cancelled}')", body)

    def test_corder_status_options_keep_completed_and_cancelled_values(self):
        shipping = "\u51fa\u8ca8\u4e2d"
        completed = "\u5df2\u5b8c\u6210"
        partial_return = "\u90e8\u5206\u9000\u8ca8"
        returned = "\u5df2\u9000\u8ca8"
        cancelled = "\u5df2\u53d6\u6d88"
        self.assertIn(
            f"['{shipping}','{completed}','{partial_return}','{returned}','{cancelled}']",
            self.index,
        )


if __name__ == "__main__":
    unittest.main()
