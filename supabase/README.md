# LEMATEC ERP Supabase

## Production project

- Project: `LEMATEC ERP`
- Project ref: `hemqintfrvsdoplbzanx`
- Region: Singapore (`ap-southeast-1`)
- Dashboard: https://supabase.com/dashboard/project/hemqintfrvsdoplbzanx

## Migration order

1. `migrations/20260717_001_initial_erp_schema.sql`

The first migration created the base schema. Current module ownership and
cutover status are defined by `ERP_DATA_FLOW.md`; do not use this README alone
to infer which production system is authoritative.

## Current production status

- Inventory master and balances: Supabase primary through the Worker.
- BOM: Supabase primary, validated before use; Notion is the mirror/fallback.
- Stock logs: Supabase primary with Notion mirror.
- Video library: Supabase primary with backup fallback.
- Picking: Supabase primary for masters, items, status, and duplicate-action
  protection; Notion is the staff-readable mirror and emergency read-only
  fallback.

Picking migration and operational procedures are documented in
`PICKING_RUNBOOK.md`.

## Core rules preserved

- SKU values are exact text. Leading zeroes and punctuation must not be removed.
- A finished-product order consumes only the direct BOM components. A linked semi-finished component is not recursively exploded.
- A semi-finished assembly order consumes its direct components and adds the semi-finished stock.
- A Shopee production order consumes the direct BOM components and adds the `S-` finished stock when complete.
- A C-side shipment consumes the `S-` finished stock itself and does not explode its BOM.
- All stock writes use `apply_inventory_transaction(...)`, which locks the balance row, prevents negative stock, records before/after quantities, and rejects duplicate idempotency keys.
- Business records use `archived_at` for soft deletion. Hard delete is reserved for Vic/manager policies.
- Legacy Notion IDs are retained for traceability during migration.

## Remaining migration phases

1. Create Supabase Auth users and bind them to `app_users`.
2. Continue moving other high-volume workflow modules only after their own
   export, dry-run, dual verification, mirror, retry, and rollback controls are
   ready.
3. Keep testing existing inventory, BOM, stock-log, and picking workflows before
   retiring any Notion fallback.
