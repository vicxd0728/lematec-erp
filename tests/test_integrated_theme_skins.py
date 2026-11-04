"""Guard the integrated SVG pack and its reproducible CSS, without business writes."""
import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]

class IntegratedThemeSkinsTest(unittest.TestCase):
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
