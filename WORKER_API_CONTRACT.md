# LEMATEC ERP Worker API Contract

Updated: 2026-08-04

Worker source: `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.

This file classifies Worker routes by side effect and production safety. Before calling a production endpoint, check this file and the module runbook.

## Safety Classes

| Class | Meaning | Production use |
|---|---|---|
| Read-only | Does not mutate Supabase, Notion, sequence state, or inventory | Safe for cache-busted verification if credentials are not exposed. |
| Dry-run capable | Can validate without mutation when `dry_run: true` or equivalent is supported | Safe only with explicit dry-run payload and before/after count check. |
| Mutating | Writes rows, updates status, queues jobs, mirrors data, or changes stock | Do not call for testing unless the operation is intentional and recoverable. |
| Sequence-mutating | Advances or sets shared numbering | Do not call casually; it changes the future order number. |
| Migration / repair | Backfills or links historical/mirror data | Dry-run first when available; apply only after report review. |

## Route Inventory

| Method | Route | Class | Primary effect | Verification note |
|---|---|---|---|---|
| GET | `/api/board.json` | Read-only | Returns board summary | Safe read. |
| GET | `/erp-board-summary` | Read-only | Returns board summary alias | Safe read. |
| GET | `/api/inventory/versions` | Read-only | Returns inventory/BOM data versions | Safe read; useful first sync probe. |
| GET | `/api/inventory/list` | Read-only | Reads Supabase materials and balances | Safe read; can validate source and row count. |
| POST | `/api/inventory/sync` | Mutating | Upserts inventory master/mirror metadata | Do not test casually. Supabase must accept before Notion mirror. |
| POST | `/api/inventory/adjust` | Mutating | Adjusts one inventory balance | Stock-changing endpoint. Requires intentional transaction. |
| POST | `/api/inventory/adjust-batch` | Mutating | Applies batch inventory adjustment | Stock-changing endpoint. Must preflight in UI before commit. |
| POST | `/api/inventory/material/archive` | Mutating | Archives/merges inventory materials via RPC | Requires duplicate/reference/stock safety review. |
| GET | `/api/inventory/bom/list` | Read-only | Reads Supabase BOM | Safe read; if unusable, frontend may use explicit Notion fallback. |
| POST | `/api/inventory/bom/migrate` | Migration / repair | Migrates/imports BOM into Supabase | Dry-run/report before apply. |
| POST | `/api/inventory/bom/upsert` | Mutating | Writes BOM plan to Supabase, then mirror | Must reject empty, malformed, duplicate, self-referencing, or unmapped BOM. |
| POST | `/api/picking/migrate` | Migration / repair | Migrates picking master/detail rows | Dry-run/report before apply. |
| GET | `/api/picking/summary` | Read-only | Reads picking counts/source | Safe production verification. |
| GET | `/api/picking/list` | Read-only | Reads picking masters/items | Safe read; fallback data must be read-only. |
| POST | `/api/picking/create` | Dry-run capable / Mutating | Creates or resumes picking and may stage deduction workflow | Production test only with `dry_run: true`; never deduct just to test. |
| POST | `/api/picking/status` | Mutating | Updates picking status and may complete workflow | High-risk. Must not run from Notion fallback data. |
| POST | `/api/picking/link-notion` | Migration / repair | Links Notion mirror IDs to Supabase picking rows | Repair only; avoid duplicate mirrors. |
| POST | `/api/inbound/migrate` | Migration / repair | Migrates inbound records | Dry-run/report before apply. Historical stock must not replay. |
| GET | `/api/inbound/summary` | Read-only | Reads inbound counts/source | Safe production verification. |
| GET | `/api/inbound/list` | Read-only | Reads inbound receipts/items | Safe read; fallback data must be read-only. |
| POST | `/api/inbound/create` | Mutating | Creates inbound receipt/item and mirror | Intentional operational write only. Conflicting inbound number should return 409. |
| POST | `/api/inbound/action` | Mutating | Rejects, resubmits, or approves inbound | Approval changes stock once via idempotency key. Do not test on real records casually. |
| POST | `/api/inbound/link-notion` | Migration / repair | Links Notion mirror IDs to Supabase inbound rows | Repair only. |
| POST | `/api/stock-log/sync` | Mutating | Writes stock log to Supabase | Dedupes by `client_trace_id`; do not write test logs to production casually. |
| GET | `/api/stock-log/list` | Read-only | Reads stock logs | Safe read. Supports recent/all/pending modes. |
| POST | `/api/stock-log/mark-notion` | Migration / repair | Marks Notion mirror page ID on Supabase log | Mirror repair only. |
| POST | `/api/notes/shadow/sync` | Migration / repair / Mutating | Syncs Notion Notes into Supabase shadow | Use with care; can update shadow rows. |
| GET | `/api/notes/shadow/list` | Read-only | Reads Notes read model | Safe read. |
| GET | `/api/notes/shadow/summary` | Read-only | Reads Notes summary/counts | Safe read. |
| POST | `/api/notes/shadow/delete` | Mutating | Deletes/archives shadow copy path | Intentional Notes operation only. |
| POST | `/api/notes/write` | Mutating | Writes structured Notes to Supabase, then Notion mirror | Structured Note source is Supabase; attachments remain Notion-backed. |
| POST | `/api/orders/create` | Mutating | Creates a B2B order page in the Notion ERP customer orders database | Idempotent by `orderNo`; accepts `productPageId` or resolves an exact `productCode`; does not reserve C-order numbers. |
| GET | `/api/health/public` | Read-only | Reads public ERP health status and access matrix | Safe public no-side-effect check. |
| GET | `/api/health/supabase-usage` | Read-only | Reads Supabase resource usage RPC | Safe read; egress only when externally measured. |
| POST | `/api/reliability/mirror/enqueue` | Mutating | Enqueues mirror retry job | Repair queue write. Requires dedupe key. |
| GET | `/api/reliability/mirror/list` | Read-only | Lists mirror jobs | Safe read. |
| POST | `/api/reliability/mirror/complete` | Mutating | Marks mirror job complete | Repair workflow only. |
| POST | `/api/reliability/mirror/fail` | Mutating | Marks mirror job failed/retryable | Repair workflow only. |
| GET | `/api/reliability/summary` | Read-only | Reads reliability summary | Safe read. |
| GET | `/api/corder/number-state` | Read-only | Reads shared C-order sequence state and calibrates if RPC does so internally | Production verified on 2026-08-04: `SHPTW`, `next_number=16352`. |
| POST | `/api/corder/number-reserve` | Sequence-mutating | Reserves SHPTW number range | Advances sequence. Never use as a casual test. |
| POST | `/api/corder/number-set` | Sequence-mutating | Moves shared next SHPTW number forward | Restricted to Vic/manager/sales role in payload; never move backwards. |

## No-Side-Effect Production Checks

Preferred production checks:

```text
GET /api/inventory/versions
GET /api/inventory/list?limit=1
GET /api/inventory/bom/list
GET /api/picking/summary
GET /api/inbound/summary
GET /api/stock-log/list?limit=1
GET /api/notes/shadow/summary
GET /api/health/public
GET /api/health/supabase-usage
GET /api/reliability/summary
GET /api/corder/number-state
```

`/api/notes/shadow/summary`, `/api/health/supabase-usage`, and `/api/reliability/summary` require an ERP/Notion bearer token. Without authorization they should return 401, not be treated as broken.

Do not use these as casual checks:

```text
POST /api/corder/number-reserve
POST /api/corder/number-set
POST /api/inventory/adjust
POST /api/inventory/adjust-batch
POST /api/picking/status
POST /api/inbound/action
```

## Dry-Run Expectations

Routes that should support or preserve dry-run semantics for future hardening:

- `/api/picking/create` already has a documented `dry_run: true` production check.
- BOM migration, picking migration, inbound migration, and stock-log backfill should always have report-first tooling.
- Future inventory adjustment and C-order import flows should expose frontend preflight summaries before any mutating Worker call.

## Idempotency Requirements

| Workflow | Stable key |
|---|---|
| Stock log sync | `client_trace_id` |
| Order picking | Order Notion page ID as source key plus stable transaction key |
| Manual picking | Supabase picking master ID or unique pick number |
| Inbound QC pass | `inbound_qc_pass:<supabase-receipt-id>` |
| Mirror retry jobs | `organization_id + dedupe_key` |
| C-order same-order grouping | Shopee order number + buyer account |

Repeated retries must return or repair the existing accepted truth; they must not repeat stock movement, create duplicate masters, or allocate duplicate order numbers.

## Secret Handling

- Worker owns the Supabase service role key.
- Do not put PostgreSQL URLs, service role keys, Notion tokens, or Cloudflare tokens in frontend code, reports, commits, screenshots, or chat output.
- Normal ERP devices do not need Supabase anon keys for inventory, BOM, picking, inbound, or stock log operation.
- Device-local Supabase anon key is only for optional diagnostic comparisons.

## When Updating This File

Update this contract whenever:

- A Worker route is added, removed, or changes side effect.
- A module changes primary store.
- A route gains or loses dry-run support.
- A migration changes production verification requirements.
- A new retry queue or mirror repair path is introduced.
