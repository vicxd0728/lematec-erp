"""Native frame languages for existing themes; no illustration tiles or data changes."""
from urllib.parse import quote

# Shape, corner radius, header edge pattern, control surface. The accepted industrial
# and painted ink skins remain separately owned and are not restyled here.
PROFILES={
 'premium':('bracket','4px','linear-gradient(90deg,var(--cyan2),transparent)','inset 0 1px 0 #ffffff15,inset 0 -2px 0 #00000025'),
 'board':('rack','2px','repeating-linear-gradient(90deg,var(--cyan2) 0 8px,transparent 8px 12px)','inset 0 -2px 0 #ffffff18'),
 'light':('office','8px','linear-gradient(90deg,var(--brand),transparent)','inset 0 1px 0 #ffffffcc'),
 'warm':('folio','6px','linear-gradient(90deg,var(--cyan2),transparent)','inset 0 1px 0 #ffffffcc,inset 0 -2px 0 #83674712'),
 'ocean':('nautical','12px','repeating-linear-gradient(90deg,var(--cyan2) 0 1px,transparent 1px 7px)','inset 0 1px 0 #d6efff20,inset 0 -2px 0 #00000030'),
 'violet':('orbit','14px','linear-gradient(90deg,transparent,var(--cyan2),transparent)','inset 0 1px 0 #ffffff25,inset 0 -2px 0 #00000020'),
 'amber':('craft','3px','repeating-linear-gradient(90deg,var(--cyan2) 0 2px,transparent 2px 9px)','inset 0 0 0 2px #e8c39316,inset 0 -2px 0 #00000030'),
 'titanium':('bevel','3px','linear-gradient(90deg,var(--cyan2),transparent)','inset 0 1px 0 #e0e8ef30,inset 0 -2px 0 #00000040'),
 'rose':('jewel','10px','linear-gradient(90deg,transparent,var(--cyan2),transparent)','inset 0 1px 0 #ffffff25,inset 0 0 0 2px #e9b9ca10'),
 'nature':('botanical','5px 16px 5px 16px','linear-gradient(90deg,var(--cyan2),transparent)','inset 0 1px 0 #cbe6d320,inset 0 -2px 0 #00000022'),
 'minimal':('plain','2px','linear-gradient(90deg,var(--border),var(--border))','none'),
}

def frame(kind,accent,border):
    base=f'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="{border}">'
    if kind=='bracket':
        body=f'<path d="M20 5H76M91 20V76M76 91H20M5 76V20"/><path d="M4 18V4H18M78 4H92V18M92 78V92H78M18 92H4V78" stroke="{accent}"/><path d="M9 17V9H17M79 9H87V17M87 79V87H79M17 87H9V79" opacity=".35"/>'
    elif kind=='rack':
        body=f'<path d="M3 3H93V93H3Z"/><path d="M3 3H17M79 3H93M3 93H17M79 93H93" stroke="{accent}" stroke-width="3"/><path d="M9 9H15M81 9H87M9 87H15M81 87H87"/>'
    elif kind=='office':
        body=f'<rect x="3" y="3" width="90" height="90" rx="8"/><path d="M3 22V11Q3 3 11 3H22" stroke="{accent}" stroke-width="2"/>'
    elif kind=='folio':
        body=f'<rect x="3" y="3" width="90" height="90" rx="4"/><path d="M11 20V11H20M76 85H85V76M22 7H74M22 89H74" stroke="{accent}" opacity=".55"/>'
    elif kind=='nautical':
        body=f'<rect x="3" y="3" width="90" height="90" rx="13"/><path d="M6 22V17Q6 6 17 6H22M74 90H79Q90 90 90 79V74" stroke="{accent}"/><path d="M11 22V16M17 15V10M22 12V7M74 89V84M80 86V80M86 80V74" stroke="{accent}" opacity=".55"/>'
    elif kind=='orbit':
        body=f'<rect x="3" y="3" width="90" height="90" rx="18"/><path d="M3 24A21 21 0 0 1 24 3M72 93A21 21 0 0 0 93 72" stroke="{accent}" stroke-width="2"/><path d="M8 24A16 16 0 0 1 24 8M72 88A16 16 0 0 0 88 72" opacity=".4"/>'
    elif kind=='craft':
        body=f'<rect x="3" y="3" width="90" height="90" rx="2"/><path d="M8 21V8H21M75 8H88V21M88 75V88H75M21 88H8V75" stroke="{accent}" opacity=".7"/><path d="M12 12h5v5h-5zm67 0h5v5h-5zm0 67h5v5h-5zm-67 0h5v5h-5z" opacity=".5"/>'
    elif kind=='bevel':
        body=f'<path d="M12 3H84L93 12V84L84 93H12L3 84V12Z"/><path d="M15 7H81L89 15M89 81L81 89H15L7 81" stroke="{accent}" opacity=".65"/><path d="M6 18V13L13 6H18M78 90H83L90 83V78" stroke="{accent}"/>'
    elif kind=='jewel':
        body=f'<rect x="3" y="3" width="90" height="90" rx="10"/><path d="M16 8l5 5-5 5-5-5zm64 70 5 5-5 5-5-5z" stroke="{accent}"/><path d="M25 7H74M22 89H71" stroke="{accent}" opacity=".3"/>'
    elif kind=='botanical':
        body=f'<path d="M10 3H76Q93 3 93 20V86Q93 93 86 93H20Q3 93 3 76V10Q3 3 10 3Z"/><path d="M77 6Q90 6 90 19M6 77Q6 90 19 90" stroke="{accent}"/><path d="M78 9Q84 9 86 15Q80 15 78 9ZM10 79Q10 85 16 87Q16 81 10 79Z" stroke="{accent}" opacity=".55"/>'
    else:body='<rect x="3" y="3" width="90" height="90" rx="1"/>'
    return 'url("data:image/svg+xml,'+quote(base+body+'</svg>',safe='')+'")'

def build(themes):
    out=['/* Complete-frame finish: original theme IDs and DOM operations retained. */',
    # Delete the drawing and its grid cell; unlike hiding it, this restores reading width.
    'html :is(.module-brief,.analytics-hero)::before{content:none!important;display:none!important}',
    'html :is(.module-brief,.analytics-hero){grid-template-columns:minmax(0,1fr)!important}',
    'html :is(.module-brief,.analytics-hero)>div:first-of-type{grid-column:1!important;grid-row:1!important}',
    'html :is(.module-brief-actions,.analytics-hero-actions){grid-column:1!important;grid-row:2!important;justify-content:flex-start}',
    # Decorative-disabled must remain visibly unavailable after all skin layers.
    'html .btn:disabled{background:var(--bg3)!important;background-image:none!important;color:var(--text2)!important;border-color:var(--border2)!important;box-shadow:none!important;cursor:not-allowed}',
    ]
    for key,bg,surface,inset,accent,action,muted,kind in themes:
        if key not in PROFILES:continue
        family,radius,edge,control=PROFILES[key]
        s=f'html[data-theme="{key}"]'
        border='#a8b6c6' if key=='light' else '#b9aa94' if key=='warm' else '#526376'
        out.append(s+'{--finish-frame:'+frame(family,accent,border)+';--finish-edge:'+edge+';--finish-control:'+control+';}')
        out.append(s+' :is(.module-brief,.analytics-hero,.panel,.order-action-panel,.premium-corder-panel,.erp-visual-panel,.dash-hero-main){position:relative;border-radius:'+radius+';background-image:none!important;box-shadow:inset 0 1px 0 #ffffff0d,var(--shadow)}')
        out.append(s+' :is(.module-brief,.analytics-hero,.panel,.order-action-panel,.premium-corder-panel,.erp-visual-panel,.dash-hero-main)::after{content:"";position:absolute;inset:0;border:16px solid transparent;border-image:var(--finish-frame) 24 / 16px / 0 stretch;pointer-events:none;border-radius:inherit}')
        out.append(s+' :is(.panel-hdr,.panel-head,.order-action-head){background-color:var(--bg3)!important;background-image:var(--finish-edge)!important;background-size:64px 2px!important;background-position:right 22px top 8px!important;background-repeat:no-repeat!important;box-shadow:inset 0 -1px 0 var(--border)}')
        out.append(s+' :is(.module-brief,.analytics-hero){background-color:var(--bg2)!important;background-image:none!important;border-color:var(--border)!important}')
        out.append(s+' :is(.btn,.tab-btn,.module-tab,.qc-tab,.filter-chip,.order-status-chip,.module-pill){border-radius:'+('3px' if family in ['rack','bevel','craft','plain'] else '6px')+';box-shadow:var(--finish-control)}')
        out.append(s+' :is(.tab-btn.active,.module-tab.active,.qc-tab.active,.filter-chip.active,.order-status-chip.active){background:var(--bg3)!important;border-color:var(--cyan2)!important;color:var(--cyan2)!important;box-shadow:inset 3px 0 0 var(--cyan2),var(--finish-control)}')
        out.append(s+' .inp{border-radius:'+('3px' if family in ['rack','bevel','craft','plain'] else '6px')+';box-shadow:inset 0 1px 3px #0000000d}')
        out.append(s+' .ops-hero{background-image:none!important;box-shadow:inset 0 0 0 1px var(--border),inset 0 0 0 5px var(--bg2),inset 0 0 0 6px var(--bg3)}')
        if family=='plain':out.append(s+' :is(.module-brief,.analytics-hero,.panel,.order-action-panel){box-shadow:none}')
    # The legacy premium stat icon left only ~32px for a three-character label
    # on 390px screens. Keep the same two-column cards, reclaim icon padding.
    out.append('@media(max-width:640px){html[data-theme="premium"] .corder-stat{padding:16px 14px 16px 62px}html[data-theme="premium"] .corder-stat::before{left:14px;top:18px;width:34px;height:34px;font-size:18px;box-shadow:none}}')
    out.append('@media print{html :is(.module-brief,.analytics-hero,.panel,.order-action-panel,.premium-corder-panel,.erp-visual-panel,.dash-hero-main)::after{display:none!important}}')
    return '\n'.join(out)
