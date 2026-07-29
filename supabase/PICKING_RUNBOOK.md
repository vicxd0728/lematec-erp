# Supabase Picking Runbook

This runbook is the repeatable operating procedure for migrating, validating,
deploying, and repairing the LEMATEC ERP picking workflow.

## Current Ownership

- Supabase is the source of truth for picking masters, items, and status.
- The ERP frontend reads and writes picking data through the Cloudflare Worker.
- Notion is the staff-readable mirror and emergency read-only fallback.
- Inventory deduction is an atomic Supabase transaction with a stable
  idempotency key.
- A fallback Notion record must never be used to complete inventory deduction.

## Production Routes

- `GET /api/picking/summary`
- `GET /api/picking/list`
- `POST /api/picking/migrate`
- `POST /api/picking/create`
- `POST /api/picking/status`
- `POST /api/picking/link-notion`

The Worker uses `SUPABASE_SERVICE_ROLE_KEY`. Never place this key, a PostgreSQL
URL, a Notion token, or a Cloudflare token in frontend code, reports, commits,
screenshots, or chat output.

## Migration Sequence

1. Read `CODEX_HANDOFF.md` and `ERP_DATA_FLOW.md`.
2. Run `git status --short` and preserve unrelated user changes.
3. Export Notion picking master/detail pages.
4. Validate required keys, relations, duplicate page IDs, blank masters, and
   unlinked historical items.
5. Run the migration script without `--apply`.
6. Review the timestamped JSON report and exception list.
7. Run the script with `--apply`.
8. Compare all expected Notion page IDs with Supabase summary IDs.
9. Switch frontend reads/writes only after verification passes.
10. Deploy and run the production dry-run checks below.

Migration tool:

```powershell
python .\scripts\supabase_picking_migrate_via_worker.py
python .\scripts\supabase_picking_migrate_via_worker.py --apply
```

The commands require tokens in the current process environment. Never paste
their values into source files or command history that will be committed.

## Operational Write Order

Order picking:

1. Resolve the direct BOM only.
2. Create or resume the Supabase picking master/items using the order Notion
   page ID as the stable source key.
3. Create the Notion mirror and write its page IDs back to Supabase.
4. Block on missing BOM items or insufficient stock.
5. Deduct inventory atomically in Supabase with a stable idempotency key.
6. Mark the Supabase picking record complete.
7. Update the Notion picking mirror and order mirror.

Manual replenishment:

1. Create a unique manual pick number.
2. Create the Supabase master/items.
3. Create the Notion mirror.
4. On completion, deduct inventory atomically using the Supabase master ID.
5. Update Supabase status, then the Notion mirror.

## Retry And Failure Rules

- Repeated clicks resume the same picking record; they do not create a second
  deduction.
- A Supabase failure blocks the operation and must not be reported as success.
- A Notion mirror failure before a new deduction blocks that deduction.
- A Notion mirror failure after Supabase has accepted the truth is queued for
  retry and must not roll back or repeat the inventory transaction.
- Historical unlinked details may remain visible for audit, but cannot be used
  as current deduction inputs.

## Required Validation

Local:

```powershell
node --check .\cloudflare-worker-green-wave-c22f-FULL-UPDATED.js
python -m unittest tests.test_verify_erp_static
python .\scripts\verify_erp_static.py
git diff --check
```

Production:

1. Confirm `/api/picking/summary` reports `source: supabase`.
2. Confirm `/api/picking/list` returns Supabase master/item data.
3. Submit `/api/picking/create` with `dry_run: true` and one real material.
4. Compare summary master/item counts before and after; both must be unchanged.
5. Fetch `sw.js` and `index.html` with cache-busting query parameters.
6. Confirm the intended service-worker cache version and picking code are live.

Never use a real create or stock deduction merely to test deployment.

## Recovery

- If Supabase picking reads fail, show Notion read-only fallback with an
  explicit warning.
- Disable completion controls while fallback data is shown.
- Inspect the Worker deployment and service-role binding before changing data.
- Re-run the migration tool safely; Notion page IDs make the import idempotent.
- Repair missing Notion mirrors through the frontend retry queue or
  `/api/picking/link-notion`; do not create duplicate Supabase masters.

## Verified Baseline

As of 2026-07-29:

- 126 valid picking masters were verified in Supabase.
- 279 picking detail rows were verified in Supabase.
- 1 completely blank Notion master was explicitly excluded.
- 7 historical details without a safe current material mapping were retained
  for history only.
- Production dry-run passed without changing master/item counts or inventory.
