# 精密暖灰 — integrated backplate correction

User rejected the independently framed material picture in the order-page introduction. Requested one-piece background/border/interface composition, with game UI as possible inspiration, starting with 精密暖灰 only. This supersedes preserving the erroneous decorative tile's space. Other theme designs remain unchanged.

## Design contract

- Use strategy/HUD composition principles (shared backplate, inset rim, edge-based state accent) without copying a particular game's assets or claiming a researched game reference.
- Remove the decorative `::before` image and its grid column in industrial module/analytics introductions. Blend the existing material into the full backplate under a strong reading veil.
- Integrate warm header washes, inset separators, compact 12px frame corners and matching orange selected-state rules. No standalone image frame remains in industrial introduction blocks.
- Preserve existing navigation, functional areas, field/button order, labels, sizes, permissions and transaction handlers. Removing the incorrect art space intentionally reduces introduction height and moves following content upward. Do not claim every absolute screen coordinate is unchanged.
- Only industrial selectors are added. Exact generated CSS comparison after removing the new block equals the previous release, establishing no other palette changes. Theme ID remains industrial; picker description updated to 一體底板・細緻邊框・工業橘.

## Observed acceptance

- Actual order renderer with synthetic data in Chrome at 1280×900 and 390×844.
- Introduction height: desktop 159.60 → 137.21px; mobile 200.20 → 162.91px. Decorative pseudo-element `display:none` at both sizes.
- Visible functional control sequence/labels/dimensions exactly match before (desktop22/mobile23); no page overflow or fixture errors.
- Typing into the mobile search field works. The stripped fixture does not execute the full submitted search/count contract; no E2E search success claim. Existing search/state unit checks pass.
- Scene-off: integrated image background none and independent tile still absent; restored via existing UI.
- 12 Python checks and 16 Node checks passed. Browser screenshots and receipts: workspace `營運管理/outputs/industrial-integrated-20261104/`; acceptance summary: `output/industrial-integrated-20261104/acceptance.json`.
- Fixture blocks formal API connections. Formal inventory/business writes: 0. Physical mobile/Safari and authenticated formal transactions not exercised.

Release assets: CSS query v9, service-worker cache v87. Requires successful workflows plus exact live application/CSS/Worker SHA and existing raster hash readback. This is a visual correction; user aesthetic acceptance remains a separate judgment.
