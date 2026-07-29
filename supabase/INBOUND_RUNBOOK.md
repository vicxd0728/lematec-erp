# Supabase Inbound Runbook

Updated: 2026-07-29

## Ownership

- Supabase is the primary database for inbound receipts, inbound items, QC status, and accepted stock increases.
- The ERP frontend reads and writes inbound data through the Cloudflare Worker. A device-local Supabase key is not required.
- Notion remains the human-readable mirror. It is not allowed to approve, reject, resubmit, or increase stock when the ERP is showing fallback data.
- Orders and other modules that still live in Notion keep using their Notion page IDs as stable cross-database references.

## Production Flow

### Create

1. Validate inbound number, material, and positive quantity.
2. Resolve the material in Supabase.
3. Create one Supabase receipt and one item.
4. Create the Notion mirror.
5. Write the Notion page IDs back to Supabase.
6. If the mirror fails, keep the Supabase record and queue a mirror retry.

An existing inbound number is accepted only as an idempotent retry when its material and quantity are identical. A conflicting reuse returns HTTP 409.

### Reject

1. Reject only an unstocked inbound receipt.
2. Save return target, reason type, and optional reason in Supabase.
3. Mirror the status and notes to Notion.
4. Do not change inventory.

### Resubmit

1. Resubmit only an unstocked rejected receipt.
2. Allow correction of material, quantity, and notes.
3. Change the Supabase status back to pending QC.
4. Mirror the corrected receipt to Notion.

### Approve

1. Require exactly one valid item and a resolved Supabase material.
2. Call the atomic inventory transaction RPC with:
   - source type `inbound_qc_pass`
   - source ID equal to the Supabase inbound receipt ID
   - idempotency key `inbound_qc_pass:<receipt-id>`
3. Increase stock exactly once.
4. Save the inventory transaction ID on the inbound item.
5. Mark the receipt as QC passed and stocked.
6. Mirror the accepted result to Notion.

Repeated clicks, reconnects, and retries must return the existing transaction and never add stock twice.

## API Contract

- `GET /api/inbound/list`
- `GET /api/inbound/summary`
- `POST /api/inbound/migrate`
- `POST /api/inbound/create`
- `POST /api/inbound/action`
- `POST /api/inbound/link-notion`

The Worker owns the Supabase service role key. Never expose PostgreSQL credentials or the service role key to the frontend.

## Historical Migration

Migration tool:

`scripts/supabase_inbound_migrate_via_worker.py`

Verified migration:

- Source receipts: 1,048
- Migrated receipts: 1,048
- Migrated items: 1,048
- Missing Notion receipt IDs after verification: 0
- Historical duplicate inbound numbers: 44, preserved as separate records by Notion page ID
- Historical items without a safe material relation: 24, preserved with a null material link
- Historical stock transactions replayed: 0

Historical rows are records only. Never replay their stock increases during migration.

## Verification Gate

Before deployment:

1. Run `node --check cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.
2. Run `python -m py_compile scripts/supabase_inbound_migrate_via_worker.py`.
3. Run `python scripts/verify_erp_static.py`.
4. Confirm `/api/inbound/summary` reports 1,048 receipts and 1,048 items.
5. Confirm a read-only `/api/inbound/list` request succeeds.
6. Test create, reject, resubmit, approve, and repeated approve with a disposable test record.
7. Confirm repeated approve changes stock only once.
8. Confirm Notion mirror failure does not roll back an accepted Supabase transaction and remains retryable.

## Rollback

- Frontend fallback is read-only and exists only for temporary visibility.
- To stop operational writes, disable inbound action controls rather than writing back to Notion.
- Restore Worker and frontend from the previous Git commit.
- Do not replay historical inbound records as inventory transactions.
- Reconcile any accepted Supabase transaction by idempotency key before retrying an interrupted approval.
