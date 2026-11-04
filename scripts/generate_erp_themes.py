"""Generate the ERP's bounded, static decorative scenes and theme tokens. No network."""
from pathlib import Path
from urllib.parse import quote

ROOT=Path(__file__).resolve().parents[1]
# ID, canvas, surface, inset, accent (readable on surface), action, muted text, scene.
THEMES=[
 ('tech','#0d1421','#172236','#1c2b42','#98bcff','#265dc3','#a3b3cb','grid'),
 ('premium','#0b1720','#142630','#1b323c','#82dcd7','#166a75','#a2bac5','orbit'),
 ('board','#080e16','#111e2b','#1b2d40','#b4d4ff','#235ba8','#b4c6da','grid'),
 ('light','#eef3f8','#ffffff','#f1f5f9','#235bb1','#235bb1','#526278','grid'),
 ('warm','#f4f0e8','#fffdf8','#f4eee3','#835727','#80531f','#6d6153','arch'),
 ('ocean','#091a28','#102c3e','#183a50','#83c9f2','#176392','#a0becf','wave'),
 ('violet','#181426','#251f38','#322943','#c5b7f1','#6547aa','#bcb0cf','orbit'),
 ('amber','#20180e','#30261a','#3d3021','#e8c393','#81541f','#c3b298','arch'),
 ('titanium','#13191f','#202932','#2a3540','#adc7df','#3b5f82','#b0bdc9','grid'),
 ('rose','#23191e','#33252d','#42313a','#e9b9ca','#95526b','#cbb2bd','arch'),
 ('nature','#111e19','#1a3027','#254035','#acd4bb','#326b50','#adc5b7','mountain'),
 ('minimal','#17191d','#24272d','#30343b','#c2ccdc','#495c78','#b9bfc9','grid'),
 ('ink','#eeeadd','#fcfaf2','#e8e4d6','#345f55','#386155','#5e675f','ink'),
 ('industrial','#f2f1ec','#ffffff','#eeeee8','#a74119','#a74119','#5f625e','industrial'),
]

# Generated raster material families. Theme IDs and saved preferences stay stable.
ART_FAMILIES={'tech':'metal','premium':'metal','board':'metal','titanium':'metal','minimal':'metal',
              'light':'paper','industrial':'paper','warm':'arch','amber':'arch','rose':'arch',
              'ink':'ink','nature':'ink','ocean':'ocean','violet':'orbit'}

def illustration(kind,color,light=False):
    """A complete illustration in a reserved layout cell, never behind text."""
    start='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 260" fill="none">'
    if kind=='industrial':
        shapes=f'''<g stroke="{color}" stroke-width="2" opacity=".65">
        <path d="M28 130H408M78 76V184M350 76V184" stroke-dasharray="5 6" opacity=".4"/>
        <ellipse cx="100" cy="130" rx="42" ry="66"/><ellipse cx="100" cy="130" rx="23" ry="40"/>
        <path d="M100 64H143Q185 130 143 196H100M123 104H285V156H123"/>
        <ellipse cx="303" cy="130" rx="34" ry="55"/><ellipse cx="337" cy="130" rx="34" ry="55"/>
        <path d="M303 75H337M303 185H337M48 225H385M48 218V232M385 218V232"/>
        <path d="M190 218V225M218 218V225M246 218V225M274 218V225M302 218V225M330 218V225"/>
        </g>'''
    elif kind in ['grid','orbit']:
        shapes=f'''<defs><linearGradient id="chip" x2="1" y2="1"><stop stop-color="{color}" stop-opacity=".32"/><stop offset="1" stop-color="{color}" stop-opacity=".04"/></linearGradient></defs>
        <g stroke="{color}" stroke-linecap="round"><path d="M40 60H120L165 105M20 190H100L160 155M300 105L350 55H415M300 155L355 205H430" opacity=".55" stroke-width="2"/>
        <path d="M110 28V55L165 110M330 238V205L290 160M45 130H150M310 130H415" opacity=".25"/>
        <path d="M230 12V38M230 222V248" opacity=".45" stroke-width="2"/>
        <circle cx="230" cy="130" r="102" stroke-dasharray="3 10" opacity=".35"/><circle cx="230" cy="130" r="86" opacity=".18"/>
        <rect x="160" y="60" width="140" height="140" rx="20" fill="url(#chip)" stroke-width="2"/><rect x="180" y="80" width="100" height="100" rx="12" stroke-opacity=".65"/>
        <path d="M197 108H253M197 124H263M197 140H236M197 156H249" stroke-width="5" opacity=".55"/>
        <rect x="21" y="41" width="54" height="34" rx="7" fill="{color}" fill-opacity=".12"/><rect x="361" y="183" width="54" height="34" rx="7" fill="{color}" fill-opacity=".12"/>
        <circle cx="115" cy="60" r="5" fill="{color}"/><circle cx="350" cy="55" r="5" fill="{color}"/><circle cx="100" cy="190" r="5" fill="{color}"/><circle cx="355" cy="205" r="5" fill="{color}"/></g>'''
    elif kind in ['mountain','ink']:
        ink='#31584f' if light else color
        shapes=f'''<defs><linearGradient id="hill" x2="0" y2="1"><stop stop-color="{ink}" stop-opacity=".8"/><stop offset="1" stop-color="{ink}" stop-opacity=".08"/></linearGradient><linearGradient id="fall" x2="1" y2="0"><stop stop-color="#c5d9d1"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#b5cdc5"/></linearGradient></defs>
        <circle cx="116" cy="57" r="25" fill="{ink}" opacity=".07"/>
        <path d="M12 184L74 101 117 152 177 64 224 126 289 31 326 101 365 77 432 183Z" fill="{ink}" opacity=".12"/>
        <path d="M101 219L167 117 191 148 246 55 270 79 292 41 324 149 348 128 402 220Z" fill="url(#hill)"/>
        <path d="M244 88L224 124 227 147 205 174 214 208 242 220 230 175 248 148 246 127 258 91Z" fill="url(#fall)"/>
        <path d="M244 99L235 129 237 150 217 176 224 201" stroke="#ffffff" stroke-width="3" opacity=".8"/>
        <g stroke="{ink}" stroke-linecap="round"><path d="M267 72L274 95M279 62L287 90M175 135L170 168M311 132L322 170M154 173L143 198" opacity=".4" stroke-width="2"/>
        <path d="M80 224Q82 181 65 149M75 192L44 176M79 183L111 158" stroke-width="4"/>
        <path d="M26 174Q51 150 76 169M62 148Q77 132 95 150M87 159Q110 139 131 159" stroke-width="8" opacity=".7"/>
        <path d="M337 49q8-10 16 0q8-10 16 0M364 32q5-6 10 0q5-6 10 0" opacity=".55"/>
        <path d="M135 222Q211 211 298 224M116 233Q228 220 350 232M181 244Q248 237 301 243" opacity=".25"/>
        </g><ellipse cx="225" cy="218" rx="61" ry="10" fill="{ink}" opacity=".1"/>
        <rect x="379" y="193" width="19" height="26" rx="2" fill="#a33f37" opacity=".85"/><path d="M384 199h9v13h-9zM388 198v16" stroke="#f3ead7" stroke-width="1"/>'''
    elif kind=='wave':
        shapes=f'<circle cx="330" cy="62" r="30" fill="{color}" opacity=".1"/>'
        shapes+=''.join(f'<path d="M20 {125+i*15}Q85 {40+i*14} 160 {122+i*14}T315 {115+i*14}T440 {110+i*14}" stroke="{color}" opacity="{.65-i*.07}" stroke-width="{2+i}"/>' for i in range(6))
    else:
        shapes=f'<g stroke="{color}" stroke-width="2" opacity=".6"><path d="M55 230V70Q110 3 165 70V230M165 230V70Q220 3 275 70V230M275 230V70Q330 3 385 70V230"/><path d="M33 230H408M33 240H408M55 90H165M275 90H385"/>'
        shapes+=''.join(f'<path d="M{x} 99V215M{x+8} 99V215" opacity=".4"/>' for x in [62,148,172,258,282,368])+'</g>'
    return 'url("data:image/svg+xml,'+quote(start+shapes+'</svg>',safe='')+'")'

def scene(kind,color):
    start=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" fill="none" stroke="{color}">'
    if kind in ['grid','industrial']:
        shapes=''.join(f'<path d="M{1320+i*36} 0V1000M0 {700+i*32}H1600" stroke-opacity=".12"/>' for i in range(8))+'<circle cx="1500" cy="200" r="150" stroke-opacity=".22"/>'
    elif kind=='orbit':
        shapes=''.join(f'<circle cx="1510" cy="130" r="{180+i*72}" stroke-opacity=".16"/>' for i in range(5))+'<circle cx="1350" cy="310" r="8" fill="'+color+'" fill-opacity=".2"/>'
    elif kind=='wave':
        shapes=''.join(f'<path d="M-100 {800+i*32}C350 {580+i*32} 800 {1100+i*25} 1750 {650+i*30}" stroke-opacity=".18" stroke-width="2"/>' for i in range(6))
    elif kind in ['mountain','ink']:
        shapes='<path d="M0 950L150 650 350 850 500 740 700 980M950 1000L1180 790 1330 900 1510 610 1600 780" stroke-opacity=".28" stroke-width="2"/><path d="M0 1000L200 790 440 970M1190 1000L1490 800 1600 900" stroke-opacity=".18" stroke-width="3"/>'
    else:
        shapes=''.join(f'<path d="M{1360+i*42} 800V230a110 110 0 0 0-220 0v570" stroke-opacity=".13"/>' for i in range(5))
    return 'url("data:image/svg+xml,'+quote(start+shapes+'</svg>',safe='')+'")'

def build():
    out=['/* GENERATED by scripts/generate_erp_themes.py. Static SVG and local WebP materials, no remote assets or animation. */']
    for key,bg,surface,inset,accent,action,muted,kind in THEMES:
        light=key in ['light','warm','ink','industrial'];text='#252a2d' if key=='industrial' else '#19283b' if light else '#f0f5fa'
        border='#b8bab4' if key=='industrial' else '#a8b6c6' if key=='light' else '#b9aa94' if light else '#526376'
        selector='html:not([data-theme])' if key=='tech' else f'html[data-theme="{key}"]'
        accent_rgb=tuple(int(accent[i:i+2],16) for i in (1,3,5))
        surface_rgb=tuple(int(surface[i:i+2],16) for i in (1,3,5))
        tint=.08 if light else .12
        selection='rgb('+','.join(str(round(a*tint+s*(1-tint))) for a,s in zip(accent_rgb,surface_rgb))+')'
        out.append(selector+'{--focus-halo:rgba('+','.join(map(str,accent_rgb))+',.18);--selection-bg:'+selection+';}')
        out.append(selector+'{--header-art:url("./icons/themes/'+key+'-header-v1.webp");--detail-art:url("./icons/themes/'+key+'-detail-v1.webp");}')
        out.append(selector+'{'+f'color-scheme:{"light" if light else "dark"};--bg:{bg};--bg2:{surface};--bg3:{inset};--bg4:{inset};--bg5:{surface};--border:{border};--border2:{border};--border3:{accent};--text:{text};--text2:{muted};--text3:{muted};--blue:{action};--blue2:{accent};--cyan:{action};--cyan2:{accent};--brand:{action};--brand2:{action};--green:{"#187047" if light else "#79d6ad"};--green2:{"#187047" if light else "#9ce0bc"};--red:{"#a82737" if light else "#ffa4ae"};--red2:{"#a82737" if light else "#ffa4ae"};--yellow:{"#855008" if light else "#f0c77b"};--amber:{"#855008" if light else "#f0c77b"};--purple:{"#6b459f" if light else "#cbb4f3"};--nav-bg:{surface};--surface-glass:{surface};--surface-glass-2:{inset};--line-soft:{border};--theme-scene:{scene(kind,accent)};--theme-illustration:{illustration(kind,accent,light)};--theme-soft:{"rgba(40,75,110,.07)" if light else "rgba(160,190,215,.08)"};--shadow:0 8px 28px '+('rgba(30,45,65,.08)' if light else 'rgba(0,0,0,.2)')+';--radius-card:14px;}')
    out.append('''
/* Strong bounded selectors override the legacy shared hard-coded dark layer. */
html body{background-image:var(--theme-scene)!important;background-color:var(--bg)!important;background-repeat:no-repeat!important;background-position:center top!important;background-size:cover!important;background-attachment:scroll!important;color:var(--text)}
html[data-scene="off"] body{background-image:none!important}
html .topbar,html .role-nav{background:var(--bg2)!important;border-color:var(--border)!important;box-shadow:0 1px 0 var(--border)}
html .topbar-brand,html .topbar-sub,html #liveClock{color:var(--text)!important;text-shadow:none}
html .topbar::after{background:var(--cyan2);opacity:.35}
html :is(.panel,.card,.kpi-card,.analytics-panel,.analytics-decision-card,.video-card,.stat,.modal,.modal-box,.dash-card){background:var(--bg2)!important;border-color:var(--border)!important;box-shadow:var(--shadow)}
html :is(.panel-hdr,.panel-head){background:var(--bg3)!important;border-color:var(--border)!important}
html :is(.panel-title,.kpi-label,.kpi-sub,.filter-label,.notion-bar-label){color:var(--text2)!important}
html .panel-title{color:var(--text)!important}
html .panel-title::before{content:"";display:inline-block;width:4px;height:1em;margin-right:10px;border-radius:4px;background:var(--cyan2);vertical-align:-2px}
html .kpi-card:hover{transform:none}
html :is(.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.kpi-card){transition:transform .15s}
html .kpi-num{text-shadow:none}
html .inp,html select.inp>option{background:var(--bg4)!important;border-color:var(--border2)!important;color:var(--text)!important;-webkit-text-fill-color:var(--text)!important}
html .inp::placeholder{color:var(--text3)!important;-webkit-text-fill-color:var(--text3)!important;opacity:1}
html :is(.inp,.btn,.theme-option):focus-visible{outline:3px solid var(--cyan2);outline-offset:3px}
html .btn-primary,html .btn-blue{background:var(--brand)!important;color:#fff!important;box-shadow:none}
html .btn-ghost{background:var(--bg3)!important;color:var(--text)!important;border-color:var(--border2)!important}
html .btn-green{color:var(--green2)!important;background:var(--theme-soft)!important;border-color:var(--green2)!important}
html .btn-red{color:var(--red2)!important;background:var(--theme-soft)!important;border-color:var(--red2)!important}
html .btn-yellow,html .info-warn{color:var(--amber)!important;background:var(--bg3)!important;border:1px solid var(--amber)}
html .btn-cyan,html .badge{color:var(--cyan2)!important;background:var(--bg3)!important;border-color:var(--border2)!important}
html .info-ok{color:var(--green2);background:var(--bg3);border-color:var(--green2)}
html :is(.tab-btn,.module-tab,.qc-tab,.filter-chip){color:var(--text2)!important;background:var(--bg2)!important;border-color:var(--border)!important;box-shadow:none}
html :is(.tab-btn.active,.module-tab.active,.qc-tab.active,.filter-chip.active){color:var(--cyan2)!important;background:var(--bg3)!important;border-color:var(--cyan2)!important;box-shadow:inset 0 -3px 0 var(--cyan2)}
html th{background:var(--bg3)!important;color:var(--text2)!important;border-color:var(--border)!important;transition:none}
html td{color:var(--text);border-color:var(--border)!important}
html tr:hover td{background:var(--theme-soft)!important}
html .table-wrap{background:var(--bg2)!important}
html .module-tabs,html .qc-tabs,html .notion-bar{background:var(--bg3)!important;border-color:var(--border)!important}
html .notion-link{color:var(--cyan2)!important;background:var(--bg2)!important;border-color:var(--border)!important}
/* Named operational surfaces: paired opaque background and semantic text on every theme. */
html :is(.module-brief,.order-action-panel,.dash-hero-main,.dash-hero-side,.dash-status-card,.dash-ann-panel,.dash-ann-card,.dashboard-todo,.dashboard-todo-card,.quick-entry-card,.erp-visual-panel,.analytics-hero,.picking-flow-card,.note-toolbar,.note-item,.note-metrics div,.video-link-tile){background:var(--bg2)!important;border-color:var(--border)!important;color:var(--text)}
html :is(.order-action-head,.dash-ann-head,.module-pill,.order-status-chip,.note-actions,.note-hero){background:var(--bg3)!important;border-color:var(--border)!important;color:var(--text2)}
html .order-status-chip.active{color:var(--cyan2);border-color:var(--cyan2)!important;box-shadow:inset 0 -2px var(--cyan2)}
html :is(.dash-hero-title,.module-brief h2,.analytics-hero h2,.note-hero h2){color:var(--text)}
html :is(.dash-hero-sub,.dash-status-card span,.module-brief p,.analytics-hero p,.note-hero p){color:var(--text2)}
html .dash-hero-kicker,html .qc-tab.active small{color:var(--cyan2)}
html .dash-hero-main::after{content:none}
html .source-strip,html .analytics-source-strip,html .picking-role-note{background:var(--bg3);border-color:var(--border)}
html .order-action-panel .table-wrap,html .premium-corder-panel .table-wrap{background:var(--bg2)!important}
/* Illustration occupies its own grid cell; never covers a label, count, button or chart. */
html :is(.module-brief,.analytics-hero){grid-template-columns:minmax(0,1fr) 210px;gap:8px 24px;align-items:center}
html :is(.module-brief,.analytics-hero)::before{content:"";position:static;grid-column:2;grid-row:1 / 3;display:block;align-self:center;width:210px;height:122px;border-radius:12px;background:var(--theme-illustration) center / contain no-repeat;opacity:1;pointer-events:none}
html :is(.module-brief,.analytics-hero)>div:first-of-type{grid-column:1;grid-row:1;min-width:0}
html :is(.module-brief-actions,.analytics-hero-actions){grid-column:1;grid-row:2;justify-content:flex-start}
html[data-scene="off"] :is(.module-brief,.analytics-hero)::before{display:none}
html[data-scene="off"] :is(.module-brief,.analytics-hero){grid-template-columns:minmax(0,1fr) auto}
html[data-scene="off"] :is(.module-brief,.analytics-hero)>div{grid-column:auto;grid-row:auto}
/* Raster material kit: original layout cells, calm reading surfaces and lightweight local crops. */
html body{background-image:none!important}
html :is(.panel-hdr,.panel-head){background-image:var(--header-art)!important;background-size:auto 180px!important;background-position:right center!important;background-repeat:no-repeat!important}
html :is(.module-brief,.analytics-hero)::before{background-image:var(--detail-art)!important;background-size:cover!important;border-radius:10px;box-shadow:inset 0 0 0 1px var(--border)}
html .ops-hero{background-image:var(--header-art)!important;background-size:auto 100%!important;background-position:right center!important;background-repeat:no-repeat!important}
html[data-scene="off"] :is(.panel-hdr,.panel-head,.ops-hero){background-image:none!important}
html[data-theme="ink"] :is(.module-brief h2,.analytics-hero h2,.panel-title,.dash-hero-title){font-family:"Noto Serif TC","PMingLiU",serif;font-weight:700;letter-spacing:.06em}
html[data-theme="ink"] :is(.panel,.module-brief,.analytics-hero){border-radius:10px;box-shadow:0 4px 18px rgba(61,76,60,.06)}
html[data-theme="ink"] .panel-title::before{background:#a33f37;width:5px}
html[data-theme="ink"][data-scene="off"] body{background-image:none!important}
#themePanel .theme-option{min-height:106px;display:flex;flex-direction:column;align-items:stretch;text-align:left;padding:10px;border-radius:12px;cursor:pointer;border:1px solid var(--border2);background:var(--bg3);color:var(--text);gap:7px}
#themePanel .theme-option[aria-pressed="true"]{outline:2px solid var(--cyan2);outline-offset:-2px}
#themePanel .theme-preview{height:30px;border-radius:6px;display:flex;gap:4px;align-items:center;padding:5px}
#themePanel .theme-preview i{display:block;width:20%;height:15px;border-radius:3px}
#themePanel .theme-preview span{margin-left:auto;font-size:.8rem;font-weight:750;font-variant-numeric:tabular-nums}
#themePanel .theme-current{padding:9px 10px;margin-top:10px;border:1px solid var(--border);border-radius:9px;color:var(--text);font-size:.8rem;line-height:1.5;background:var(--bg3)}
#themePanel .theme-option b{font-size:.88rem;line-height:1.3}
#themePanel .theme-option small{font-size:.74rem;color:var(--text2);line-height:1.4}
#themePanel .theme-section{font-size:.75rem;font-weight:750;color:var(--text2);margin:18px 0 8px}
html #themePanel{background:var(--bg2)!important;box-shadow:var(--shadow)}
#themePanel [data-font-size],#themePanel [data-theme-close]{min-height:44px}
#themePanel [data-theme-close]{min-width:44px}
#themePanel .theme-scene-toggle{display:flex;align-items:center;gap:10px;min-height:48px;margin-top:14px;color:var(--text2);font-size:.85rem}
#themePanel input[type="checkbox"]{width:20px;height:20px;accent-color:var(--brand)}
/* Theme-aware operational states: paint only, no geometry or transaction changes. */
html .btn:disabled{opacity:1!important;color:var(--text2)!important;background:var(--bg3)!important;border-color:var(--border2)!important;box-shadow:none!important;text-shadow:none;cursor:not-allowed}
html .inp:focus{border-color:var(--cyan2)!important;box-shadow:0 0 0 3px var(--focus-halo)!important;outline:2px solid var(--cyan2);outline-offset:2px}
html .inventory-stock-table tr:has(input[type="checkbox"]:checked) td{background:var(--selection-bg)!important}
html .inventory-stock-table tr:has(input[type="checkbox"]:checked) td:first-child{box-shadow:inset 3px 0 var(--cyan2)}
/* Canva-reviewed warm industrial finish: paint only; preserve all component geometry. */
html[data-theme="industrial"]{--border:#c9ccc5;--border2:#858d82;--theme-soft:rgba(167,65,25,.045);--shadow:0 2px 8px rgba(37,42,45,.045),0 12px 28px rgba(37,42,45,.025)}
html[data-theme="industrial"] :is(.tab-btn.active,.module-tab.active,.qc-tab.active,.filter-chip.active){color:var(--text)!important;background:var(--bg2)!important;box-shadow:inset 0 -3px 0 var(--brand)}
html[data-theme="industrial"] :is(.ops-hero,.ops-card,.dash-hero-main,.module-brief,.analytics-hero){box-shadow:var(--shadow)}
html[data-theme="industrial"] :is(.inp,.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.theme-option):focus-visible{outline:2px solid var(--brand);outline-offset:2px}
/* State finish: readable unavailable actions, one focus hue, and visible batch selection. */
html[data-theme="industrial"] .btn:disabled{opacity:1!important;color:#666b64!important;background:#e5e7e0!important;border-color:#a5aba1!important;box-shadow:none!important;text-shadow:none;cursor:not-allowed}
html[data-theme="industrial"] .inp{background:#fff!important}
html[data-theme="industrial"] .inp:focus{border-color:var(--brand)!important;box-shadow:0 0 0 3px rgba(167,65,25,.14)!important;outline:2px solid var(--brand);outline-offset:2px}
html[data-theme="industrial"] .inventory-stock-table tr:has(input[type="checkbox"]:checked) td{background:#fbefe7!important}
html[data-theme="industrial"] .inventory-stock-table tr:has(input[type="checkbox"]:checked) td:first-child{box-shadow:inset 3px 0 var(--brand)}
@media(max-width:640px){html body{background-size:auto 100vh!important}#themePanel{top:76px!important;max-height:calc(100dvh - 90px)!important}.topbar-brand{letter-spacing:2px!important}html[data-theme="board"] #mainContent{padding:14px}html[data-theme="board"] .kpi-num{font-size:48px}}
@media(max-width:640px){
 html :is(.panel-hdr,.panel-head){background-size:auto 130px!important}
 html :is(.module-brief,.analytics-hero){grid-template-columns:minmax(0,1fr) 106px;gap:12px;padding:18px 16px}
 html :is(.module-brief,.analytics-hero)::before{grid-row:1;grid-column:2;width:106px;height:116px}
 html :is(.module-brief-actions,.analytics-hero-actions){grid-column:1 / -1;grid-row:2}
 html[data-scene="off"] :is(.module-brief,.analytics-hero){grid-template-columns:minmax(0,1fr)}
 html[data-theme="ink"] body{background-size:440px auto!important;background-position:right 120px!important}
}
@media(prefers-reduced-motion:reduce){html body{scroll-behavior:auto}html .kpi-card,html .theme-option{transition:none!important;animation:none!important}}
/* Industrial integrated skin: shared backplates and inset frames, never a separate art tile. */
html[data-theme="industrial"] :is(.module-brief,.analytics-hero){grid-template-columns:minmax(0,1fr);border-radius:12px;border-color:#b9beb3!important;background-image:linear-gradient(110deg,rgba(255,255,255,.94),rgba(255,255,255,.86)),var(--detail-art)!important;background-size:100% 100%,cover!important;background-position:center!important;box-shadow:inset 3px 0 0 var(--brand),inset 0 1px 0 #fff,0 3px 12px rgba(37,42,45,.035)}
html[data-theme="industrial"] :is(.module-brief,.analytics-hero)::before{content:none!important;display:none!important}
html[data-theme="industrial"] :is(.module-brief,.analytics-hero)::after{content:"";position:absolute;inset:5px;border:1px solid rgba(255,255,255,.8);border-radius:8px;pointer-events:none}
html[data-theme="industrial"] :is(.panel,.order-action-panel){border-radius:12px;border-color:#b9beb3!important;box-shadow:inset 0 1px 0 #fff,0 3px 12px rgba(37,42,45,.035)}
html[data-theme="industrial"] :is(.panel-hdr,.panel-head,.order-action-head){background-image:linear-gradient(90deg,rgba(167,65,25,.045),rgba(167,65,25,0) 65%),var(--header-art)!important;background-size:100% 100%,cover!important;box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 #d5d8cf}
html[data-theme="industrial"] :is(.module-pill,.order-status-chip){background:linear-gradient(#fff,#f2f2ec)!important;border-color:#bfc4b9!important;color:var(--text2)}
html[data-theme="industrial"] .order-status-chip.active{color:var(--brand)!important;border-color:var(--brand)!important;box-shadow:inset 0 -2px 0 var(--brand)}
html[data-theme="industrial"][data-scene="off"] :is(.module-brief,.analytics-hero){background-image:none!important}
html[data-theme="industrial"][data-scene="off"] :is(.panel-hdr,.panel-head,.order-action-head){background-image:none!important}
/* Approved precision-instrument language: proportional corner pieces + integrated linework. */
html[data-theme="industrial"]{--instrument-frame:url("./icons/skins/industrial-frame-v1.svg");--instrument-control:url("./icons/skins/industrial-control-v1.svg");--instrument-art:url("./icons/skins/industrial-linework-v1.webp")}
html[data-theme="industrial"] :is(.module-brief,.analytics-hero,.panel,.order-action-panel,.source-strip,.picking-role-note){position:relative;border-radius:0;border-color:transparent!important;background-color:#f7f4ec!important;box-shadow:inset 0 0 0 1px #c4bcad,0 3px 7px rgba(67,56,38,.09)}
html[data-theme="industrial"] :is(.module-brief,.analytics-hero){background-image:linear-gradient(90deg,#faf8f2 0%,rgba(250,248,242,.98) 36%,rgba(250,248,242,.42) 75%,rgba(250,248,242,.18)),var(--instrument-art),var(--header-art)!important;background-size:100% 100%,auto 310px,cover!important;background-position:center,right bottom,center!important;background-repeat:no-repeat!important}
html[data-theme="industrial"] :is(.module-brief,.analytics-hero,.panel,.order-action-panel,.source-strip,.picking-role-note)::after{content:"";position:absolute;inset:0;border:14px solid transparent;border-image:var(--instrument-frame) 20 / 14px / 0 stretch;border-radius:0;pointer-events:none;z-index:1}
html[data-theme="industrial"] :is(.panel-hdr,.panel-head,.order-action-head){background-image:repeating-linear-gradient(90deg,#a79b88 0 1px,transparent 1px 6px),linear-gradient(#f8f5ed,#eee8dc)!important;background-size:42px 6px,100% 100%!important;background-position:right 24px top 10px,center!important;background-repeat:no-repeat!important;box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 #c5bcac}
html[data-theme="industrial"] :is(.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip,.module-pill){border-radius:0;clip-path:polygon(6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px),0 6px);box-shadow:inset 0 0 0 1px #b9ad99,inset 0 0 0 3px rgba(255,255,255,.7)}
html[data-theme="industrial"] :is(.btn-ghost,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip,.module-pill){background:linear-gradient(#fffdf8,#ece7db)!important}
html[data-theme="industrial"] :is(.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip,.module-pill){position:relative}
html[data-theme="industrial"] :is(.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip,.module-pill)::after{content:"";position:absolute;inset:0;border:6px solid transparent;border-image:var(--instrument-control) 7 / 6px / 0 stretch;pointer-events:none}
html[data-theme="industrial"] .order-status-chip.active{background:linear-gradient(#ae491b,#963b17)!important;color:#fff!important;box-shadow:inset 0 0 0 1px #843411,inset 0 0 0 3px rgba(255,255,255,.6)}
html[data-theme="industrial"] .inp{border-radius:3px;box-shadow:inset 0 1px 3px rgba(81,65,40,.07)}
html[data-theme="industrial"] :is(.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip):focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--brand),inset 0 0 0 4px #fff}
html[data-theme="industrial"] :is(.btn-primary,.btn-blue,.order-status-chip.active):focus-visible{box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px #733414}
@media(max-width:640px){html[data-theme="industrial"] :is(.module-brief,.analytics-hero){background-size:100% 100%,auto 220px,cover!important;background-image:linear-gradient(90deg,#faf8f2 0%,rgba(250,248,242,.97) 68%,rgba(250,248,242,.8)),var(--instrument-art),var(--header-art)!important}}
html[data-theme="industrial"][data-scene="off"] :is(.module-brief,.analytics-hero){background-image:none!important}
html[data-theme="industrial"][data-scene="off"] :is(.panel-hdr,.panel-head,.order-action-head){background-image:linear-gradient(#f8f5ed,#eee8dc)!important;background-size:100% 100%!important;background-position:center!important}
@media print{html body{background:#fff!important}}
''')
    out.append((ROOT/'scripts/theme_skins_round2.css').read_text(encoding='utf8'))
    out.append((ROOT/'scripts/theme_ink_folio.css').read_text(encoding='utf8'))
    return '\n'.join(out)

if __name__=='__main__':(ROOT/'erp-themes.css').write_text(build(),encoding='utf8',newline='\n')
