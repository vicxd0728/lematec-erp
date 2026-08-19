from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(encoding="utf-8")


def function_body(source: str, name: str) -> str:
    match = re.search(rf"(?:async\s+)?function\s+{name}\([^)]*\)\s*\{{", source)
    if not match:
        raise AssertionError(f"Missing function {name}")
    start = match.end()
    depth = 1
    pos = start
    while pos < len(source) and depth:
        char = source[pos]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        pos += 1
    return source[start : pos - 1]


class VideoLibraryWorkerContractTests(unittest.TestCase):
    def test_frontend_loads_video_library_through_worker_first(self):
        load_body = function_body(INDEX, "loadSupabaseVideoLibrary")
        rows_body = function_body(INDEX, "getVideoLibraryRows")
        self.assertIn("/api/video-library/list?limit=1000", load_body)
        self.assertIn("source='supabase_worker'", load_body)
        self.assertIn("source='supabase_anon'", load_body)
        self.assertNotIn("if(getSupabaseAnonKey()&&!_supabaseVideoLibraryState.loaded", rows_body)
        self.assertIn("loadSupabaseVideoLibrary(false)", rows_body)
        self.assertIn("Worker / Supabase", INDEX)

    def test_worker_exposes_public_video_library_route(self):
        body = function_body(WORKER, "erpVideoLibraryList")
        self.assertIn("/api/video-library/list", WORKER)
        self.assertIn("video_library_public", body)
        self.assertIn("source: 'supabase_worker'", body)
        self.assertIn("is_published", body)
        self.assertIn("videos", body)


if __name__ == "__main__":
    unittest.main()
