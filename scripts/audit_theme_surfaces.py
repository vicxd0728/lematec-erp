"""Audit theme-independent surfaces in application CSS and inline HTML templates.

Neutral backgrounds must use semantic tokens. Only explicit backdrop/media masks
may retain opaque dark literals. This checks source, NOT rendered accessibility.
"""
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RULE=re.compile(r'([^{}]+)\{([^{}]*)\}')
BG=re.compile(r'(^|;)\s*(background(?:-color|-image)?)\s*:\s*([^;]+)')
RGBA=re.compile(r'rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)')
EXPLICIT_INVERSE={'.modal-bg','.modal-overlay','.video-play','.video-thumb'}
INVERSE_TEXT={'.btn-primary','.btn-blue','.btn-login','.sn','.video-play','.boot-splash','.note-mobile-tabs .active'}
TEXT=re.compile(r'(^|;)\s*color\s*:\s*(#[a-fA-F0-9]{3,8})\b')

def dark(value):
    if any(max(map(int,m.group(1,2,3)))<70 and float(m[4] or 1)>=.35 for m in RGBA.finditer(value)):return True
    for m in re.finditer(r'#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b',value):
        h=m[1];h=''.join(c*2 for c in h) if len(h)==3 else h
        if max(int(h[i:i+2],16) for i in [0,2,4])<70:return True
    return False
def clean_selector(s):return re.sub(r'/\*[\s\S]*?\*/','',s).strip()
def audit(source):
    start=source.index('<style>')+7;end=source.index('</style>',start)
    findings=[]
    for m in RULE.finditer(source[start:end]):
        selector=clean_selector(m[1]);
        # Explicit theme-specific values are still normalized by --fix but aren't a cross-theme failure.
        for bg in BG.finditer(m[2]):
            if dark(bg[3]) and selector not in EXPLICIT_INVERSE:
                findings.append({'kind':'css','selector':selector,'value':bg[3],
                    'start':start+m.start(2)+bg.start(3),'end':start+m.start(2)+bg.end(3)})
        if 'data-theme' not in selector and selector not in INVERSE_TEXT:
            for color in TEXT.finditer(m[2]):
                findings.append({'kind':'text','selector':selector,'value':color[2],
                    'start':start+m.start(2)+color.start(2),'end':start+m.start(2)+color.end(2)})
    for m in re.finditer(r'style="([^"]*)"',source[end:]):
        for bg in BG.finditer(m[1]):
            if not dark(bg[3]):continue
            p=end+m.start();tag=source[source.rfind('<',0,p):p]
            # Media canvas and overlaid remove/play controls pair explicit white with dark.
            if re.search(r'\bcolor\s*:\s*#(?:fff(?:fff)?|f8fafc)\b',m[1],re.I) or re.search(r'<(?:video|canvas)\b',tag) or ('aspect-ratio:16/9' in m[1] and bg[3].strip()=='#000'):continue
            findings.append({'kind':'inline','selector':tag[-90:],'value':bg[3],
                'start':end+m.start(1)+bg.start(3),'end':end+m.start(1)+bg.end(3)})
    return findings

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--fix',action='store_true');parser.add_argument('--report');args=parser.parse_args()
    path=ROOT/'index.html';source=path.read_text(encoding='utf8');rows=audit(source)
    if args.report:
        out=Path(args.report);out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
    if args.fix:
        for row in sorted(rows,key=lambda x:x['start'],reverse=True):
            important='!important' if '!important' in row['value'] else ''
            if row['kind']=='text':
                selector=row['selector']
                token='--cyan2' if any(word in selector for word in ['active','link','kicker','badge']) else '--text' if 'title' in selector else '--text2'
                replacement='var('+token+')'
            else:replacement='var(--bg2)'+important
            source=source[:row['start']]+replacement+source[row['end']:]
        path.write_text(source,encoding='utf8',newline='\n')
        assert not audit(source),'Unresolved fixed dark surface'
    print(json.dumps({'findings':len(rows),'fixed_dark_css':sum(r['kind']=='css' for r in rows),'fixed_text':sum(r['kind']=='text' for r in rows),'inline':sum(r['kind']=='inline' for r in rows),'applied':args.fix,'inline_findings':[r for r in rows if r['kind']=='inline']},ensure_ascii=False))
if __name__=='__main__':main()
