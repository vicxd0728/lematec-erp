# ERP Reliability Runbook

## Source Of Truth

- Supabase is the primary store for inventory, BOM, stock logs, picking, and inbound records.
- Notion is the staff-readable mirror for those modules.
- Orders, C-end orders, notes, leave, customers, and other modules that have not
  been migrated remain Notion-primary.

## Durable Mirror Queue

Migration:

```text
supabase/migrations/20260729_011_mirror_reliability.sql
```

Table:

```text
public.erp_mirror_jobs
```

The frontend first keeps a local delivery task, then uploads the same task to
`erp_mirror_jobs`. This makes a failed Notion mirror recoverable after a browser
restart or from another signed-in device.

Supported modules:

```text
inventory_supabase
inventory_notion
workflow_notion
bom_notion
```

The Worker validates the ERP Notion token through `GET /v1/users/me` before it
allows queue reads or writes. Database credentials and the Supabase service role
key remain inside Cloudflare Worker secrets.

## Retry Semantics

- New work starts as `pending`.
- A failed attempt becomes `retrying` and uses exponential backoff.
- After five failed attempts it becomes `failed` and requires a manual retry or
  investigation.
- Success becomes `completed`.
- `organization_id + dedupe_key` is unique, so the same mirror task cannot be
  duplicated by repeated clicks.
- The queue repairs the Notion mirror only. It must never replay an already
  accepted inventory transaction.

## Health Check

ERP > Health Check > Data Reliability Center shows:

- pending server mirror jobs;
- jobs that failed five times;
- tasks still waiting in the current browser;
- Supabase records that do not yet have a Notion page id;
- the oldest pending task.

Use `Retry mirror sync` after temporary Notion or network failures. A non-zero
failed count is a release blocker. Pending jobs are a warning until the mirror
finishes; they do not mean the Supabase transaction failed.

## Critical Acceptance Checks

Run:

```powershell
python -m pytest -q
```

Before release, verify:

1. Inventory adjustment writes Supabase before Notion.
2. Picking uses `/api/picking/create` and `/api/picking/status`.
3. Inbound uses `/api/inbound/create` and `/api/inbound/action`.
4. Inbound QC uses a stable `inbound_qc_pass:<id>` idempotency key.
5. A Notion mirror failure creates a durable retry task.
6. Retrying a mirror does not change inventory a second time.

