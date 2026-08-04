from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


def function_section(name: str) -> str:
    marker = f"async function {name}("
    start = INDEX.index(marker)
    end = INDEX.index("\n}\n", start) + 3
    return INDEX[start:end]


class CorderExcelImportContractTests(unittest.TestCase):
    def test_source_row_uses_declared_sheet_row_index(self):
        section = function_section("importShopeeExcel")

        self.assertRegex(
            section,
            re.compile(
                r"for\s*\(\s*const\s*\[\s*sourceIndex\s*,\s*row\s*\]\s*"
                r"of\s*rows\.entries\(\)\s*\)"
            ),
        )
        self.assertIn("sourceRow:sourceIndex+2", section)

    def test_import_preserves_bad_quantity_for_preflight_error(self):
        section = function_section("importShopeeExcel")
        self.assertIn("const qtyText=rowVal(row,['數量','商品數量'])", section)
        self.assertIn("const parsedQty=qtyText?parseInt(qtyText):1", section)
        self.assertIn("const qty=Number.isFinite(parsedQty)?parsedQty:0", section)

    def test_preflight_v2_marks_duplicates_and_row_targets(self):
        preflight = INDEX[
            INDEX.index("function buildCorderImportPreflight") :
            INDEX.index("function openCorderImportPreflightModal")
        ]
        modal = INDEX[
            INDEX.index("function openCorderImportPreflightModal") :
            INDEX.index("async function applyCorderImportPreflight")
        ]
        self.assertIn("duplicateDetails", preflight)
        self.assertIn("duplicateInFile", preflight)
        self.assertIn("firstErrorRow", preflight)
        self.assertIn("買家帳號空白", preflight)
        self.assertIn("數量需大於 0", preflight)
        self.assertIn("可匯入 / 會略過", modal)
        self.assertIn("跳到第一個錯誤", modal)
        self.assertIn("id=\"corder-import-row-${row.sourceRow}\"", modal)
        self.assertIn("preflight-detail-table", modal)


if __name__ == "__main__":
    unittest.main()
