from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def read_index():
    return INDEX.read_text(encoding="utf-8")


def test_operations_analytics_tab_is_registered_for_operational_roles():
    html = read_index()
    assert "analytics:'📈 營運分析'" in html
    for role in ("vic", "manager", "sales", "warehouse", "purchase"):
        role_line = next(line for line in html.splitlines() if f"{role}:" in line)
        assert "'analytics'" in role_line


def test_operations_analytics_tab_loads_own_data_sources():
    html = read_index()
    assert "tab==='analytics'" in html
    assert "analyticsDataReady()" in html
    assert "loadAnalyticsData()" in html
    assert "renderAnalytics()" in html
    assert "loadCorders()" in html
    assert "loadStockLog({mode:'recent'})" in html
    assert "'schedule','analytics'" in html


def test_operations_analytics_uses_existing_read_only_data():
    html = read_index()
    start = html.index("function buildOperationsAnalytics()")
    end = html.index("function renderStockLog()", start)
    block = html[start:end]
    for token in ("orders", "window.corders", "stockLogs", "mats", "boms"):
        assert token in block
    assert "buildStockLogAuditReport(stockLogs)" in block
    assert "applyInventoryDeltaAndMirror" not in block
    assert "notionAPI('POST'" not in block
    assert "notionAPI('PATCH'" not in block


def test_operations_analytics_has_actionable_sections():
    html = read_index()
    start = html.index("function renderAnalytics()")
    end = html.index("function renderStockLog()", start)
    block = html[start:end]
    for label in ("訂單狀態", "C端狀態", "用料耗用排行", "庫存決策提示", "資料品質與半自動修正入口"):
        assert label in block
    nav_start = html.index("function analyticsGo(")
    nav_block = html[nav_start:end]
    for tab in ("orders", "corders", "inventory", "stocklog"):
        assert f"switchTab(tab)" in nav_block
        assert f"tab==='{tab}'" in nav_block


def test_operations_analytics_includes_corder_return_analysis():
    html = read_index()
    start = html.index("function analyticsCorderReturnEvents")
    end = html.index("function renderStockLog()", start)
    block = html[start:end]
    for label in ("C端退貨率", "C端退貨原因", "C端退貨品項", "退貨原因"):
        assert label in block
    for reason in ("買錯/不需要該產品", "故障", "寄錯產品", "其他"):
        assert reason in html
    assert "analyticsReturnReasonLabel" in block
    assert "cReturnReasons" in block
    assert "cReturnProducts" in block
    assert "analyticsGo('corders','search','退貨')" in block
