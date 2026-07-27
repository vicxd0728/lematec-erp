# Supabase Stock Log Runbook

## Current Source-Of-Truth Rule

- ERP frontend writes stock operation logs to the Cloudflare Worker first.
- The Worker writes stock operation logs to Supabase `erp_stock_logs` with the service role key.
- ERP frontend still mirrors each stock operation log to Notion for backup and staff browsing.
- ERP frontend reads stock operation logs from the Worker/Supabase first.
- Notion is a fallback/readable mirror, not the performance source for the frontend.
- If Supabase log writing fails, the ERP operation must surface an error instead of pretending success.
- If Supabase succeeds but Notion mirror fails, the log remains valid in Supabase and the Notion mirror is treated as pending repair.
- During Worker rollout, the frontend may temporarily fall back to direct Supabase REST when an anon key exists.
- If both Worker and REST are unavailable, the frontend writes the Notion mirror and stores a pending Supabase repair entry so staff operations are not blocked silently.

## Frontend / Worker Routes

Production frontend:

```text
index.html
```

Required Worker routes:

```text
POST /api/stock-log/sync
GET  /api/stock-log/list
POST /api/stock-log/mark-notion
```

`POST /api/stock-log/sync` accepts one stock log item from the ERP frontend and
deduplicates by `client_trace_id`.

`GET /api/stock-log/list` returns rows from `stock_logs_public`, normally limited
to the recent window used by the ERP first-load mode.

`POST /api/stock-log/mark-notion` is used by the repair job after a Supabase log
has been mirrored to Notion. It writes the Notion page id back to
`erp_stock_logs.notion_page_id`, so future repair runs do not duplicate pages.

Local pending storage:

```text
lematec_stock_log_pending_v1
```

This localStorage queue is only for visible repair state. It should not be treated
as the source of truth.

## Inventory Quantity Cutover Status

Important: stock operation logs are now designed as Supabase-first, but inventory
quantity changes are not yet fully Supabase-transaction-first.

Current inventory write behavior after 2026-07-27 frontend guard:

- New material pages in the ERP frontend call `/api/inventory/sync` first with
  `upsert_material`. If Supabase rejects the material, the frontend does not create
  the Notion mirror page.
- Stock quantity changes in the ERP frontend call `/api/inventory/sync` first with
  `set_stock` when the current cache can identify the SKU. If Supabase rejects the
  stock write, the Notion mirror update is not attempted.
- After Supabase accepts the frontend write, Notion is still patched as the
  staff-readable mirror.
- The frontend still queues a follow-up mirror task after the Notion page is
  created or patched, so Supabase can store the Notion page id and latest mirror
  metadata.
- Some legacy paths can still fall back to Notion-first when a SKU cannot be built
  from the current frontend cache. These paths need targeted cleanup before claiming
  full inventory cutover.

Target inventory write behavior:

- ERP frontend submits inventory quantity changes to a Worker inventory transaction endpoint.
- Worker writes Supabase first.
- Worker or a sync worker mirrors the successful change to Notion.
- If Supabase rejects the write, the ERP frontend must show failure and avoid fake success.
- Notion manual edits should be detected by a separate Notion-to-Supabase sync job.
  Notion can be a human editing surface, but Supabase remains the accepted source of truth.

Do not claim inventory is fully Supabase-primary until this target behavior is implemented
and verified across inbound QC, order picking, Shopee S-stock flow, manual stock edits,
duplicate material repair, and BOM maintenance.

## GitHub Heartbeat

Workflow:

```text
.github/workflows/supabase-heartbeat.yml
```

Schedule:

- Monday 10:17 Taiwan time
- Thursday 10:17 Taiwan time

Required GitHub secret:

```text
SUPABASE_ANON_KEY
```

If this secret is missing, the workflow exits successfully with a warning instead
of sending a failure notification. The actual keepalive read starts only after
the secret is added.

The workflow reads one row from:

```text
stock_logs_public
```

This is intentionally a read-only REST request. It does not create test data.

## Backfill Old Notion Stock Logs

Use dry-run first:

```powershell
$env:NOTION_TOKEN = "ntn_xxx"
python .\scripts\backfill_notion_stock_logs_to_supabase.py
```

Apply after reviewing the generated report:

```powershell
$env:NOTION_TOKEN = "ntn_xxx"
$env:SUPABASE_DB_URL = "postgresql://..."
python .\scripts\backfill_notion_stock_logs_to_supabase.py --apply
```

Output reports are written under:

```text
supabase/migration_exports/stock_log_backfill/
```

## Safety Notes

- Backfill skips Notion pages whose `notion_page_id` already exists in Supabase.
- Backfilled rows use `source = notion_backfill`.
- New ERP frontend rows use `source = erp_frontend`.
- Direct Codex sync jobs should use `source = codex_sync`.

## Mirror Supabase Stock Logs Back To Notion

When Supabase is the primary log store, Notion still needs a readable mirror for staff lookup. Use this job to repair rows that exist in Supabase but do not yet have a Notion page id.

Dry-run first:

```powershell
$env:NOTION_TOKEN = "ntn_xxx"
$env:SUPABASE_DB_URL = "postgresql://..."
python .\scripts\sync_supabase_stock_logs_to_notion.py --limit 50 --days 14
```

If the local machine does not have `SUPABASE_DB_URL`, the script falls back to the
Worker routes automatically:

```powershell
$env:NOTION_TOKEN = "ntn_xxx"
python .\scripts\sync_supabase_stock_logs_to_notion.py --limit 50 --days 14
```

Apply after reviewing the report:

```powershell
$env:NOTION_TOKEN = "ntn_xxx"
$env:SUPABASE_DB_URL = "postgresql://..."
python .\scripts\sync_supabase_stock_logs_to_notion.py --limit 50 --days 14 --apply
```

Worker fallback can also apply repairs without exposing the database URL locally:

```powershell
$env:NOTION_TOKEN = "ntn_xxx"
python .\scripts\sync_supabase_stock_logs_to_notion.py --limit 50 --days 14 --apply
```

Output reports are written under:

```text
supabase/migration_exports/stock_log_supabase_to_notion/
```

Safety behavior:

- The job only scans Supabase rows whose `notion_page_id` is empty.
- It searches Notion first and links an existing matching page when there is exactly one safe match.
- It creates a new Notion page only when no matching page is found and `--apply` is used.
- It skips ambiguous matches instead of guessing.
- After linking or creating, it writes the Notion page id back to Supabase.
