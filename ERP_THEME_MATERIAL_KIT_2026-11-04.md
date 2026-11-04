# Generated UI material kit — 2026-11-04

User rejected the dense grid behind 料件主檔 and explicitly requested generated backgrounds, border details and cropped reusable UI materials, then asked to redesign the visual layer of the existing themes. Standing authorization permits direct deployment of theme refinements after desktop/mobile checks, while preserving layout/operations and formal inventory.

## Design and implementation

- Six newly generated abstract material sources: matte metal, porcelain/paper, stone arch relief, ink landscape/waterfall, ocean ripples, plum orbital relief. These are decorative materials, not factual product illustrations.
- 28 local WebP pieces for the existing 14 theme IDs: 1024×342 header strips and 320×240 detail crops. Theme-specific tonal mapping preserves each palette. Total 91,518 bytes; no remote runtime image service.
- Replace the repeating grid in panel headers with quiet material strips. Replace existing reserved module illustration cells with richer detail crops and a fine inset frame. Board hero uses the bounded header material. All live titles, counts and buttons remain HTML.
- Reading tables/forms remain opaque. Remove decorative full-page grid/orbit/landscape backgrounds to keep the work area calm. The existing scene toggle disables material header/hero backgrounds and keeps its original illustration-cell hiding behavior.
- No dimensions, spacing, ordering, navigation, permissions, event handlers, data authority or transaction rules changed. Stylesheet query v8; service-worker cache v86.

## Production assets and rebuilding

- Source: `scripts/generate_erp_themes.py`; generated CSS: `erp-themes.css`.
- Palette/family mapping: `ART_FAMILIES`. Assets and hashes: `icons/themes/manifest.json`.
- Crop/tonal-map builder: `scripts/build_erp_theme_assets.py`, using Pillow and installed ffmpeg. Supply a private JSON map of family to original PNG. Original paths are local execution artifacts, not committed.
- Palette builds run in separate bounded subprocesses; the manifest publishes only after all 14 complete. This avoids accumulating native image/encoder resources. Header mapping has extra contrast headroom for resampling/encoding; illustration cells can retain more detail because they contain no live text.
- Generator output/manifest is deterministic for the selected inputs and local encoder version; compare published hashes to the committed manifest rather than assuming cross-version encoder byte identity.

## Observed verification

- Fourteen themes at 1280×900 and 390×844: 28 actual inventory-renderer views, synthetic data, all header/detail assets present, no page overflow or fixture errors. Screenshots wait for existing panel entrance opacity to settle.
- Board/order actual renderers in premium and ink at both sizes: eight before/after comparisons against the prior release baseline, identical component counts and layout geometry within 0.5px after excluding original entrance translation.
- Scene-off readback: header background `none`, detail cell `display:none`; scene restored through the existing UI.
- Compressed header image pixel check across primary/secondary/accent text: all 14 exceed 4.5:1, worst 4.647:1. This is not a full accessibility certification; other semantic badges retain their opaque surfaces.
- 12 Python theme/static/material tests and 16 focused Node picker/order/input tests passed; offline deploy syntax/assets verification passed. CI now checks all 28 local raster references, hashes, format and byte budget.
- Fixture embeds exact local WebP bytes and blocks API connections/forms through CSP. No production business/inventory writes.

Evidence: `output/theme-art-kit-20261104/acceptance.json`, `pixel-contrast.json`; workspace `營運管理/outputs/theme-art-kit-20261104/` screenshots, 14-theme contact sheet, view/geometry/toggle receipts. Generated original PNGs remain separate from shipping crops.

Limits: synthetic renderer data and Chrome mobile viewport, not authenticated formal business transactions or physical iOS/Safari. Other module headers share the CSS but were not each exercised end to end. Deployment requires successful workflows, exact CSS/application/Worker version readback and all 28 live image MIME/hash checks.
