"""Shipping checks: every local raster referenced by CSS exists, is small and intact."""
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ThemeAssetsTest(unittest.TestCase):
    def test_referenced_art_is_local_complete_intact_and_bounded(self):
        manifest = json.loads((ROOT/'icons/themes/manifest.json').read_text(encoding='utf8'))
        references = set(re.findall(r'url\("\./(icons/themes/[^" ]+\.webp)"\)',
                                    (ROOT/'erp-themes.css').read_text(encoding='utf8')))
        self.assertEqual(references, {x['file'] for x in manifest})
        self.assertEqual(len(references), 28)
        self.assertLess(sum(x['bytes'] for x in manifest), 100_000)
        for item in manifest:
            with self.subTest(file=item['file']):
                content = (ROOT/item['file']).read_bytes()
                self.assertEqual(content[:4], b'RIFF')
                self.assertEqual(content[8:12], b'WEBP')
                self.assertEqual(len(content), item['bytes'])
                self.assertEqual(hashlib.sha256(content).hexdigest(), item['sha256'])
                self.assertLess(len(content), 16_000)


if __name__ == '__main__':
    unittest.main()
