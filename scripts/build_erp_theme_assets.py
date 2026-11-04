"""Cut/tint approved generated material assets into small local WebP UI pieces.

Input: JSON mapping material family to original PNG path. Originals remain untouched.
Usage: python scripts/build_erp_theme_assets.py source-manifest.json
"""
import hashlib
import gc
import io
import json
from pathlib import Path
import sys
import subprocess
import shutil

from PIL import Image, ImageOps
from generate_erp_themes import ART_FAMILIES, THEMES

ROOT = Path(__file__).resolve().parents[1]


def mix(a, b, amount):
    return tuple(round(x * (1-amount) + y * amount) for x, y in zip(a, b))


def rgb(color):
    return tuple(int(color[i:i+2], 16) for i in (1, 3, 5))


def contrast(a, b):
    def lum(color):
        values=[v/255 for v in color]
        return sum((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4)*w
                   for v,w in zip(values,[.2126,.7152,.0722]))
    low,high=sorted([lum(a),lum(b)])
    return (high+.05)/(low+.05)


def build(sources, only=None):
    dest = ROOT / 'icons' / 'themes'
    dest.mkdir(parents=True, exist_ok=True)
    records = []
    for key, _, surface, inset, accent, _, muted, _ in THEMES:
        if only and key!=only:
            continue
        family = ART_FAMILIES[key]
        with Image.open(sources[family]) as original:
            raw = ImageOps.autocontrast(original.convert('L'), cutoff=1)
            # Paper/stone/ink sources have light blank left; other sources dark.
            light_source = family in ['paper', 'arch', 'ink']
            light_theme = key in ['light', 'warm', 'ink', 'industrial']
            base = rgb(inset)
            primary='#252a2d' if key=='industrial' else '#19283b' if light_theme else '#f0f5fa'
            ink=[rgb(primary),rgb(muted),rgb(accent)]
            amount=.15 if light_theme else .18
            while amount>0:
                detail=mix(base,rgb(accent),amount)
                if min(contrast(fg,detail) for fg in ink)>=5.5:
                    break
                amount=max(0,amount-.01)
            detail=mix(base,rgb(accent),amount)
            image = ImageOps.colorize(raw, detail if light_source else base,
                                     base if light_source else detail)
            # Reserved illustration cells contain no live text: retain richer material detail there.
            ornament=mix(base,rgb(accent),.35 if light_theme else .42)
            detail_image=ImageOps.colorize(raw,ornament if light_source else base,
                                          base if light_source else ornament)
            pieces = {
                'header': image.resize((1024, 342), Image.Resampling.LANCZOS),
                'detail': ImageOps.fit(detail_image.crop((image.width * .64, 0, image.width, image.height)),
                                      (320, 240), Image.Resampling.LANCZOS),
            }
            for kind, piece in pieces.items():
                path = dest / f'{key}-{kind}-v1.webp'
                # Leave contrast headroom for resampling and WebP's YUV conversion.
                png=io.BytesIO()
                piece.save(png,'PNG')
                encoder=shutil.which('ffmpeg')
                if not encoder:
                    raise RuntimeError('ffmpeg is required to encode reviewed WebP assets')
                result=subprocess.run([encoder,'-hide_banner','-loglevel','error','-f','image2pipe',
                                       '-i','pipe:0','-c:v','libwebp','-quality','90',
                                       '-f','webp','pipe:1'],input=png.getvalue(),capture_output=True,check=True)
                path.write_bytes(result.stdout)
                records.append({'theme': key, 'family': family, 'kind': kind,
                                'file': path.relative_to(ROOT).as_posix(),
                                'size': list(piece.size), 'bytes': path.stat().st_size,
                                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
                png.close()
                piece.close()
            image.close()
            detail_image.close()
            raw.close()
        gc.collect()
    return records


if __name__ == '__main__':
    source_path=Path(sys.argv[1])
    if len(sys.argv)>2:
        print(json.dumps(build(json.loads(source_path.read_text(encoding='utf8')),sys.argv[2])))
    else:
        # Bound native image/encoder memory per palette; publish the manifest only after all succeed.
        records=[]
        for key,*_ in THEMES:
            result=subprocess.run([sys.executable,__file__,str(source_path),key],
                                  capture_output=True,text=True,check=True)
            items=json.loads(result.stdout)
            if len(items)!=2:
                raise RuntimeError('Incomplete theme asset build: '+key)
            records.extend(items)
        (ROOT/'icons/themes/manifest.json').write_text(json.dumps(records,indent=2),encoding='utf8')
        print(json.dumps({'assets':len(records),'bytes':sum(x['bytes'] for x in records)}))
