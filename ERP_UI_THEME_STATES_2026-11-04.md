# Cross-theme visual-state review — 2026-11-04

Authorization: user requested Canva + ERP UI skills, existing architecture/control positions unchanged, desktop/mobile acceptance and direct deployment after fixes, with no production inventory mutations. Later clarification explicitly permits direct deployment of theme changes that do not materially alter overall UI design.

## Design contract and evidence

Read the formal operational-web architecture page `402ff6f424bb81c5a3d1f9eb2162794b`, current ERP handoff/data-flow documents and Canva reference https://canva.link/z002crwcz5h40se (design DAHZ0dsP2jg). Used `lematec-erp-ui-evolution`, `canva-website-visuals`, `crm-erp-workbench-quality` and `lematec-erp-maintenance`. The secondary Canva detail design returned no text; do not claim its content was reviewed this round.

This is visual design of shared states, not a new information architecture. No navigation, controls, dimensions, spacing, content, handlers, permissions, data authority or transaction rules change. Existing defaults, 14 saved theme IDs and industrial-specific refinements remain intact.

## Findings and decisions

1. **Disabled controls:** four representative themes still faded entire buttons to 40% opacity. Replace global fading with opaque inset surfaces and readable muted text. Native disabled semantics/cursor stay enforced. This is a readability refinement, not a claim that disabled controls violate WCAG.
2. **Input focus:** the legacy blue halo persisted in themes whose accent is brown/green/teal. Generate one halo token per theme and pair focus border/outline/halo with the existing accent. No field dimensions change.
3. **Batch selection:** other themes lacked a whole-row selection cue beyond the checkbox. Generate a subtle opaque tint from the theme surface/accent; apply to checked inventory rows with a small inset edge, on desktop tables and mobile cards. Original warning/success text remains visible.
4. **Keep existing surfaces:** initial DOM contrast screening of premium/light/warm/ink actual board/order/inventory renderers and cross-module samples did not reproduce the historical dark-on-dark title failure. Preserve these surfaces and their illustrations rather than inventing a wholesale redesign.

## Verification

- Four themes: 科技青黛 / 亮色企業 / 暖白辦公 / 水墨山河. Chrome at 1280×900 and 390×844.
- 32 before/after view comparisons: 24 actual-renderer views (board/order/inventory), eight component-sample views. Identical element counts and layout geometry within 0.5px. Existing `.panel` fadeUp translateY is subtracted for layout comparison; raw animation-contaminated measurements are retained as intermediate evidence, not reported as passing.
- 32 candidate DOM contrast screenings: no flagged direct-text foreground/background combinations or page overflow. This checks alpha-composited CSS colors, not every image, pseudo-element or a complete accessibility certification.
- Eight actual inventory-state checks: disabled remains disabled with opacity 1; checked row gets the theme tint; clearing selection disables batch action. No API submission.
- Settled focus readback: warm mobile and premium desktop show their own accent border/halo; typing 100 and moving the caret retain the value/selection. Other focus palettes covered by shared generated rule and palette checks, not claimed as individual physical-device acceptance.
- 11 Python tests and 16 Node tests passed, including emitted selection-background contrast for primary/secondary/red/green text across all 14 palettes. Offline deploy-asset/syntax verifier passed.
- Synthetic fixture blocks API connections and form submission through CSP. Production business/inventory writes: 0.

Evidence: `output/theme-round2-20261104/acceptance.json` and workspace `營運管理/outputs/theme-round2-20261104/` screenshots/DOM receipts. Component samples are not authenticated business-flow acceptance; mobile is Chrome viewport, not physical Safari/iOS.

Release assets: stylesheet query v7, service-worker cache v85. Deployment completion additionally requires successful Pages/Worker workflows and exact live stylesheet, application-code and Worker SHA readback.
