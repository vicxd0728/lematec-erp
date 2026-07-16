from pathlib import Path

import sync_busa16_regulator_bom as sync


def part(code):
    return code if code.startswith("Y-") else "Y-" + code


sync.SOURCE_SHEET = "濾水器"
sync.REPORT_PATH = Path(__file__).resolve().parent / ".tmp_busa16_filter_sync_report.json"
sync.SYNC_NOTE = "BUSA16 濾水器 BOM 同步 2026-07-15"

sync.FINISHED_LABELS = {
    "Z-FLT-C1": "Z-FLT-C1",
    "Z-FLT-B-C1": "Z-FLT-B-C1",
    "Z-FLT-B-C5": "Z-FLT-B-C5",
    "Z-FLT-D-C1": "Z-FLT-D-C1",
    "Z-FLT-BR1-C1": "Z-FLT-BR1-C1",
    "Z-FLT-BR1A-C1": "Z-FLT-BR1A-C1",
    "Z-FLT-BR2-C1": "Z-FLT-BR2-C1",
    "Z-FLT-BR2A-C1": "Z-FLT-BR2A-C1",
}

sync.TYPE_OVERRIDES = {
    code: sync.TYPE_FINISHED for code in sync.FINISHED_LABELS
}

sync.ALIASES = {
    "Z-FLT-BR1A-C1": ["Z-FLT-BR1A"],
    "Z-FLT-BR2A-C1": ["Z-FLT-BR2A"],
    "Y-MW-01-1B": ["Y-MW-1-1B", "MW-01-1B", "MW-1-1B"],
    "Y-MW-01-1A": ["Y-MW-1-1A", "MW-01-1A", "MW-1-1A"],
    "Y-MW-02": ["Y-MW-2", "MW-02", "MW-2"],
    "Y-MW-03": ["Y-MW-3", "MW-03", "MW-3"],
    "Y-MW-03-1": ["Y-MW-3-1", "MW-03-1", "MW-3-1"],
    "Y-MW-09": ["Y-MW-9", "MW-09", "MW-9"],
}

sync.TARGET_BOM = {
    "F-MW-07": {
        part("MW-07A"): 1,
        part("MW-07-1"): 1,
        part("AB-09"): 1,
        part("LED-08-3"): 1,
    },
    "F-MW-06-2+3": {
        part("MW-06-2"): 1,
        part("MW-06-3"): 1,
        part("AB-09"): 1,
        part("SW-04"): 1,
    },
    "F-MW-06-1": {
        part("MW-01B"): 1,
        part("MW-06-1-ZN"): 1,
        "F-MW-06-2+3": 1,
        part("MW-06-4"): 1,
    },
    "Z-FLT-C1": {
        part("MW-11"): 1,
        part("MW-12"): 1,
        part("MW-02"): 1,
        part("SRGT-08"): 1,
        part("P-16A"): 1,
        part("MW-03"): 1,
        part("MW-03-1"): 1,
        part("MW-04"): 1,
        part("MW-08D"): 1,
        part("FLT-D-01-1"): 1,
        part("DTM-09-1"): 1,
        part("MW-09-1"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-FLT-B-C1": {
        part("MW-01-1B"): 1,
        part("MW-01A"): 1,
        part("MW-02"): 1,
        part("P-16A"): 1,
        part("MW-03"): 1,
        part("MW-03-1"): 1,
        part("MW-04"): 1,
        part("MW-05"): 1,
        part("DTM-09-1"): 1,
        "F-MW-07": 1,
        part("MW-09"): 2,
        part("DTK-02"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-FLT-B-C5": {
        part("MW-01-1B"): 1,
        part("MW-01A"): 1,
        part("MW-02"): 1,
        part("P-16A"): 1,
        part("MW-03"): 1,
        part("MW-03-1"): 1,
        part("MW-04"): 1,
        part("MW-05"): 1,
        part("DTM-09-1"): 1,
        "F-MW-07": 1,
        part("MW-09"): 2,
        part("DTK-02"): 1,
        part("SPA-14-1"): 1,
        part("L-23"): 1,
    },
    "Z-FLT-D-C1": {
        part("FLT-D-1A"): 1,
        part("FLT-D-1-1"): 1,
        part("DTM-09-1"): 1,
        part("FLT-D-02A"): 1,
        part("FLT-D-03"): 1,
        part("FLT-D-04"): 2,
        part("FLT-D-05"): 1,
        part("FLT-D-07"): 1,
        part("FLT-D-08"): 2,
        part("FLT-D-10"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-FLT-BR1-C1": {
        part("MW-01-1B"): 1,
        part("MW-02"): 1,
        part("P-16A"): 1,
        part("MW-03"): 1,
        part("MW-03-1"): 1,
        part("MW-04"): 1,
        part("MW-05-1"): 1,
        "F-MW-06-1": 1,
        "F-MW-07": 1,
        part("MW-09"): 2,
        part("DTK-02"): 1,
        part("DTM-09-1"): 1,
        "Z-AR-05": 1,
        part("SPA-14-1"): 1,
    },
    "Z-FLT-BR1A-C1": {
        part("MW-01-1A"): 1,
        part("MW-02"): 1,
        part("P-16A"): 1,
        part("MW-03"): 1,
        part("MW-03-1"): 1,
        part("MW-04"): 1,
        part("MW-05-1"): 1,
        "F-MW-06-1": 1,
        "F-MW-07": 1,
        part("MW-09"): 2,
        part("DTK-02"): 1,
        part("DTM-09-1"): 1,
        "Z-AR-05": 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
    },
    "Z-FLT-BR2-C1": {
        part("MW-01-1B"): 1,
        part("MW-02"): 1,
        part("P-16A"): 1,
        part("MW-03"): 1,
        part("MW-03-1"): 1,
        part("MW-04"): 1,
        part("MW-05-1"): 1,
        "F-MW-06-1": 1,
        "F-MW-07": 1,
        part("MW-09"): 2,
        part("DTK-02"): 1,
        part("DTM-09-1"): 1,
        "F-GAB-3D-B": 1,
        part("SPA-14-1"): 1,
    },
    "Z-FLT-BR2A-C1": {
        part("MW-01-1A"): 1,
        part("MW-02"): 1,
        part("P-16A"): 1,
        part("MW-03"): 1,
        part("MW-03-1"): 1,
        part("MW-04"): 1,
        part("MW-05-1"): 1,
        "F-MW-06-1": 1,
        "F-MW-07": 1,
        part("MW-09"): 2,
        part("DTK-02"): 1,
        part("DTM-09-1"): 1,
        "F-GAB-3D-B": 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
    },
}


if __name__ == "__main__":
    sync.main()
