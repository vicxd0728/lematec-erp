# Supabase BOM Migration Report

Date: 2026-07-28

## Result

- Source: fresh Notion material and BOM export
- Target: Supabase `bom_headers` and `bom_items`
- Imported materials available for mapping: 1,836
- Active BOM parents: 332
- Imported BOM rows: 967
- Missing rows after migration: 0
- Extra rows after migration: 0
- Quantity mismatches: 0
- Duplicate target rows: 0
- Existing stock quantities changed by this migration: no
- Production BOM read source switched by this migration: no

The exact verification key is:

`parent Notion page ID + component Notion page ID + quantity`

## Held Back

Six source rows were excluded because the parent and component are the same
material. These rows are invalid no-op BOM relations and are rejected by the
Supabase cycle guard:

- `S-Z-SDG-02C -> S-Z-SDG-02C`
- `S-Z-VBG -> S-Z-VBG`
- `S-Z-VBG-02 -> S-Z-VBG-02`
- `S-F-GAB-03D-B -> S-F-GAB-03D-B`
- `S-SDG-02C -> S-SDG-02C`
- `S-VBG-02 -> S-VBG-02`

The complete held-back rows remain in:

`supabase/migration_exports/20260728-174430/bom_rows_self_holdback.csv`

## Evidence

- Migration response:
  `supabase/migration_exports/20260728-174430/bom_migration_result.json`
- Exact comparison:
  `supabase/migration_exports/20260728-174430/bom_worker_verify_report.json`
- Source quality report:
  `supabase/migration_exports/20260728-174430/quality_report.json`

## Safety Boundary

This migration populated and verified Supabase BOM data only. Existing ERP
orders, picking, inbound inspection, and stock deduction continue using the
current production behavior until a separate controlled BOM read cutover and
workflow regression test are completed.
