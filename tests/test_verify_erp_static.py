from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts/verify_erp_static.py"
SPEC = importlib.util.spec_from_file_location("verify_erp_static", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class VerifyErpStaticTest(unittest.TestCase):
    def fixture(self, root: Path) -> None:
        (root / "icons").mkdir()
        (root / ".github/workflows").mkdir(parents=True)
        (root / "icons/icon.png").write_bytes(b"png")
        (root / "manifest.webmanifest").write_text(
            json.dumps({"icons": [{"src": "./icons/icon.png"}]}), encoding="utf-8"
        )
        (root / "sw.js").write_text("const ASSETS=['./erp-action-receipts.js']; self.addEventListener('fetch', () => {});", encoding="utf-8")
        (root / "erp-action-receipts.js").write_text("window.erpActionReceipts={};", encoding="utf-8")
        (root / "_headers").write_text("/*\n  X-Test: yes\n", encoding="utf-8")
        (root / "_redirects").write_text("/* /index.html 200\n", encoding="utf-8")
        db = "\n".join(f"  {key}: 'fixture'," for key in sorted(MODULE.REQUIRED_DB_KEYS))
        (root / "index.html").write_text(
            '<link rel="manifest" href="./manifest.webmanifest">\n'
            "<script>const DB={\n" + db + "\n};\nconst FIRST_LOAD_DAYS=30;\n"
            + MODULE.INDEX_REPLACEMENT_GUARD + "</script>\n"
            '<script src="./erp-action-receipts.js"></script>\n'
            "<script>navigator.serviceWorker.register('./sw.js')</script>", encoding="utf-8"
        )
        assets = "\n".join(f"cp {name}" for name in MODULE.REQUIRED_DEPLOY_FILES)
        (root / ".github/workflows/cloudflare-pages.yml").write_text(
            assets + "\ncp -R icons _publish/icons\n", encoding="utf-8"
        )

    def test_valid_fixture(self) -> None:
        with tempfile.TemporaryDirectory(prefix="erp-static-test-") as folder:
            root = Path(folder)
            self.fixture(root)
            result = MODULE.verify(root)
            self.assertTrue(result["strict_utf8"])
            self.assertEqual(result["first_load_days"], 30)

    def test_missing_asset_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="erp-static-test-") as folder:
            root = Path(folder)
            self.fixture(root)
            (root / "sw.js").unlink()
            with self.assertRaisesRegex(ValueError, "missing deploy assets"):
                MODULE.verify(root)

    def test_replacement_character_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="erp-static-test-") as folder:
            root = Path(folder)
            self.fixture(root)
            (root / "sw.js").write_text("bad \ufffd", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "replacement character"):
                MODULE.verify(root)


if __name__ == "__main__":
    unittest.main()
