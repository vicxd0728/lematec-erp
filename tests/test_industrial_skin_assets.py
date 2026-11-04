import hashlib
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]


class IndustrialSkinAssetsTest(unittest.TestCase):
    def test_skin_assets_are_complete_safe_and_bounded(self):
        items=json.loads((ROOT/'icons/skins/manifest.json').read_text(encoding='utf8'))
        self.assertEqual(len(items),3)
        self.assertLess(sum(x['bytes'] for x in items),140_000)
        css=(ROOT/'erp-themes.css').read_text(encoding='utf8')
        for item in items:
            with self.subTest(asset=item['file']):
                blob=(ROOT/item['file']).read_bytes()
                self.assertEqual(len(blob),item['bytes'])
                self.assertEqual(hashlib.sha256(blob).hexdigest(),item['sha256'])
                self.assertIn('./'+item['file'],css)
                if item['file'].endswith('.svg'):
                    source=blob.decode('utf8');el=ET.fromstring(source)
                    self.assertIn('width',el.attrib)
                    self.assertIn('height',el.attrib)
                    for forbidden in ['<script','href=','<foreignObject','<animate']:
                        self.assertNotIn(forbidden,source)
                else:
                    self.assertEqual(blob[:4],b'RIFF')
                    self.assertEqual(blob[8:12],b'WEBP')
                    self.assertIn(b'ALPH',blob)


if __name__=='__main__':unittest.main()
