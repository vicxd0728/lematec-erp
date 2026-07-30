# ERP Notes Shadow Runbook

## Effective flow

- Notion remains the production source for Notes and calendar views.
- The ERP reads and writes Notes through the existing Notion flow.
- After Notes appear, the browser sends a non-blocking copy to the Worker.
- The Worker upserts the copy into Supabase `erp_notes_shadow`.
- Vic's first successful Notes load performs a complete, idempotent backfill.
- Shadow failure must never block reading, replying, acknowledging, completing,
  editing, or attaching files to a Note.

## Verification

1. Apply `supabase/migrations/20260730_012_notes_shadow.sql`.
2. Deploy `cloudflare-worker-green-wave-c22f-FULL-UPDATED.js`.
3. Open the ERP as Vic and enter the Notes page once.
4. Check `GET /api/notes/shadow/summary`.
5. Compare Notion Notes with `GET /api/notes/shadow/list`.

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
- Service worker cache must be `lematec-erp-v27` or later after this fix.

## Rollback

- Frontend rollback: remove `scheduleNotesShadowSync(notes,dbId)`.
- Worker rollback: remove the three `/api/notes/shadow/*` routes.
- Do not delete the Supabase table during an incident. It is a read-only backup
  from the ERP perspective and can remain for diagnosis.
