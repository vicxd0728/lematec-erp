# ERP appearance finish — 2026-11-04

Scope: refine the existing optional 精密暖灰 (`industrial`) theme using the approved Canva direction. Keep navigation, control positions, sizing, permissions and business logic unchanged. The default theme and all saved theme IDs remain unchanged.

Canva reference: https://canva.link/z002crwcz5h40se

## Findings and changes

- Disabled actions previously faded the whole button to 40% opacity. Use an opaque subdued surface and readable muted text; native disabled behavior remains enforced.
- Inputs retained the old blue focus shadow inside the orange warm-grey theme. Pair a white editable surface with an orange border, outline and subtle halo.
- Batch-selected inventory rows were hard to scan beyond the checkbox. Add a pale warm fill and inset edge to checked rows, on desktop tables and mobile cards. No stock values or transaction handlers change.

All new CSS rules are scoped to `industrial`. Only paint properties change; no dimensions, spacing, order or positioning change. Stylesheet query v6 and service-worker cache v84 refresh cached assets.

## Verification

- Chrome at 1280×900 and 390×844: actual order, inventory and board renderers with synthetic data; separate component samples for other modules.
- Eight controlled before/after comparisons: identical control geometry within 0.5px, identical element counts, no page overflow.
- Desktop/mobile checks: checked rows receive the new background; selection enables the existing batch action; clearing selection restores its disabled state. Disabled opacity is 1 with native disabled=true. Settled input focus uses the orange border/shadow on both sizes. No fixture UI errors observed.
- 10 Python theme/static tests, 16 Node theme-picker/order-workbench/input-stability tests and the offline static deployment verifier passed.
- Fixture CSP prohibits API connections and form submissions. Production inventory/business write requests: 0.

Evidence: local `output/ui-finish-20261104/acceptance.json`; screenshots and detailed geometry in `C:/Users/vicxd/Documents/Codex/營運管理/outputs/ui-finish-20261104/`.

Limits: phone-sized desktop Chrome, not physical iOS/Safari. Component samples do not prove authenticated module workflows or real modal overlay behavior. Production deployment acceptance requires successful workflows plus exact published asset and Worker SHA readback; a successful fixture alone does not establish deployment.
