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

## Rollback

- Frontend rollback: remove `scheduleNotesShadowSync(notes,dbId)`.
- Worker rollback: remove the three `/api/notes/shadow/*` routes.
- Do not delete the Supabase table during an incident. It is a read-only backup
  from the ERP perspective and can remain for diagnosis.
