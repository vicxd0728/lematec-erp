"""Guard the integrated SVG pack and its reproducible CSS, without business writes."""
import importlib.util
import hashlib
import json
import runpy
from urllib.parse import unquote
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]

class IntegratedThemeSkinsTest(unittest.TestCase):
    def test_all_native_frame_families_have_proportional_safe_svg(self):
        mod=runpy.run_path(str(ROOT/'scripts/theme_frame_families.py'))
        families=mod['PROFILES']
        self.assertEqual(len(families),11)
        drawings=[]
        for profile in families.values():
            image=mod['frame'](profile[0],'#82dcd7','#526376')
            source=unquote(image[len('url("data:image/svg+xml,'):-2])
            doc=ET.fromstring(source)
            self.assertEqual(doc.attrib['viewBox'],'0 0 96 96')
            self.assertEqual(doc.attrib['width'],'96')
            for forbidden in ['<script','href=','<foreignObject','<animate']:
                self.assertNotIn(forbidden,source)
            drawings.append(source)
        self.assertEqual(len(set(drawings)),11)

    def test_folio_raster_pack_matches_manifest_and_budget(self):
        manifest=json.loads((ROOT/'icons/skins/ink-folio-manifest.json').read_text(encoding='utf8'))
        self.assertEqual(len(manifest['assets']),3)
        self.assertLess(sum(a['bytes'] for a in manifest['assets']),80_000)
        css=(ROOT/'erp-themes.css').read_text(encoding='utf8')
        for item in manifest['assets']:
            with self.subTest(asset=item['file']):
                data=(ROOT/item['file']).read_bytes()
                self.assertEqual(len(data),item['bytes'])
                self.assertEqual(hashlib.sha256(data).hexdigest(),item['sha256'])
                self.assertIn('./'+item['file'],css)
                if item['file'].endswith('.webp'):
                    self.assertEqual(data[:4],b'RIFF')
                    self.assertEqual(data[8:12],b'WEBP')
                else:
                    self.assertEqual(ET.fromstring(data).attrib['viewBox'],'0 0 96 96')

    def test_new_svg_assets_are_safe_and_small(self):
        names=['tech-traces','tech-frame','ink-landscape','ink-frame']
        total=0
        for name in names:
            with self.subTest(asset=name):
                data=(ROOT/f'icons/skins/{name}-v1.svg').read_bytes()
                total+=len(data)
                doc=ET.fromstring(data)
                self.assertIn('width',doc.attrib)
                self.assertIn('height',doc.attrib)
                for node in doc.iter():
                    self.assertIn(node.tag.split('}')[-1],{'svg','defs','linearGradient','stop','pattern','circle','path','g','rect'})
                    for key,value in node.attrib.items():
                        self.assertFalse(key.startswith('on'))
                        self.assertNotIn('href',key)
                        self.assertNotIn('http',value)
        self.assertLess(total,12_000)

    def test_generated_css_matches_source(self):
        spec=importlib.util.spec_from_file_location('theme_generator',ROOT/'scripts/generate_erp_themes.py')
        generator=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        self.assertEqual(generator.build(),(ROOT/'erp-themes.css').read_text(encoding='utf8'))

if __name__=='__main__':unittest.main()
