# LEMATEC ERP Current State

Updated: 2026-08-04

This is the single current-state entry point. Use it before reading older timeline notes.

## Live Deployment

- Frontend: `https://lematec-erp.pages.dev/`
- Worker: `https://green-wave-c22f.vic-e93.workers.dev`
- GitHub repo: `vicxd0728/lematec-erp`
- Current repo head: use `git log -1 --oneline` for the exact latest commit.
- Latest Worker code deploy: Health v2 Worker route from `11c195b Add ERP Health v2 current state`; no Worker code is required for the local Preflight/C-order/BOM/mobile v1 frontend batch.
- Latest Pages deploy: verify the current GitHub Actions Pages run after each frontend commit.
- Worker deploy workflow: `Deploy ERP Worker`
- Pages deploy workflow: `Deploy ERP to Cloudflare Pages`

## Verified Production Checks

Last verified on 2026-08-04.

| Check | Access | Result |
|---|---|---|
| `GET /api/inventory/versions` | Public read-only | HTTP 200, Supabase source |
| `GET /api/inventory/list?limit=1` | Public read-only | HTTP 200, Supabase source |
| `GET /api/inventory/bom/list` | Public read-only | HTTP 200, Supabase source |
| `GET /api/picking/summary` | Public read-only | HTTP 200, Supabase source |
| `GET /api/inbound/summary` | Public read-only | HTTP 200, Supabase source |
| `GET /api/stock-log/list?limit=1` | Public read-only | HTTP 200 |
| `GET /api/corder/number-state` | Public read-only | HTTP 200, `SHPTW`, `next_number=16352` |
| `GET /api/health/public` | Public read-only | HTTP 200, `erp-health-v2`, public/authorized/manual split |
| `GET /api/notes/shadow/summary` | Authorized only | HTTP 401 without ERP token |
| `GET /api/health/supabase-usage` | Authorized only | HTTP 401 without ERP token |
| `GET /api/reliability/summary` | Authorized only | HTTP 401 without ERP token |

## Current Data Ownership

- Supabase-primary: inventory master, balances, BOM, stock logs, picking, inbound/QC, Notes structured read model.
- Notion-primary: B2B orders, customers, schedule, leave, C-end/Shopee order pages, Notes attachments/detail blocks.
- C-order SHPTW sequence: Supabase RPC through Worker. Migration is applied and production route is verified. Manual correction is allowed only through the shared Worker `/api/corder/number-set` route, moves the shared next number forward, and must not be implemented as per-device localStorage state.
- Notion mirrors are staff-readable mirrors for Supabase-primary modules. Mirror failure creates retry work; it must not roll back accepted Supabase transactions.

## Deployment Capability

- GitHub CLI is authenticated locally.
- GitHub secrets currently include `CLOUDFLARE_API_TOKEN`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, and `NOTION_TOKEN`.
- `npx wrangler@latest` is available through Node/npm even when no local global `wrangler` is installed.
- Supabase C-order sequence migration workflow exists at `.github/workflows/supabase-corder-sequence.yml`; default use is dry-run first.

## Immediate Optimization Queue

Done: ERP Health v2 separates public read-only checks, authorized checks, and manual follow-up items in production.
In progress locally: Preflight Center v1 covers batch inventory adjustment, C-order import preview, BOM import preview/template, picking deduction preview, inbound approval preview, and the mobile high-frequency audit panel.

1. Preflight Center: add consistent preflight summaries before C-order import, picking completion, inbound approval, BOM import, and batch inventory adjustment.
2. C-order import UX: preview rows, duplicate groups, reserved number range, stock impact, and row-level errors before commit.
3. BOM maintenance: simplified Excel format, missing-material pre-create review, direct-component rule guard, and self/duplicate checks.
4. Mobile audit: orders, Notes, C-order, and inventory adjustment high-frequency screens.

## Known Cleanup

- `CODEX_HANDOFF.md` remains a timeline and contains older resolved blocker text. Prefer this file for current state.
- `ERP_SYSTEM_CONTRACT.md` and `WORKER_API_CONTRACT.md` should be kept aligned when routes or ownership change.
- The worktree contains unrelated BUSA16/temp/report files. Do not delete or commit them as part of ERP feature work unless explicitly requested.
