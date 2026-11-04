"""Original, bounded frame/control families for the remaining existing themes.

Pure build() for the stylesheet generator. Explicit CLI writes hashed native assets.
No layout, HTML, handlers, requests or business data are changed here.
"""
from pathlib import Path
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
PROFILES={
 'tech':dict(title='藍圖中繼',kind='relay',radius='7px',accent='#98bcff',rim='#4c87be',fill='#11273d',edge='#0c1c2d',action='#265dc3',ink='#ffffff',material='deep-space-metal',size='256px 64px'),
 'board':dict(title='訊號機櫃',kind='rack',radius='3px',accent='#e0e7e9',rim='#82949d',fill='#131e26',edge='#1d2c35',action='#e0e7e9',ink='#17212a',material='deep-space-metal',size='256px 64px'),
 'light':dict(title='瓷白辦公',kind='porcelain',radius='10px',accent='#235bb1',rim='#9dbad8',fill='#ffffff',edge='#e5eff8',action='#235bb1',ink='#ffffff',material='archive-paper',size='256px 48px'),
 'violet':dict(title='軌道觀測台',kind='orbit',radius='18px',accent='#d0bff5',rim='#8f7eaf',fill='#272238',edge='#40364f',action='#6547aa',ink='#ffffff',material='deep-space-metal',size='256px 64px'),
 'amber':dict(title='黃銅工坊',kind='marquetry',radius='3px 10px',accent='#e8c393',rim='#b18b58',fill='#30251a',edge='#4c3821',action='#81541f',ink='#ffffff',material='archive-linen',size='256px 48px'),
 'titanium':dict(title='鈦金工臺',kind='machined',radius='2px',accent='#c4d2dd',rim='#7d92a2',fill='#222b34',edge='#3c4956',action='#536b80',ink='#ffffff',material='deep-space-metal',size='256px 64px'),
 'rose':dict(title='玫瑰晶鑲',kind='facet',radius='9px',accent='#edc1d0',rim='#b68498',fill='#33252d',edge='#4d3542',action='#95526b',ink='#ffffff',material='deep-space-metal',size='256px 64px'),
 'nature':dict(title='綠境溫室',kind='botanical',radius='5px 18px',accent='#c2d9a8',rim='#7a9a72',fill='#1b3027',edge='#314631',action='#326b50',ink='#ffffff',material='archive-linen',size='256px 48px'),
 'minimal':dict(title='石墨紙藝',kind='gallery',radius='2px',accent='#d6d9d4',rim='#858e95',fill='#24272d',edge='#30343b',action='#d6d9d4',ink='#20252a',material='deep-space-metal',size='256px 64px'),
 'ink':dict(title='玉璧書閣',kind='jade',radius='4px',accent='#345e4d',rim='#a38e61',fill='#fbf7ed',edge='#e8dfc9',action='#345e4d',ink='#fffdf4',material='archive-paper',size='256px 48px'),
}

def svg(key,control=False):
    p=PROFILES[key];kind=p['kind'];a=p['accent'];r=p['rim'];f=p['fill']
    defs=f'<defs><linearGradient id="rim" x2="0" y2="1"><stop stop-color="{a}"/><stop offset=".25" stop-color="{r}"/><stop offset=".7" stop-color="{f}"/><stop offset="1" stop-color="{a}"/></linearGradient></defs>'
    # Every curved, diagonal and symbolic detail stays inside the fixed 24px corners.
    if control:
        shapes={
          'relay':'<path d="M10 3H86L93 10V86L86 93H10L3 86V10Z"/><path d="M5 19H12V12H19M77 84H84V77"/>',
          'rack':'<rect x="3" y="3" width="90" height="90" rx="2"/><path d="M8 8H20M76 88H88M8 8V20M88 76V88"/>',
          'porcelain':'<rect x="3" y="3" width="90" height="90" rx="10"/><rect x="7" y="7" width="82" height="82" rx="7" opacity=".4"/>',
          'orbit':'<rect x="3" y="3" width="90" height="90" rx="22"/><path d="M8 22A14 14 0 0 1 22 8M74 88A14 14 0 0 0 88 74"/>',
          'marquetry':'<path d="M3 3H93V93H3Z"/><path d="M9 21V9H21M75 9H87V21M87 75V87H75M21 87H9V75"/><path d="M13 13H18V18H13ZM78 78H83V83H78Z"/>',
          'machined':'<path d="M14 3H82L93 14V82L82 93H14L3 82V14Z"/><path d="M16 7H80L89 16M80 89H16L7 80"/>',
          'facet':'<path d="M11 3H85L93 11V85L85 93H11L3 85V11Z"/><path d="M10 10L15 6L20 10L15 14ZM76 86L81 82L86 86L81 90Z"/>',
          'botanical':'<path d="M9 3H77Q93 3 93 19V87Q93 93 87 93H19Q3 93 3 77V9Q3 3 9 3Z"/><path d="M76 7Q86 10 89 20M78 9Q87 6 87 15Q80 15 78 9Z"/>',
          'gallery':'<rect x="3" y="3" width="90" height="90"/><path d="M3 18L18 3M78 93L93 78M8 23V8H23M73 88H88V73" opacity=".6"/>',
          'jade':'<path d="M10 3H86L93 10V86L86 93H10L3 86V10Z"/><path d="M6 18H13V6M13 13H20V20H6M76 83H83V76H90M83 90V83"/>',
        }[kind]
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 96 96" fill="none" stroke="{r}" stroke-width="2">{defs}{shapes}</svg>'
    if kind=='relay':
        body=f'<path d="M14 3H82L93 14V82L82 93H14L3 82V14Z" stroke="url(#rim)" stroke-width="2"/><path d="M18 7H78L89 18V78L78 89H18L7 78V18Z" opacity=".5"/><path d="M5 22H12V16L20 8M74 91V84H81L89 76M6 15V7H15M81 89H89V81" stroke="{a}"/><circle cx="12" cy="20" r="2" fill="{a}"/><circle cx="84" cy="76" r="2" fill="{a}"/>'
    elif kind=='rack':
        body=f'<rect x="3" y="3" width="90" height="90" rx="3" stroke="url(#rim)" stroke-width="3"/><rect x="8" y="8" width="80" height="80" rx="1" opacity=".5"/>'
        for x,y in [(12,12),(84,12),(12,84),(84,84)]:body+=f'<circle cx="{x}" cy="{y}" r="4" fill="{f}" stroke="{a}"/><path d="M{x-2} {y+1}L{x+2} {y-1}" stroke="{r}"/>'
    elif kind=='porcelain':
        body=f'<rect x="2" y="2" width="92" height="92" rx="12" fill="{r}" fill-opacity=".12"/><rect x="5" y="5" width="86" height="86" rx="9" stroke="{r}"/><path d="M9 23V16Q9 9 16 9H23M73 87H80Q87 87 87 80V73" stroke="{a}" stroke-width="2"/><path d="M6 25V14Q6 6 14 6H25M71 90H82Q90 90 90 82V71" stroke="#fff" stroke-width="2"/>'
    elif kind=='orbit':
        body=f'<rect x="3" y="3" width="90" height="90" rx="22" stroke="url(#rim)" stroke-width="2"/><rect x="8" y="8" width="80" height="80" rx="17" opacity=".4"/><path d="M3 23A20 20 0 0 1 23 3M8 23A15 15 0 0 1 23 8M13 23A10 10 0 0 1 23 13M73 93A20 20 0 0 0 93 73M73 88A15 15 0 0 0 88 73M73 83A10 10 0 0 0 83 73" stroke="{a}"/><circle cx="16" cy="10" r="1.8" fill="{a}"/><circle cx="80" cy="86" r="1.8" fill="{a}"/>'
    elif kind=='marquetry':
        body=f'<rect x="4" y="4" width="88" height="88" rx="2" stroke="url(#rim)" stroke-width="3"/><rect x="10" y="10" width="76" height="76" rx="1" opacity=".5"/>'
        for t in ['','translate(96 0) scale(-1 1)','translate(0 96) scale(1 -1)','translate(96 96) scale(-1 -1)']:
            body+=f'<g transform="{t or "translate(0 0)"}"><path d="M2 22V10H10V2H22V7H15V15H7V22" stroke="{a}" stroke-width="2"/><path d="M12 12H20V20H12Z" fill="{a}" fill-opacity=".16"/></g>'
    elif kind=='machined':
        body=f'<path d="M15 2H81L94 15V81L81 94H15L2 81V15Z" stroke="url(#rim)" stroke-width="4"/><path d="M17 8H79L88 17V79L79 88H17L8 79V17Z" stroke="{a}" opacity=".65"/><path d="M3 21L21 3H17L3 17ZM75 93L93 75V79L79 93Z" fill="{a}" fill-opacity=".35"/><path d="M8 19L19 8M77 88L88 77"/>'
    elif kind=='facet':
        body=f'<path d="M13 3H83L93 13V83L83 93H13L3 83V13Z" stroke="url(#rim)" stroke-width="2"/><path d="M16 8H80L88 16V80L80 88H16L8 80V16Z" opacity=".6"/><path d="M8 16L16 8L23 16L16 23ZM73 80L80 73L88 80L80 88Z" stroke="{a}"/><path d="M16 8V23M8 16H23M80 73V88M73 80H88" opacity=".4"/>'
    elif kind=='botanical':
        body=f'<path d="M12 3H76Q93 3 93 20V84Q93 93 84 93H20Q3 93 3 76V12Q3 3 12 3Z" stroke="url(#rim)" stroke-width="2"/><path d="M12 8H76Q88 8 88 20V84Q88 88 84 88H20Q8 88 8 76V12Q8 8 12 8Z" opacity=".45"/>'
        for t in ['translate(96 0) scale(-1 1)','translate(0 96) scale(1 -1)']:
            body+=f'<g transform="{t}" stroke="{a}"><path d="M5 23Q6 8 23 5M8 16Q10 6 15 7Q17 13 8 16ZM14 10Q16 3 22 4Q24 10 14 10Z"/><path d="M8 16L13 10M15 10L21 5" opacity=".6"/></g>'
    elif kind=='gallery':
        body=f'<rect x="3" y="3" width="90" height="90" stroke="{r}"/><path d="M3 19L19 3H14L3 14ZM77 93L93 77V82L82 93Z" fill="{a}" fill-opacity=".22"/><path d="M8 23V8H23M73 88H88V73" stroke="{a}"/><path d="M3 24V72M93 24V72" opacity=".3"/>'
    else:
        body=f'<rect x="3" y="3" width="90" height="90" rx="3" stroke="{r}" stroke-width="2"/><rect x="8" y="8" width="80" height="80" rx="1" stroke="{r}" opacity=".5"/>'
        for t in ['','translate(96 0) scale(-1 1)','translate(0 96) scale(1 -1)','translate(96 96) scale(-1 -1)']:
            body+=f'<g transform="{t or "translate(0 0)"}" stroke="{r}"><path d="M3 21H10V3M10 10H21V21H3M15 3V15H3M15 15H20V20H15Z"/><path d="M6 22Q12 18 18 23Q22 26 23 20" stroke="{a}" opacity=".5"/></g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="{r}">{defs}{body}</svg>'

PANELS=':is(.module-brief,.analytics-hero,.panel,.order-action-panel,.premium-corder-panel,.erp-visual-panel,.dash-hero-main,.corder-stat)'
CONTROLS=':is(.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip,.module-pill)'
HEADERS=':is(.panel-hdr,.panel-head,.order-action-head)'
SELECTED=':is(.btn-primary,.btn-blue,.tab-btn.active,.module-tab.active,.qc-tab.active,.filter-chip.active,.order-status-chip.active)'

def scope_for(key):
    explicit=f'html[data-theme="{key}"][data-theme]'
    # applyTheme('tech') deliberately removes data-theme: it is the saved default.
    return ':is(html:not([data-theme]):not([data-theme]),'+explicit+')' if key=='tech' else explicit

def build():
    out=['/* Complete original theme collection. Geometry and event handlers stay in the application. */']
    for key,p in PROFILES.items():
        # Extra explicit scope beats the older multi-theme scene-off selector too.
        # The same scope is used by disabled/print guards below.
        s=scope_for(key);a=p['accent'];r=p['rim'];f=p['fill'];e=p['edge'];k=p['kind']
        out.append(s+'{--collection-frame:url("./icons/skins/'+key+'-collection-frame-v1.svg");--collection-control:url("./icons/skins/'+key+'-collection-control-v1.svg");--collection-material:url("./icons/skins/'+p['material']+'-v1.webp");--collection-rim:'+r+';--collection-accent:'+a+';--collection-action:'+p['action']+';--collection-ink:'+p['ink']+';--collection-radius:'+p['radius']+'}')
        # Opaque color-over-material; never put semantic information into raster imagery.
        material='linear-gradient('+f+'ed,'+f+'ed),var(--collection-material)'
        if key=='minimal':material='linear-gradient('+f+','+f+')'
        out.append(s+' '+PANELS+'{position:relative;border-color:transparent!important;border-radius:var(--collection-radius);background-color:'+f+'!important;background-image:'+material+'!important;background-size:100% 100%,'+p['size']+'!important;box-shadow:0 3px 8px #00000024,inset 0 1px 0 '+a+'20}')
        out.append(s+' '+PANELS+'::after{content:"";position:absolute;inset:0;width:auto;height:auto;transform:none;background:none;border:16px solid transparent;border-image:var(--collection-frame) 24 / 16px / 0 stretch;border-radius:0;pointer-events:none}')
        out.append(s+' :is(.topbar,.role-nav){background-color:'+f+'!important;background-image:linear-gradient('+e+'d9,'+f+'f2),var(--collection-material)!important;background-size:100% 100%,'+p['size']+'!important;border-color:'+r+'!important;box-shadow:inset 0 1px 0 '+a+'44,inset 0 -2px 0 '+r+'55}')
        out.append(s+' '+HEADERS+'{background-color:'+e+'!important;background-image:linear-gradient('+e+'d9,'+f+'ed),var(--collection-material)!important;background-size:100% 100%,'+p['size']+'!important;background-repeat:repeat!important;box-shadow:inset 0 1px 0 '+a+'33,inset 0 -1px 0 '+r+'}')
        radius={'rack':'2px','orbit':'14px','marquetry':'2px 5px','machined':'2px','facet':'5px','botanical':'3px 10px','gallery':'2px','jade':'2px 4px'}.get(k,'6px')
        out.append(s+' '+CONTROLS+'{position:relative;border-radius:'+radius+';box-shadow:inset 0 1px 0 '+a+'44,inset 0 -2px 0 #00000022}')
        out.append(s+' '+CONTROLS+'::after{content:"";position:absolute;inset:0;border:6px solid transparent;border-image:var(--collection-control) 12 / 6px / 0 stretch;pointer-events:none;background:none}')
        out.append(s+' :is(.btn-ghost,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip,.module-pill){background:linear-gradient('+e+','+f+')!important;color:var(--text)!important;border-color:'+r+'!important}')
        out.append(s+' '+SELECTED+'{background:linear-gradient('+p['action']+','+p['action']+')!important;color:'+p['ink']+'!important;border-color:'+a+'!important;box-shadow:inset 0 2px 0 '+a+'66,inset 0 -2px 0 #00000033}')
        out.append(s+' .inp{border-radius:'+radius+';background:var(--bg4)!important;border-color:'+r+'!important;box-shadow:inset 0 1px 3px #00000016}')
        out.append(s+' :is(.source-strip,.notion-bar,.picking-role-note){border-radius:'+radius+';box-shadow:inset 0 1px 0 '+a+'22,inset 0 -1px 0 '+r+'33}')
        out.append(s+' .ops-hero{background:var(--bg2)!important;box-shadow:inset 0 0 0 1px '+r+',inset 0 0 0 5px '+f+',inset 0 0 0 6px '+r+'66}')
        out.append(s+' '+CONTROLS+':focus-visible{outline:3px solid '+a+';outline-offset:3px}')
        if key=='tech':
            out.append(s+' '+HEADERS+'{background-image:repeating-linear-gradient(90deg,transparent 0 9px,'+a+'88 9px 10px),linear-gradient('+e+','+f+')!important;background-size:42px 3px,100% 100%!important;background-position:right 24px top 9px,center!important;background-repeat:no-repeat!important}')
        if key=='board':
            out.append(s+'{--bg:#090f14;--bg2:#131e26;--bg3:#1d2c35;--bg4:#0c151c;--text:#f0f4f5;--text2:#d0dce1;--text3:#bfced5;--border:#82949d;--border2:#92a4ac;--cyan2:#e0e7e9}')
            out.append(s+' '+HEADERS+'{box-shadow:inset 5px 0 0 '+a+',inset 0 -1px 0 '+r+'}')
        if key=='light':out.append(s+' '+PANELS+'{box-shadow:0 2px 0 #c7d9e8,0 4px 9px #244e7520}')
        if key=='titanium':out.append(s+' '+HEADERS+'{background-image:repeating-linear-gradient(0deg,#ffffff08 0 1px,transparent 1px 3px),linear-gradient('+e+','+f+')!important;background-size:auto,100% 100%!important}')
        if key=='minimal':out.append(s+' :is(.topbar,.role-nav),'+s+' '+HEADERS+'{background-image:none!important;box-shadow:inset 0 -1px 0 '+r+'}'+s+' '+PANELS+'{box-shadow:inset 0 1px 0 #ffffff0a}'+s+' '+CONTROLS+'{box-shadow:none}')
        if key=='ink':
            # Keep the original painted landscape, never a newly reserved picture cell.
            out.append(s+' :is(.module-brief,.analytics-hero,.dash-hero-main){background-image:linear-gradient(90deg,#fbf7ed 10%,#fbf7edf5 66%,#fbf7eda8),var(--folio-art)!important;background-size:100% 100%,cover!important;background-position:center,right center!important;background-repeat:no-repeat!important}')
            out.append(s+' :is(.topbar,.role-nav){background-color:#fbf7ed!important;background-image:linear-gradient(#fbf7edeb,#e8dfc9eb),var(--folio-paper)!important;color:var(--text)!important;box-shadow:inset 0 -3px 0 #345e4d,inset 0 -5px 0 #b6a279}'+s+' .topbar :is(.brand,.logo,.brand-home,.topbar-brand,.topbar-brand small,.topbar-sub,.topbar-version){color:var(--text)!important}')
        out.append('@media(max-width:640px){'+s+' '+PANELS+'::after{border-width:12px;border-image-width:12px}}')
        out.append(s+'[data-scene="off"] :is(body,.topbar,.role-nav,.module-brief,.analytics-hero,.panel,.order-action-panel,.premium-corder-panel,.erp-visual-panel,.dash-hero-main,.corder-stat,.panel-hdr,.panel-head,.order-action-head){background-image:none!important}')
    scope=':is(html:not([data-theme]):not([data-theme]),'+','.join('html[data-theme="'+k+'"][data-theme]' for k in PROFILES)+')'
    out.append(scope+' .btn:disabled{background:var(--bg3)!important;background-image:none!important;color:var(--text2)!important;border-color:var(--border2)!important;box-shadow:none!important}'+scope+' .btn:disabled::after{display:none}')
    out.append('@media print{'+scope+' '+PANELS+'::after,'+scope+' '+CONTROLS+'::after{display:none!important}'+scope+' :is(body,.topbar,.role-nav,.panel,.module-brief,.analytics-hero,.dash-hero-main,.corder-stat){background-image:none!important}}')
    return '\n'.join(out)

def write_assets():
    assets=[]
    for key in PROFILES:
        for control in [False,True]:
            filename='icons/skins/'+key+'-collection-'+('control' if control else 'frame')+'-v1.svg'
            data=svg(key,control).encode();(ROOT/filename).write_bytes(data)
            assets.append(dict(file=filename,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
    (ROOT/'icons/skins/collection-manifest.json').write_text(json.dumps(dict(themes=list(PROFILES),provenance='Original native vectors translating original full-interface concept boards; existing original generated material tiles reused.',assets=assets),indent=2)+'\n',encoding='utf8')

if __name__=='__main__':write_assets()
