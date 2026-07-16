from pathlib import Path

import sync_busa16_regulator_bom as sync


def part(code):
    return code if code.startswith("Y-") else "Y-" + code


sync.SOURCE_SHEET = "噴砂槍"
sync.REPORT_PATH = Path(__file__).resolve().parent / ".tmp_busa16_sandblaster_sync_report.json"
sync.SYNC_NOTE = "BUSA16 噴砂槍 BOM 同步 2026-07-15"

sync.FINISHED_LABELS = {
    "F-SKC-A-01AS-2": "F-SKC-A-01AS-2",
    "Z-SKC-A-08AS": "Z-SKC-A-08AS",
    "Z-SKC-A-01AS-1ABF": "Z-SKC-A-01AS-1ABF",
    "Z-SKC-A-03AS-1ABF": "Z-SKC-A-03AS-1ABF",
    "Z-SKC-A-06AS-D-1ABF": "Z-SKC-A-06AS-D-1ABF",
    "Z-SKC-A-08ASF": "Z-SKC-A-08ASF",
}

sync.TYPE_OVERRIDES = {
    code: "成品" for code in sync.FINISHED_LABELS
}

sync.ALIASES = {
    "Z-SKC-A-01AS-1ABF": ["Z-SKC-A-1AS-1ABF"],
    "Z-SKC-A-03AS-1ABF": ["Z-SKC-A-3AS-1ABF"],
    "Z-SKC-A-06AS-D-1ABF": ["Z-SKC-A-6AS-D-1ABF"],
    "Z-SKC-A-08ASF": ["Z-SKC-A-8ASF"],
    "Y-SKC-02C#09": ["Y-SKC-2C#09", "SKC-02C#09", "SKC-2C#09"],
    "Y-SKC-1D-2": ["Y-SKC-01D-2", "SKC-1D-2", "SKC-01D-2"],
}

sync.TARGET_BOM = {
    "F-SKC-01D": {
        part("SKC-01D"): 1,
        part("SKC-04-1"): 1,
    },
    "F-SKC-07+10": {
        part("SKC-07"): 1,
        part("SKC-10"): 1,
        part("AB-09"): 2,
        part("P-16A"): 1,
    },
    "F-SKC-13*2+14": {
        part("SKC-13"): 2,
        part("SKC-14"): 1,
    },
    "F-SKC-04-3+LE-18": {
        part("SKC-04-3"): 1,
        part("LE-18"): 1,
    },
    "F-SKC-A-01AS-1": {
        "F-SKC-01D": 1,
        "F-SKC-07+10": 1,
        part("SKC-11"): 1,
        "F-SKC-13*2+14": 1,
        part("SKC-15"): 1,
        part("SKC-19"): 1,
        "F-SKC-04-3+LE-18": 1,
    },
    # These are direct items in the final picking sections, not BOM headers.
    "F-SKC-A-01AS-2": {},
    "F-SKC-01D-2": {
        part("SKC-1D-2"): 1,
        part("SKC-04-1"): 1,
    },
    "F-SKC-14-1+23": {
        part("SKC-14-1"): 1,
        part("SKC-13"): 2,
        part("SKC-15"): 1,
        part("SKC-23"): 1,
    },
    "F-SKC-A-08AS": {
        "F-SKC-01D-2": 1,
        "F-SKC-07+10": 1,
        part("SKC-11"): 1,
        "F-SKC-13*2+14": 1,
        "F-SKC-14-1+23": 1,
        part("SKC-15"): 1,
        part("SKC-19"): 1,
        "F-SKC-04-3+LE-18": 1,
    },
    "Z-SKC-A-08AS": {},
    "Z-SKC-A-01AS-1ABF": {
        "F-SKC-A-01AS-2": 1,
        "F-SKC-A-01AS-1": 1,
        part("SKC-02C#09"): 1,
        part("SKC-03D"): 1,
        part("SKC-06"): 1,
        part("SKC-12D"): 1,
        part("SKC-16"): 1,
        part("AB-02"): 1,
        "F-SKC-04-3+LE-18": 1,
        part("SKC-04"): 4,
        part("SKC-20"): 1,
        part("SKC-21"): 1,
        part("SKC-22"): 1,
        part("SPA-09E"): 1,
    },
    "Z-SKC-A-03AS-1ABF": {
        "F-SKC-A-01AS-2": 1,
        "F-SKC-A-01AS-1": 1,
        part("SKC-02C#09"): 1,
        part("SKC-03D"): 1,
        part("SKC-06"): 1,
        part("SKC-12D"): 1,
        part("SKC-16"): 1,
        part("AB-02"): 1,
        "F-SKC-04-3+LE-18": 2,
        part("SBG-06Q"): 1,
        part("SKC-20"): 1,
        part("SKC-21"): 1,
        part("SKC-22"): 1,
        part("SKC-26"): 1,
        part("SPA-09E"): 1,
    },
    "Z-SKC-A-06AS-D-1ABF": {
        "F-SKC-A-01AS-2": 1,
        "F-SKC-A-01AS-1": 1,
        part("SKC-2D#10"): 1,
        part("SKC-03D"): 1,
        part("SKC-06"): 1,
        part("SKC-12D"): 1,
        part("SKC-16"): 1,
        part("AB-02"): 1,
        part("SKC-04"): 2,
        part("SKC-05A"): 1,
        part("SKC-20"): 1,
        part("SKC-21"): 1,
        part("SKC-22"): 1,
        part("SKC-26"): 1,
        part("SPA-09E"): 1,
    },
    "Z-SKC-A-08ASF": {
        "Z-SKC-A-08AS": 1,
        "F-SKC-A-08AS": 1,
        part("SKC-02C#09"): 1,
        part("SKC-03D"): 1,
        part("SKC-06"): 1,
        part("SKC-12D"): 1,
        part("SKC-16"): 1,
        part("AB-02"): 1,
        "F-SKC-04-3+LE-18": 1,
        part("SBG-06Q"): 1,
        part("LE-19"): 1,
        part("LE-20-1"): 1,
        part("SPA-09E"): 1,
    },
}


if __name__ == "__main__":
    sync.main()
