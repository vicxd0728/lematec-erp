import importlib.util,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def module(name,relative):
    spec=importlib.util.spec_from_file_location(name,ROOT/relative)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
audit=module('surface_audit','scripts/audit_theme_surfaces.py')
palette=module('surface_palette','scripts/generate_erp_themes.py')

def contrast(a,b):
    def luminance(color):
        rgb=[int(color[n:n+2],16)/255 for n in (1,3,5)]
        return sum((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4)*w for v,w in zip(rgb,[.2126,.7152,.0722]))
    low,high=sorted([luminance(a),luminance(b)]);return (high+.05)/(low+.05)

class ThemeSurfaceAuditTest(unittest.TestCase):
    def test_all_application_css_and_inline_templates_use_paired_theme_surfaces(self):
        self.assertEqual(audit.audit((ROOT/'index.html').read_text(encoding='utf8')),[])
    def test_unknown_future_component_cannot_bypass_audit(self):
        for background in ['rgba(8,20,14,.92)','#132b30','linear-gradient(#123,#05101a)']:
            source='<style>.future-component{background:'+background+';color:var(--text)}</style>'
            self.assertTrue(audit.audit(source))
        self.assertTrue(audit.audit('<style>.future-component{background:var(--bg2);color:#07283a}</style>'))
    def test_reading_surface_in_inline_modal_is_checked_but_media_scrim_is_retained(self):
        self.assertTrue(audit.audit('<style></style><div style="background:rgba(8,20,14,.92);color:var(--text)">Title</div>'))
        self.assertEqual(audit.audit('<style>.modal-bg{background:rgba(0,0,0,.75)}.video-play{background:rgba(0,0,0,.42);color:#fff}</style>'),[])
    def test_ops_source_pairs_canvas_with_heading_chip_and_card_tokens_for_every_theme(self):
        source=(ROOT/'index.html').read_text(encoding='utf8')
        def prop(selector,name):
            rule=re.search(re.escape(selector)+r'\{([^{}]*)\}',source)
            return re.search(r'(?:^|;)\s*'+name+r'\s*:\s*([^;]+)',rule[1])[1].strip()
        self.assertEqual(prop('.ops-hero','background'),'var(--bg2)')
        self.assertEqual(prop('.ops-card','background'),'var(--bg2)')
        self.assertEqual(prop('.ops-chip','background'),'var(--bg3)')
        self.assertEqual(prop('.ops-title','color'),'var(--text)')
        self.assertEqual(prop('.ops-sub','color'),'var(--text3)')
        for key,canvas,surface,inset,accent,action,muted,kind in palette.THEMES:
            with self.subTest(theme=key):
                primary='#19283b' if key in ['light','warm','ink'] else '#f0f5fa'
                for fg in [primary,muted,accent]:self.assertGreaterEqual(contrast(fg,surface),4.5)
                self.assertGreaterEqual(contrast(muted,inset),4.5)

if __name__=='__main__':unittest.main()
