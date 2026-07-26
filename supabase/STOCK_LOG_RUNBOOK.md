# Supabase Stock Log Runbook

## Current Source-Of-Truth Rule

- ERP frontend writes stock operation logs to Supabase first.
- ERP frontend still mirrors each stock operation log to Notion for backup and staff browsing.
- ERP frontend reads stock operation logs from Supabase first.
- Notion is a fallback/readable mirror, not the performance source for the frontend.

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
