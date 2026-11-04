import importlib.util
import re
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
            for image in [theme.scene(row[-1],row[4]),theme.illustration(row[-1],row[4],row[0] in ['ink','light','warm','industrial'])]:
                svg=unquote(image[len('url("data:image/svg+xml,'):-2])
                el=ET.fromstring(svg)
                self.assertTrue(el.tag.endswith('svg'))
                for forbidden in ['<script','<foreignObject','href=','<animate','animation:']:
                    self.assertNotIn(forbidden,svg)
    def test_selected_rows_keep_primary_secondary_and_stock_status_text_readable(self):
        # Check the emitted opaque surface, not just its untinted palette inputs.
        colors=re.findall(r'--selection-bg:rgb\((\d+),(\d+),(\d+)\)',theme.build())
        self.assertEqual(len(colors),len(theme.THEMES))
        for row,rgb in zip(theme.THEMES,colors):
            key,_,surface,inset,accent,_,muted,_=row
            light=key in ['light','warm','ink','industrial']
            background='#'+''.join(f'{int(v):02x}' for v in rgb)
            foregrounds=[('#252a2d' if key=='industrial' else '#19283b') if light else '#f0f5fa',muted,
                         '#187047' if light else '#9ce0bc','#a82737' if light else '#ffa4ae']
            for color in foregrounds:
                with self.subTest(theme=key,foreground=color):
                    self.assertGreaterEqual(contrast(color,background),4.5)
    def test_published_stylesheet_matches_generator(self):
        self.assertEqual((ROOT/'erp-themes.css').read_text(encoding='utf8'),theme.build())

if __name__=='__main__':unittest.main()
