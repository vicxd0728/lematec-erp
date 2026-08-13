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


class CorderCompletedEditContractTests(unittest.TestCase):
    def test_completed_corder_edit_uses_current_page_exclusion(self):
        helper = function_body("corderInternalNoExists")
        self.assertIn("currentKey=normalizeNotionIdForCompare(currentId)", helper)
        self.assertIn("normalizeNotionIdForCompare(p.id)!==currentKey", helper)

    def test_corder_edit_can_write_ship_date(self):
        body = function_body("saveEditCorder")
        self.assertIn("const shipDate=document.getElementById('eco_ship_date')", body)
        self.assertIn("if(shipDate) props['出日']={date:{start:shipDate}};", body)
        self.assertIn("await updatePage(id,props)", body)

    def test_corder_edit_does_not_allocate_number_or_mutate_inventory(self):
        body = function_body("saveEditCorder")
        self.assertNotIn("reserveCorderNumbers", body)
        self.assertNotIn("deductCorderStockByBom", body)
        self.assertNotIn("returnCorderStock", body)
        self.assertNotIn("/api/corder/number-reserve", body)

    def test_edit_button_is_not_limited_to_shipping_status(self):
        render_body = function_body("renderCorders")
        self.assertIn("const actions=canOperate&&o.status==='出貨中'", render_body)
        self.assertIn("const manage=canOperate?`<div class=\"corder-actions\">", render_body)
        self.assertIn("openEditCorder('${o.id}')", render_body)


if __name__ == "__main__":
    unittest.main()
