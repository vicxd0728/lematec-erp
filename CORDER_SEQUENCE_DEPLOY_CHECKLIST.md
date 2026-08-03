# C-order SHPTW Sequence Deploy Checklist

## Goal

Make C-end/Shopee internal order numbers (`SHPTW...`) shared across devices and safe for Excel/manual creation.

## Current Gate

- The frontend must not create or import new C-end orders until `/api/corder/number-state` is verified live.
- Do not casually call `/api/corder/number-reserve` in production. It advances the shared sequence.
- Do not use `/api/corder/number-set` except for an intentional admin correction.
- 2026-08-04: Supabase migration has been applied and verified at `next_number=16352`.
- 2026-08-04: GitHub repo secret `SUPABASE_DB_URL` is present for future workflow reuse.

## Required Deploy Order

1. In GitHub Actions, run `Supabase C-order Sequence Migration` with `apply=false` once.
2. If dry-run passes, run the same workflow with `apply=true`.
3. Deploy `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js` to the production Worker.
   Pushing the Worker file to `main` triggers `.github/workflows/cloudflare-worker.yml`.
4. Verify the no-side-effect route:

   ```powershell
   Invoke-WebRequest "https://green-wave-c22f.vic-e93.workers.dev/api/corder/number-state?codex_check=YYYYMMDD" -UseBasicParsing
   ```

5. Confirm the response is HTTP 200 JSON with a numeric `next_number`.
6. Deploy Pages with `index.html` and `sw.js`.
   Pushing to `main` triggers `.github/workflows/cloudflare-pages.yml`.
7. Open `https://lematec-erp.pages.dev/?codex_check=YYYYMMDD` and confirm the C-order screen shows the shared next number, not the unavailable warning.

## Manual Migration Fallback

If GitHub Actions cannot access `SUPABASE_DB_URL`, apply the migration manually from a trusted machine:

```powershell
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/migrations/20260731_015_corder_number_sequence.sql
```

Then continue from Worker deployment.

## Local Validation Before Deploy

```powershell
python -m unittest tests.test_corder_number_sequence tests.test_corder_primary_contract tests.test_corder_excel_import_contract
python -m pytest tests/test_reliability_center.py
python -m unittest tests.test_verify_erp_static tests.test_notes_shadow_contract tests.test_notes_attachment_contract
python .\scripts\verify_erp_static.py
node --check cloudflare-worker-green-wave-c22f-FULL-UPDATED.js
```

## Production Safety Checks

- Safe to call: `GET /api/corder/number-state`
- Mutates sequence: `POST /api/corder/number-reserve`
- Mutates sequence: `POST /api/corder/number-set`
- If `number-state` returns 404 or 500, stop. Deploy Worker or inspect Supabase migration before deploying Pages.

## Rollback Notes

- If Pages was deployed before Worker/migration, the current frontend blocks new/import C-order creation when the sequence state is unavailable.
- Existing C-order reads, shipping labels, and reload actions can remain usable.
- Roll back Pages only if the C-order screen itself becomes unusable; otherwise fix Worker/migration first.
