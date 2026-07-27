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

Important: stock operation logs and the main ERP inventory quantity write paths
are now designed as Supabase-first. Notion remains the staff-readable mirror.

Current inventory read behavior after 2026-07-27 Worker inventory list cutover:

- ERP frontend loads inventory materials from Worker route `GET /api/inventory/list`.
- The Worker reads Supabase `materials` and `inventory_balances` with the service
  role key, so staff devices do not need to enter a Supabase anon key for normal
  inventory browsing.
- Rows with `notion_page_id` keep that Notion page id as the frontend operational
  id, so existing order, picking, inbound, and BOM relation flows can still match
  existing Notion-linked records.
- If Worker/Supabase inventory loading fails, the frontend falls back to Notion
  materials so staff are not blocked.
- The health-check anon key is only for deeper diagnostic reads such as BOM view
  comparison; it is not required for normal inventory read/write operation.

Current inventory write behavior after 2026-07-27 inventory adjustment cutover:

- New material pages in the ERP frontend call `/api/inventory/sync` first with
  `upsert_material`. If Supabase rejects the material, the frontend does not create
  the Notion mirror page.
- Stock quantity deltas and absolute stock settings in the ERP frontend call
  Worker route `POST /api/inventory/adjust` first. The Worker writes Supabase
  balances with the service role key.
- If Supabase rejects the stock write, the Notion mirror update is not attempted
  and the ERP operation must show an error.
- After Supabase accepts the stock write, the frontend patches the Notion
  `目前庫存` mirror and queues a follow-up `/api/inventory/sync` task so Supabase
  can keep the Notion page id and mirror metadata.
- Covered stock paths include manual stock edit, order picking, manual picking,
  inbound QC pass, manual inbound stock-in, manual QC stock-in, semi-finished
  stock-in, C-end shipment/return, Shopee BOM deduction, Shopee S-stock completion,
  and duplicate-material stock merge.
- Create-page initial stock is still protected by `/api/inventory/sync`
  `upsert_material`, then mirrored to Notion.

Target inventory write behavior:

- ERP frontend continues to submit inventory quantity changes to Worker
  transaction endpoints.
- Worker writes Supabase first.
- Worker or a sync job mirrors successful changes to Notion.
- If Supabase rejects the write, the ERP frontend must show failure and avoid fake success.
- Notion manual edits should be detected by a separate Notion-to-Supabase sync job
  or change-request queue.
  Notion can be a human editing surface, but Supabase remains the accepted source of truth.

Do not claim Notion is fully two-way until the Notion-to-Supabase detection/sync
job exists and is verified. BOM maintenance also remains Notion-led unless a
separate BOM cutover is implemented.

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
