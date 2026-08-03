# LEMATEC ERP System Contract

Updated: 2026-08-03

This file is the current operating contract for the ERP. Use it to decide what is safe now. Use `CODEX_HANDOFF.md` as the timeline and `ERP_DATA_FLOW.md` as the deeper data-flow history.

## Source Of Truth

- Production frontend source: `index.html`.
- Production Worker source: `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.
- Production Pages URL: `https://lematec-erp.pages.dev/`.
- Production Worker URL: `https://green-wave-c22f.vic-e93.workers.dev`.
- Figma files are discussion drafts only. They are not source of truth, not Code Connect bindings, and not deployment inputs.

## Current Module Ownership

| Module | Primary store | Read path | Write path | Fallback / mirror | Operational rule |
|---|---|---|---|---|---|
| Inventory master and balances | Supabase | ERP -> Worker -> Supabase | ERP -> Worker -> Supabase, then Notion mirror | Notion can be visible fallback for reads | Supabase must accept writes before ERP reports success. |
| BOM | Supabase | ERP -> Worker -> Supabase BOM | ERP -> Worker BOM upsert/migrate, then Notion mirror | Notion BOM is explicit fallback only when Supabase BOM is unusable | Empty, malformed, duplicated, or unmapped BOM blocks BOM-dependent work. |
| Stock logs | Supabase | ERP -> Worker -> Supabase | ERP -> Worker -> Supabase, then Notion mirror | Notion is human-readable mirror, not write-first fallback | If Supabase log write fails, the ERP operation must surface failure. |
| Picking | Supabase | ERP -> Worker -> Supabase | ERP -> Worker -> atomic Supabase transaction, then Notion mirror | Notion is emergency read-only fallback | Never complete deduction from fallback Notion data. |
| Inbound / QC | Supabase | ERP -> Worker -> Supabase | ERP -> Worker -> atomic Supabase transaction, then Notion mirror | Notion is human-readable mirror | QC approval uses `inbound_qc_pass:<receipt-id>` and must increase stock once only. |
| Notes structured data | Supabase | ERP -> Worker -> Supabase | ERP -> `POST /api/notes/write` -> Supabase, then Notion mirror | Notion detail blocks and attachments remain formal attachment source | Notion manual edits must not overwrite newer Supabase Notes automatically. |
| Notes attachments | Notion | Note detail page / Notion | Worker Notion file upload and append blocks | Supabase stores structured read model only | Attachments over 20 MB are completed manually from the Notion page. |
| C-end / Shopee orders | Notion C-order database | ERP -> Notion | ERP -> Notion C-order page plus inventory transaction where applicable | Legacy C-order database is archive only | Do not write new C-orders to the legacy archive. |
| C-order SHPTW sequence | Planned Supabase sequence | Worker route after migration and deploy | Worker reserve/set RPC after migration and deploy | Current production is not verified as live | Do not deploy sequence-dependent frontend until migration and Worker route are verified. |
| B2B orders, customers, leave, schedule | Notion | ERP -> Notion | ERP -> Notion | Notion is primary | Keep Notion page IDs as stable cross-module references. |
| Video library | Supabase preferred | ERP -> Supabase or bundled backup | Sync tooling / configured source | Bundled/external backup list | Do not block ERP if Supabase video library is temporarily unavailable. |

## Non-Negotiable Transaction Rules

- Supabase-primary modules write Supabase first.
- A failed Supabase write must not be hidden by a Notion mirror write.
- A successful Supabase write with a failed Notion mirror becomes retry work; it is not rolled back.
- Repeated clicks, reconnects, retry queues, and Notion mirror repair must not repeat stock movement.
- Inventory deduction and inbound approval require stable idempotency keys.
- Product order picking deducts direct components of the finished product only. If the finished product contains a semi-finished item, deduct that semi-finished item, not its lower-level parts.
- Semi-finished assembly deducts linked parts and adds the semi-finished item.
- C-end / Shopee inventory is separated by `S-` SKUs. Do not silently map `S-` stock to normal finished goods.
- Parts should use `Y-` prefixes. Any normalization must update BOM, order, picking, and inbound references together.

## Fallback Rules

- Read fallback is allowed only when the UI makes the active source visible.
- Fallback data must be treated as read-only for picking completion, inbound approval, stock movement, and BOM-dependent deduction.
- Notion manual edits are not trusted as a verified two-way path unless a current, tested Notion-to-Supabase sync exists for that module.
- If both Supabase and Notion BOM reads fail, picking and deduction remain blocked.

## Reliability Contract

- Browser retry queues are immediate local repair layers.
- Supabase `erp_mirror_jobs` is the cross-device mirror repair layer.
- Retry work should be visible in Health / Reliability UI with type, dedupe key, last error, retry count, and next action.
- Repairing Notion mirrors must never create duplicate Supabase truth or duplicate inventory transactions.

## Current Known Blocker

C-order SHPTW shared sequence is not verified in production as of 2026-08-03.

- Local files exist for the sequence change:
  - `index.html`
  - `sw.js`
  - `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`
  - `supabase/migrations/20260731_015_corder_number_sequence.sql`
  - `tests/test_corder_number_sequence.py`
- Local tests passed on 2026-08-03.
- Production Pages did not contain `/api/corder/number-state`.
- Production Worker `/api/corder/number-state` returned HTTP 500 with `{"error":"Unexpected end of JSON input"}`.
- Do not run production `/api/corder/number-reserve` casually; it advances the shared sequence.

Safe order:

1. Apply `supabase/migrations/20260731_015_corder_number_sequence.sql`.
2. Deploy Worker route.
3. Verify `GET /api/corder/number-state` returns expected state.
4. Deploy Pages and service worker `lematec-erp-v34`.
5. Verify cache-busted Pages and Worker endpoints.

## Local Validation Baseline

For documentation-only changes:

```powershell
git diff --check
```

For frontend or workflow changes:

```powershell
python .\scripts\verify_erp_static.py
python -m unittest tests.test_verify_erp_static
```

For Worker changes:

```powershell
node --check .\cloudflare-worker-green-wave-c22f-FULL-UPDATED.js
```

For C-order sequence changes:

```powershell
python -m unittest tests.test_corder_number_sequence tests.test_corder_primary_contract tests.test_corder_excel_import_contract
```

For Notes primary changes:

```powershell
python -m unittest tests.test_notes_shadow_contract tests.test_notes_attachment_contract tests.test_reliability_center
```

## Deployment Gate

Do not call a change complete until all applicable gates pass:

1. `git status --short` reviewed.
2. Unrelated dirty files preserved.
3. Local static / unit checks passed.
4. Required Supabase migration applied and verified when applicable.
5. Worker deployed when Worker routes changed.
6. Pages deployed when frontend changed.
7. Cache-busted production Pages check completed.
8. Production Worker no-side-effect check completed.
9. Before/after counts are unchanged for dry-run checks.
10. Handoff updated with exact date, commands, endpoint results, and remaining blockers.

## Architecture Optimization Queue

1. Keep this file as the current contract and keep handoff as history.
2. Keep `WORKER_API_CONTRACT.md` current whenever Worker routes change.
3. Add a unified UI source/status strip for Supabase, Notion fallback, mirror retry, and write availability.
4. Add preflight summaries before C-order import, picking completion, inbound approval, batch inventory adjustment, and BOM import.
5. Move all mirror retry queues toward one user-visible Reliability Center.
6. Split high-risk production checks into no-side-effect endpoints or explicit `dry_run` contracts.
