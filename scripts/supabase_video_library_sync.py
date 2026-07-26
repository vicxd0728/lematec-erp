from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "supabase" / "video_library"
DB_ENV_NAMES = ("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL")
CHANNEL_URLS = {
    "長影片": "https://www.youtube.com/@lematecprotools/videos",
    "Shorts": "https://www.youtube.com/@lematecprotools/shorts",
    "直播": "https://www.youtube.com/@lematecprotools/streams",
}
CHANNEL_ID = "UCeWrmRQ-mTIZPykcgbiVnHQ"
CHANNEL_TITLE = "LEMATEC Pro Tools"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def video_id_from_url(url: str) -> str:
    for pattern in (
        r"[?&]v=([a-zA-Z0-9_-]{6,})",
        r"youtu\.be/([a-zA-Z0-9_-]{6,})",
        r"youtube\.com/shorts/([a-zA-Z0-9_-]{6,})",
        r"youtube\.com/embed/([a-zA-Z0-9_-]{6,})",
    ):
        m = re.search(pattern, url or "")
        if m:
            return m.group(1)
    return ""


def load_seed_metadata() -> dict[str, dict]:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    m = re.search(r"const VIDEO_LIBRARY_SEED=(\[.*?\n\]);", html, re.S)
    if not m:
        return {}
    try:
        rows = json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}
    by_id: dict[str, dict] = {}
    for row in rows:
        vid = video_id_from_url(row.get("url", ""))
        if vid:
            by_id[vid] = row
    return by_id


def infer_category(title: str) -> str:
    t = title.lower()
    if any(k in t for k in ["sandblast", "sandblaster", "blasting", "abrasive", "rust", "paint removal", "glass bead", "walnut"]):
        return "噴砂槍"
    if any(k in t for k in ["regulator", "pressure", "gauge", "filter", "separator", "moisture", "oil", "air dryer"]):
        return "調壓 / 噴槍"
    if any(k in t for k in ["tire", "tyre", "inflator", "gauge inflator"]):
        return "胎壓工具"
    if any(k in t for k in ["impact", "ratchet", "grinder", "sander", "die grinder", "air tool", "eraser", "wrench"]):
        return "氣動工具"
    if any(k in t for k in ["warranty", "app", "exhibition", "tite", "lematec"]):
        return "品牌 / 展示"
    return "未分類"


def infer_model(title: str) -> str:
    models: list[str] = []
    for pat in (
        r"\bAS[-\s]?\d+[A-Z0-9-]*\b",
        r"\bDAR[-\s]?\d+[A-Z0-9-]*\b",
        r"\bAI[-\s]?\d+[A-Z0-9-]*\b",
        r"\bAFR[-\s]?[A-Z0-9-]*\b",
        r"\bLE[-\s]?[A-Z]{1,4}[-\s]?\d+[A-Z0-9-]*\b",
        r"\bGA[-\s]?\d+[A-Z0-9-]*\b",
    ):
        for m in re.findall(pat, title, flags=re.I):
            v = re.sub(r"\s+", "-", m.upper())
            if v not in models:
                models.append(v)
    return " / ".join(models)


def infer_keywords(title: str) -> str:
    words = re.findall(r"[A-Za-z0-9#-]+", title.lower())
    stop = {"the", "and", "with", "for", "this", "that", "your", "how", "what", "why", "our", "use", "to", "in", "of"}
    return " ".join(w for w in words if len(w) > 2 and w not in stop)[:500]


def best_thumbnail(entry: dict, video_id: str) -> str:
    thumbs = entry.get("thumbnails") or []
    if thumbs:
        best = max(thumbs, key=lambda x: (x.get("width") or 0) * (x.get("height") or 0))
        url = best.get("url")
        if url:
            return url
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def run_ytdlp(out_dir: Path) -> None:
    for video_type, url in CHANNEL_URLS.items():
        out = out_dir / f"{video_type}.json"
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "yt_dlp",
                "--flat-playlist",
                "--dump-single-json",
                "--skip-download",
                url,
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if proc.returncode:
            raise RuntimeError(f"yt-dlp failed for {url}: {proc.stderr.strip()}")
        out.write_text(proc.stdout, encoding="utf-8")


def build_rows(out_dir: Path) -> list[dict]:
    seed = load_seed_metadata()
    rows: list[dict] = []
    seen: set[str] = set()
    sort_order = 0
    for video_type in ("長影片", "Shorts", "直播"):
        data = json.loads(read_text(out_dir / f"{video_type}.json"))
        for entry in data.get("entries") or []:
            vid = entry.get("id") or video_id_from_url(entry.get("url", ""))
            title = (entry.get("title") or "").strip()
            if not vid or not title or vid in seen:
                continue
            seen.add(vid)
            existing = seed.get(vid, {})
            url = entry.get("url") or f"https://www.youtube.com/watch?v={vid}"
            row = {
                "video_id": vid,
                "title": title,
                "url": url,
                "thumbnail_url": best_thumbnail(entry, vid),
                "source": "YouTube",
                "type": video_type,
                "category": existing.get("category") or infer_category(title),
                "model": existing.get("model") or infer_model(title),
                "keywords": existing.get("keywords") or infer_keywords(title),
                "duration_seconds": entry.get("duration"),
                "view_count": entry.get("view_count"),
                "channel_id": CHANNEL_ID,
                "channel_title": CHANNEL_TITLE,
                "sort_order": sort_order,
                "is_published": True,
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
            sort_order += 1
            rows.append(row)
    return rows


def write_outputs(rows: list[dict], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "video_library_rows.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    seed = [
        {
            "title": r["title"],
            "category": r["category"],
            "model": r["model"],
            "type": r["type"],
            "source": r["source"],
            "url": r["url"],
            "keywords": r["keywords"],
        }
        for r in rows
    ]
    (out_dir / "video_library_seed.json").write_text(
        json.dumps(seed, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def db_url_from_env() -> str:
    for name in DB_ENV_NAMES:
        if os.environ.get(name):
            return os.environ[name]
    return ""


def apply_to_supabase(rows: list[dict], db_url: str) -> None:
    import psycopg
    from psycopg.rows import dict_row

    migration = (ROOT / "supabase" / "migrations" / "20260727_002_video_library.sql").read_text(encoding="utf-8")
    with psycopg.connect(db_url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(migration)
            for row in rows:
                cur.execute(
                    """
                    insert into public.erp_video_library (
                      video_id,title,url,thumbnail_url,source,video_type,category,model,keywords,
                      duration_seconds,view_count,channel_id,channel_title,sort_order,is_published,synced_at,updated_at
                    ) values (
                      %(video_id)s,%(title)s,%(url)s,%(thumbnail_url)s,%(source)s,%(type)s,%(category)s,%(model)s,%(keywords)s,
                      %(duration_seconds)s,%(view_count)s,%(channel_id)s,%(channel_title)s,%(sort_order)s,%(is_published)s,%(synced_at)s,now()
                    )
                    on conflict (video_id) do update set
                      title=excluded.title,
                      url=excluded.url,
                      thumbnail_url=excluded.thumbnail_url,
                      source=excluded.source,
                      video_type=excluded.video_type,
                      category=excluded.category,
                      model=excluded.model,
                      keywords=excluded.keywords,
                      duration_seconds=excluded.duration_seconds,
                      view_count=excluded.view_count,
                      channel_id=excluded.channel_id,
                      channel_title=excluded.channel_title,
                      sort_order=excluded.sort_order,
                      is_published=excluded.is_published,
                      synced_at=excluded.synced_at,
                      updated_at=now()
                    """,
                    row,
                )
            cur.execute("select count(*) as count from public.video_library_public")
            count = cur.fetchone()["count"]
        conn.commit()
    print(f"Supabase video library synced: {count} published rows")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Fetch latest channel data with yt-dlp.")
    parser.add_argument("--apply", action="store_true", help="Apply rows to Supabase using SUPABASE_DB_URL/DATABASE_URL/POSTGRES_URL.")
    parser.add_argument("--db-url", default="", help="Supabase PostgreSQL URL. Prefer env var to avoid shell history.")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if args.refresh:
        run_ytdlp(OUT_DIR)
    else:
        missing = [name for name in CHANNEL_URLS if not (OUT_DIR / f"{name}.json").exists()]
        if missing:
            run_ytdlp(OUT_DIR)
    rows = build_rows(OUT_DIR)
    write_outputs(rows, OUT_DIR)
    print(f"Prepared video rows: {len(rows)}")
    print(f"Long: {sum(r['type']=='長影片' for r in rows)}, Shorts: {sum(r['type']=='Shorts' for r in rows)}, Live: {sum(r['type']=='直播' for r in rows)}")

    if args.apply:
        db_url = args.db_url or db_url_from_env()
        if not db_url:
            raise SystemExit("Missing DB URL. Set SUPABASE_DB_URL/DATABASE_URL/POSTGRES_URL or pass --db-url.")
        apply_to_supabase(rows, db_url)


if __name__ == "__main__":
    main()
