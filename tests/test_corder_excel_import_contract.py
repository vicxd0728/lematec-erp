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


if __name__ == "__main__":
    unittest.main()
