from pathlib import Path

import sync_busa16_regulator_bom as sync


def part(code):
    return code if code.startswith("Y-") else "Y-" + code


sync.SOURCE_SHEET = "濾水器 (2)"
sync.REPORT_PATH = Path(__file__).resolve().parent / ".tmp_busa16_filter2_sync_report.json"
sync.SYNC_NOTE = "BUSA16 濾水器 (2) BOM 同步 2026-07-15"

sync.FINISHED_LABELS = {
    "Z-FLT-E-02": "Z-FLT-E-02 (FLT-E-2)",
    "Z-FLT-E-03": "Z-FLT-E-03 (FLT-E-3)",
    "Z-FLT-G": "Z-FLT-G (FLT-G)",
    "Z-FLT-GR1": "Z-FLT-GR1 (FLT-GR1)",
}

sync.TYPE_OVERRIDES = {
    code: sync.TYPE_FINISHED for code in sync.FINISHED_LABELS
}

sync.ALIASES = {
    "Z-FLT-E-02": ["Z-FLT-E-2", "FLT-E-2"],
    "Z-FLT-E-03": ["Z-FLT-E-3", "FLT-E-3"],
    "Z-FLT-G": ["FLT-G"],
    "Z-FLT-GR1": ["FLT-GR1"],
    "F-FLT-E-05+6A": ["FLT-E-05+6A"],
    "F-MW-06-2+3": ["MW-06-2+3"],
    "Z-AR-05": ["AR-05"],
}

sync.TARGET_BOM = {
    "F-FLT-E-06+SKC-18": {
        part("FLT-E-06"): 1,
        part("SKC-18"): 1,
    },
    "F-FLT-E-06A+SKC-18": {
        part("FLT-E-06"): 1,
        part("SKC-18"): 1,
    },
    "F-FLT-E-05+6": {
        part("FLT-E-05"): 1,
        "F-FLT-E-06+SKC-18": 1,
        part("FLT-E-06"): 1,
    },
    "F-FLT-E-05+6A": {
        part("FLT-E-05"): 1,
        "F-FLT-E-06A+SKC-18": 1,
        part("FLT-E-06"): 1,
    },
    # Repeated on this sheet, but the complete definition comes from 濾水器.
    "F-MW-07": {
        part("MW-07A"): 1,
        part("MW-07-1"): 1,
        part("AB-09"): 1,
        part("LED-08-3"): 1,
    },
    "Z-FLT-E-02": {
        part("FLT-E-01"): 1,
        part("FLT-E-02"): 1,
        part("FLT-E-03"): 1,
        part("FLT-E-04"): 1,
        "F-FLT-E-05+6": 1,
        part("FLT-D-07"): 1,
    },
    "Z-FLT-E-03": {
        part("FLT-E-01A"): 1,
        part("FLT-E-02"): 1,
        part("FLT-E-03"): 1,
        part("FLT-E-04"): 1,
        "F-FLT-E-05+6A": 1,
        part("FLT-D-07"): 1,
    },
    "Z-FLT-G": {
        part("MW-15"): 1,
        part("MW-16"): 1,
        "F-MW-07": 1,
        part("MW-17"): 1,
        part("MW-18"): 1,
        part("MW-19"): 1,
    },
    "Z-FLT-GR1": {
        part("MW-15A"): 1,
        part("MW-16"): 1,
        "F-MW-07": 1,
        part("MW-17A"): 1,
        part("MW-18"): 1,
        part("MW-19"): 1,
        part("MW-06-1-ZN"): 1,
        "F-MW-06-2+3": 1,
        part("MW-06-4"): 1,
        "Z-AR-05": 1,
    },
}


if __name__ == "__main__":
    sync.main()
