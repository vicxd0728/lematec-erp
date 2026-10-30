import importlib.util
from pathlib import Path
import unittest
from urllib.parse import unquote
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('erp_theme_generator',ROOT/'scripts/generate_erp_themes.py')
theme=importlib.util.module_from_spec(spec);spec.loader.exec_module(theme)
def contrast(a,b):
    def lum(s):
        n=[int(s[i:i+2],16)/255 for i in (1,3,5)]
        return sum((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4)*w for v,w in zip(n,[.2126,.7152,.0722]))
    x,y=sorted([lum(a),lum(b)])
    return (y+.05)/(x+.05)

class ThemePaletteTest(unittest.TestCase):
    def test_every_palette_supports_secondary_text_and_white_action_labels(self):
        for key,bg,surface,inset,accent,action,muted,kind in theme.THEMES:
            with self.subTest(theme=key):
                for background in [surface,inset]:
                    self.assertGreaterEqual(contrast(muted,background),4.5)
                    self.assertGreaterEqual(contrast(accent,background),4.5)
                self.assertGreaterEqual(contrast('#ffffff',action),4.5)
    def test_scenes_are_valid_static_svg_without_external_content(self):
        for row in theme.THEMES:
            image=theme.scene(row[-1],row[4])
            svg=unquote(image[len('url("data:image/svg+xml,'):-2])
            el=ET.fromstring(svg)
            self.assertTrue(el.tag.endswith('svg'))
            for forbidden in ['<script','<foreignObject','href=','<animate','animation:']:
                self.assertNotIn(forbidden,svg)
    def test_published_stylesheet_matches_generator(self):
        self.assertEqual((ROOT/'erp-themes.css').read_text(encoding='utf8'),theme.build())

if __name__=='__main__':unittest.main()
