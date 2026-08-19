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
- Worker deployment integrity: every `main` push redeploys the Worker and stamps
  `ERP_DEPLOY_SHA`; Pages deployment waits for `GET /api/version` to match the
  same GitHub SHA before reporting success.

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
| `GET /api/version` | Public read-only | HTTP 200, Worker source version and deployed Git SHA |
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

## Deployment Integrity

- 2026-08-19 incident: production Worker briefly served an older/inconsistent
  deployment and returned `Unexpected end of JSON input` for public health,
  inventory version, and C-order state checks.
- Immediate repair: redeployed `Deploy ERP Worker`; production public checks
  returned HTTP 200 again.
- Prevention: Worker no longer deploys only when Worker files change. It deploys
  on every `main` push, writes the current Git SHA into Worker vars, and exposes
  `GET /api/version`. Pages deployment now verifies that Worker SHA equals the
  Pages commit and that health, inventory version, C-order state, and video
  library reads all return valid JSON before the deploy is accepted.

## Immediate Optimization Queue

Done: ERP Health v2 separates public read-only checks, authorized checks, and manual follow-up items in production.
Done locally in the current optimization batch: Preflight Center v1 / Preflight Center formalization, C-order import preview / C-order import UX v2, BOM maintenance v2, Mobile audit / Mobile high-frequency v2, and ERP Health repair center. These are frontend-safe workflow/UI improvements; Worker dry-run endpoints for deeper server-side preflight remain a later architecture step.

1. Preflight Center: add consistent preflight summaries before C-order import, picking completion, inbound approval, BOM import, and batch inventory adjustment.
2. C-order import UX: preview rows, duplicate groups, reserved number range, stock impact, and row-level errors before commit.
3. BOM maintenance v2: simplified Excel format, missing-material pre-create review, direct-component rule guard, BOM diff summary, and self/duplicate checks.
4. Mobile high-frequency v2: orders, Notes, C-order, and inventory adjustment quick-entry cards.
5. ERP Health repair center: separate safe auto-repair queues, one-click repair candidates, and manual follow-up items.

## Known Cleanup

- `CODEX_HANDOFF.md` remains a timeline and contains older resolved blocker text. Prefer this file for current state.
- `ERP_SYSTEM_CONTRACT.md` and `WORKER_API_CONTRACT.md` should be kept aligned when routes or ownership change.
- The worktree contains unrelated BUSA16/temp/report files. Do not delete or commit them as part of ERP feature work unless explicitly requested.
