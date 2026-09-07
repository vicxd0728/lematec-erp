# LEMATEC ERP Current State

Updated: 2026-09-07

This is the single current-state entry point. Use it before reading older timeline notes.

## Order Timeline Release 2026-09-07

- Orders list exposes a read-only `進度` button, including for viewer users with order access. It reads the current order page and displays creation, directly linked picking/QC records, exact order-number stock logs, and the recorded shipping date.
- Picking links use the order page ID; legacy QC and stock-log number matches require a uniquely identified order number. Ambiguity, missing dates, source errors and read limits remain explicit. This is not a reconstructed audit of every status transition, and unrelated inbound receipts are not guessed into the order.
- Worker GET picking list accepts `order_id`; GET stock-log list accepts exact `ref_no`. Opening the timeline never invokes repair queues or stock transactions.
- Validation: 245 Python tests + 47 subtests; 8 timeline runtime cases; desktop and 390px mock-data browser preview inspected without horizontal overflow. Production release is verified by Worker/Pages Actions, frontend readback, and exact-match read probes.

## Atomic Conflict Adjustment Release 2026-09-07

- Notion-to-Supabase quantity corrections now require `expected_stock` and `expected_balance_version`. The new service-role-only `apply_inventory_conflict_transaction` RPC locks the balance, checks original operation identity, compares quantity and timestamp, and calls the existing atomic transaction within the same transaction. HTTP 409 means no stock adjustment was accepted and a new confirmation is required.
- Inventory reads expose `balance_version`; other quantity workflows retain their existing RPC path. Pure Notion mirror writes and material metadata are not part of a cross-store atomic transaction; direct readback remains necessary.
- SKU-only mirror differences are now detected before the manual-only rule is applied.
- Worker deployment runs an isolated PostgreSQL concurrency test, then rollback dry-run and application of the additive function migration before releasing code. Pages waits for Worker SHA alignment before publishing; Worker health retries use unique URLs and a longer wait window.

## Conflict Resolution Safety Release 2026-09-07

- Conflict resolution rereads both stores with unique cache keys before confirmation and immediately afterward. Changed values, versions, or material links stop the write.
- Success requires a fresh per-material readback and a successful full conflict scan without remaining conflict/pending rows for the material.
- Each confirmed operation uses a UUID persisted before writing. Original-browser retries retain the immutable operation and quantity delta. Acknowledged writes enter verification-only mode and cannot replay stock; unrelated subsequent changes require review.
- Same-origin tabs use Web Locks where supported, with an in-tab duplicate-click guard. The later atomic conflict adjustment release above adds a database quantity/version check for Notion adoption. It does not create an atomic Supabase/Notion transaction; mirror and metadata races still require readback.
- User authorized deployment for live testing. Verify Worker and Pages Actions against the release SHA and read back the published resolver before reporting completion.

## Authorization Hardening Release 2026-09-07

- Protected Worker API authorization now verifies access to the fixed LEMATEC materials database, matching the existing frontend login, instead of accepting any valid Notion integration via `users/me`.
- Explicit `system` claims require the Worker's configured integration token. Existing configured-token automation may still omit its role header.
- Frontend token entry, role selection, Vic/manager PIN prompts, saved passwords, and browser session behavior are unchanged.
- This is a company-access boundary improvement, not server-side PIN authentication. Holders of the shared configured token retain the legacy automation capability; individual role proof requires a separate migration of automation credentials and PIN storage/verification.
- Deployment authorized by the user. Worker workflow now checks existing-token access to the login database before deployment and performs a protected read after deployment. Treat the release as verified only when Worker/Pages Actions succeed and `/api/version` matches this commit.

## Reliability And Conflict Controls 2026-09-07

- Worker mutating ERP routes now enforce an operational role matrix using the ERP bearer token plus `X-ERP-Role`. Viewer writes are also blocked in the generic Notion proxy and direct Notion file upload path. The current login still uses a shared Notion integration token, so this prevents role mistakes but is not a substitute for individual identity authentication; Supabase Auth or company SSO remains the future security boundary.
- `GET /api/stock-log/reconcile` compares recent formal `inventory_transactions` with staff-readable `erp_stock_logs`. `POST /api/stock-log/reconcile` can rebuild only missing operation-detail rows; it never changes inventory balances or replays quantity transactions.
- ERP Health manual full check now compares the latest Supabase inventory master with the Notion material mirror. Browser and server `erp_mirror_jobs` pending work is excluded from conflicts. Authorized staff can explicitly adopt Supabase into Notion or adopt a verified Notion edit into Supabase; SKU/relationship mismatches stay manual-only.

## Live Deployment

- Frontend: `https://lematec-erp.pages.dev/`
- Worker: `https://green-wave-c22f.vic-e93.workers.dev`
- GitHub repo: `vicxd0728/lematec-erp`
- Current repo head: use `git log -1 --oneline` for the exact latest commit.
- Latest Worker and Pages deploy: use `GET /api/version` and the current GitHub Actions runs; both must match the same Git SHA.
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

## Stock Log Audit Semantics 2026-09-07

- Current operational rows are audited for quantity math, duplicate moves, picking deduction, inbound stock-in, and Shopee finished-goods stock-in.
- Rows whose source is `notion_backfill` remain searchable historical evidence, but incomplete legacy before/after balances are shown under `歷史資料參考` instead of current actionable errors.
- The audit never changes inventory while classifying historical rows.
- Live read-only verification on 2026-09-07 loaded 7,253 rows: 1,475 current operational rows and 5,778 historical Notion backfill rows. Current quantity-math issues were 0; 270 unverifiable legacy rows were retained as historical references.

## Stock Evidence And Retry Semantics 2026-09-07

- Accepted quantity changes are recorded atomically in Supabase `inventory_transactions`; this is the formal evidence that stock changed.
- `erp_stock_logs` is the staff-readable operation timeline. If its Supabase write is temporarily unavailable after a stock transaction, the ERP shows `操作明細待補` and retains a local retry item.
- If `erp_stock_logs` already exists and only Notion is missing, the ERP shows `Notion 鏡像待補` separately.
- Health v2's `可自動修復` action now runs the complete safe retry set, including mirror queues, Notes shadow, and stock operation details. It does not invoke inventory adjustment, inbound approval, C-order reservation, or any other quantity-changing endpoint.
- Cross-device operation-detail recovery is derived from `inventory_transactions` and uses stable transaction trace keys. It only inserts absent `erp_stock_logs` rows and is safe to retry.

## Known Cleanup

- `CODEX_HANDOFF.md` remains a timeline and contains older resolved blocker text. Prefer this file for current state.
- `ERP_SYSTEM_CONTRACT.md` and `WORKER_API_CONTRACT.md` should be kept aligned when routes or ownership change.
- The worktree contains unrelated BUSA16/temp/report files. Do not delete or commit them as part of ERP feature work unless explicitly requested.
