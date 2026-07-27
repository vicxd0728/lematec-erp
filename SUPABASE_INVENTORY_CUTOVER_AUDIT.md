# Supabase Inventory Cutover Audit

Last updated: 2026-07-27

This file is the working checklist for moving ERP inventory from Notion-first to Supabase-primary without breaking order, picking, inbound, QC, C-end, Shopee, BOM, or duplicate-SKU repair flows.

## Current State

- Supabase schema, inventory import, BOM import, and read-only verification exist.
- ERP inventory display can read Supabase when `lematec_supabase_anon_key` is saved on the device.
- Stock logs are Supabase-first and mirrored to Notion.
- New material creation calls Worker `/api/inventory/sync` with `upsert_material` before creating the Notion mirror.
- Stock quantity updates that pass through `updatePage(...目前庫存...)` call Worker `/api/inventory/sync` with `set_stock` before patching Notion, when the SKU can be identified.
- Notion remains the readable staff mirror.

Do not claim full inventory cutover yet. Order/picking/QC/C-end flows still calculate stock from Notion pages or local cache before calling the shared stock update path.

## Critical Stock Flows

| Flow | Current stock action | Current safety | Remaining risk before full Supabase-primary |
|---|---|---|---|
| Manual stock edit | Sets `目前庫存` through `updatePage` | Supabase `set_stock` first when SKU is found | Absolute set, not transaction delta; stale UI can overwrite newer stock |
| New material | Creates material through `createPage(DB.materials, ...)` | Supabase `upsert_material` first | Notion mirror can still fail after Supabase succeeds; repair queue must be monitored |
| Regular B2B picking with BOM | Deducts direct BOM children only | Passes through shared stock update | Uses Notion latest stock to calculate; should move to Supabase transaction delta |
| Regular B2B picking without BOM | Deducts finished product itself | Passes through shared stock update | Same stale-read risk |
| Semi-finished assembly | Deducts parts, then adds semi-finished on completion | Passes through shared stock update | Must keep rule: semi-finished order deducts parts and adds semi-finished |
| Finished product order using semi-finished child | Deducts the semi-finished child itself, not its lower-level parts | Existing flow text and picking code follow this rule | Must regression-test every BOM after switching transaction endpoint |
| Inbound QC pass | Adds inbound material quantity after QC pass | Passes through shared stock update | Uses Notion latest stock; rate-limit or duplicate click can produce mismatch |
| Inbound QC reject/resubmit | Does not add stock until pass | Not directly stock-changing before pass | Need verify resubmit does not create duplicate inbound stock movement |
| C-end shipment | Deducts `S-` SKU itself | Passes through shared stock update | Must not deduct regular finished product by mistake |
| C-end return | Adds back `S-` SKU | Passes through shared stock update | Needs idempotency if user retries |
| Shopee S-order production complete | Adds `S-` finished stock | Passes through shared stock update | Must not expand S BOM at completion; picking already consumed components |
| Temporary supplemental picking | Deducts selected material | Passes through shared stock update | Needs transaction and idempotency |
| Duplicate SKU merge | Transfers stock to linked keeper, then archives duplicate | Passes through shared stock update for keeper | Archived/duplicate Notion pages can break mirror unless Supabase material link is repaired first |
| BOM maintenance | Updates Notion BOM relations | Not inventory-changing | Supabase BOM mirror still needs verification after each bulk update |

## Cutover Acceptance Checks

Before enabling Supabase as the editable inventory source in the UI, verify all of these:

1. `Worker /api/inventory/transaction` or equivalent exists and calls Supabase `apply_inventory_transaction`.
2. Every stock delta flow uses a unique idempotency key, based on flow type + source page/order id + material id + action.
3. Supabase rejects negative stock unless the flow is explicitly allowed to force-adjust.
4. Notion mirror updates only after Supabase success.
5. If Notion mirror fails, the ERP records a pending mirror repair instead of pretending everything is complete.
6. Health check verifies Notion/Supabase quantity differences after test writes.
7. Mobile and desktop flows use the same stock service.
8. Static check passes.
9. Test scenarios below pass.

## Required Scenario Tests

Use test SKUs or a controlled staging dataset before production cutover.

| Scenario | Expected result |
|---|---|
| Manual edit stock +10 | Supabase balance changes first; Notion mirror follows; stock log created |
| Create new material | Supabase material and balance exist before Notion mirror page |
| B2B product with BOM direct parts | Each direct child decreases by required quantity |
| B2B product with semi-finished child | Semi-finished child decreases; its lower-level parts do not decrease |
| B2B product without BOM | Finished product decreases |
| Semi-finished assembly completion | Parts were deducted; semi-finished stock increases |
| Inbound QC pass | Inbound material stock increases once |
| Inbound QC reject then resubmit then pass | Stock increases only after the final pass |
| C-end upload/shipment | `S-` SKU decreases, not regular product SKU |
| C-end return | `S-` SKU increases |
| Shopee S-order complete | `S-` SKU increases after production completion |
| Duplicate merge | Keeper keeps links, receives duplicate stock, duplicate is archived |
| Rapid double click | Second request is ignored/deduped or returns same transaction |
| Two devices edit same stock | Supabase transaction prevents lost update |

## Next Implementation Order

1. Add Worker inventory transaction route.
2. Add frontend stock transaction helper.
3. Convert stock-changing flows one by one, starting with manual stock edit, inbound QC pass, and picking.
4. Add health-check section showing which flows are transaction-enabled.
5. Enable Supabase-backed inventory editing only after the scenario tests pass.
