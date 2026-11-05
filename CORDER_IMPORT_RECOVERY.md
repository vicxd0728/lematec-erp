# C-end import interruption recovery

## Ownership and scope

C-end order pages remain Notion-primary. Formal inventory transactions and
platform-order/product shipment identity remain Supabase-primary through the
existing Worker. The browser journal is recovery evidence, never a stock ledger
or permission to recreate an unknown order.

## Confirmed gap and repair (2026-11-05)

The importer submits individual product lines from the browser. The previous
result journal used sessionStorage only. Closing a tab discarded that tab's
recovery evidence. A source order can also have several product lines, so
counting visible order numbers cannot prove the workbook is complete.

- Preserve unfinished batch results in localStorage in addition to sessionStorage.
  Keep all unfinished batches and at most ten completed batches. This applies to
  this browser/device only; clearing site data or using another device loses it.
- Show complete platform-order groups separately from complete product lines.
  Every line in a platform order must finish before that order counts complete.
- Persist the full row plan before submission and persist unknown/create-page
  transitions before the corresponding create/stock request. If neither journal
  can save a transition, stop before that request.
- Retain older unresolved creates when another workbook is processed. On a retry,
  open the matching unresolved batch and require read-only original-page checking.
- Warn before leaving an active import. An explicit pause finishes the current
  line and stops before submitting the next line. It never aborts an in-flight
  stock request or automatically retries it.

Existing server shipment identity, exact original-page checks, BOM rules and
inventory idempotency are unchanged. Browser record state does not override them.

## Incident evidence limits

The supplied source contains three platform orders and six product lines. A fresh
exact-platform and buyer/tracking crosscheck found two active matching lines.
Four source lines were unmatched; the complete November 3-5 ledger showed only
the two matching shipment sources for this input. No formal orders or stock were
written during this investigation.

An isolated real-importer replay accepted all six source lines; replay with the
two existing lines skipped those two and processed four fake lines. This is not
proof of the original failure cause or production recovery. The original
pre-V.420 row-level errors were not retained, so a network interruption, browser
interruption or individual upstream rejection is still unproven. Do not describe
the browser-journal repair as a proven explanation of that incident.

## Acceptance

- Regression: source identity, direct/component deduction, cancellation/reversal,
  unknown create, storage failures, pause, new-tab recovery and older pending batch.
- Isolated browser: six synthetic lines, read-only check, close/reopen retains four
  pending lines; no production API connection permitted by fixture CSP.
- Desktop raster and 390px DOM geometry/44px action checks are separate evidence.
  Mobile raster capture timed out; do not claim complete mobile visual acceptance.
- Deployment needs exact frontend section/SW readback and matching Worker SHA.
- Historical missing lines require a separate reviewed production recovery plan;
  do not reuse a reserved number, reset the sequence, or retry stock from this doc.
