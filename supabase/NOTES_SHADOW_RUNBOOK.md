# ERP Notes Supabase-Primary Read Runbook

## Effective flow

- Notes list, calendar, filters, reminders, and dashboard counts read Supabase
  `erp_notes_shadow` first.
- If Supabase cannot be read or contains no rows, the ERP automatically falls
  back to Notion and clearly labels the page `Notion 備援`.
- Note creation, edit, reply, read acknowledgement, completion, attachment,
  customer-page sync, and archive remain Notion-first in this stage.
- Every successful Notion mutation is immediately written through to Supabase.
  Sync requests are serialized so a background copy cannot cause a user change
  to be skipped.
- Note detail blocks and attachments continue to load live from the original
  Notion page.
- Vic's first successful Notes load performs a complete, idempotent backfill.
- Deleting a Note archives it in Notion and removes its Supabase read copy.
- A Supabase write-through failure never rolls back a successful Notion action;
  the next full Notion refresh can repair the read copy.

## Verification

1. Apply `supabase/migrations/20260730_012_notes_shadow.sql`.
2. Deploy `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.
3. Open the ERP Notes page and confirm the source badge says `Supabase`.
4. Open an item and confirm its detail and attachment still load from Notion.
5. Reply or mark an item read, reload, and confirm the change remains visible.
6. Check `GET /api/notes/shadow/summary`.
7. Compare Notion Notes with `GET /api/notes/shadow/list`.

The comparison covers record count, dates, pending roles, reply counts, customer,
order, and material references.

## Verified baseline (2026-07-30)

- Notes: 15
- Date range: 2026-07-01 through 2026-07-29
- Status: completed 9, waiting reply 1, waiting confirmation 1, unprocessed 4
- Notes with replies: 15
- Reply lines: 46
- Customer references: 4
- Order references: 1
- Material references: 0
- Targeted Notes: 15
- Acknowledged Notes: 14
- Pending roles: 0

These values are an operational baseline, not a hard-coded limit. Normal additions
or status changes are expected.

## Mobile acceptance checks

- Opening the new/edit Note modal must not scan the inventory list.
- The modal background must stay fixed while the modal itself scrolls natively.
- Dragging or selecting text outside the form must not close the modal.
- Note actions remain role-scoped: author or Vic can manage; assigned roles can
  reply; Vic retains full access.
- Service worker cache must be `lematec-erp-v30` or later after this fix.

## Rollback

- Frontend rollback: call `loadNotes({source:'notion'})` for all Notes loads.
- Worker rollback: remove `/api/notes/shadow/delete` and restore the previous
  list response fields.
- Do not delete the Supabase table during an incident. It is a read-only backup
  and rollback source and can remain for diagnosis.

## Supabase-primary mutations (2026-07-30)

- Apply `supabase/migrations/20260730_013_notes_primary_usage.sql`.
- Note creation, edit, reply, read acknowledgement, completion, and archive now
  commit to Supabase first through `POST /api/notes/write`.
- `erp_note_replies` and `erp_note_assignments` keep replies and assignments as
  normalized records while `erp_notes_shadow` remains the fast complete card.
- Notion is a background human-readable mirror. A Notion delay or rate limit
  does not block an accepted Supabase mutation.
- Pending Notion mirrors are kept in the browser queue and `erp_mirror_jobs`.
  The actual Notion page id and sync status are written back to Supabase.
- Attachments are uploaded during the Notion mirror step. Until that finishes,
  the Note remains usable and clearly reports a pending mirror state.
- The health page calls `GET /api/health/supabase-usage` and warns at 70 percent,
  then reports an error at 90 percent for measurable database and Storage usage.
- Supabase egress usage is not exposed by PostgreSQL. The health page reports it
  as unavailable unless Worker env `SUPABASE_EGRESS_USED_BYTES` is maintained.

## Primary-flow acceptance

1. Create a Note and reload immediately; it must remain visible from Supabase.
2. Reply from an assigned role and reload; reply and pending-role counts remain.
3. Open the Note as an assigned role; read acknowledgement remains after reload.
4. Complete and archive Notes; archived Notes no longer appear in normal lists.
5. Temporarily fail Notion mirroring; the Supabase action stays accepted and the
   reliability center shows a pending Notes mirror job.
6. Restore Notion access and flush the queue; sync status becomes `synced`.
7. Run Health Check and confirm database and Storage usage cards are present.
