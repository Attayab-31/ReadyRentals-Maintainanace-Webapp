# Field + office flow (current)

Signatures happen **only after every task is Resolved**. Unfinished work stays **In progress** so the office can see it.

```
assigned
   │  Start job
   ▼
in_progress
   │  Save for later → stays in_progress (office can view notes/photos)
   │  Finish job (only if every task is Resolved)
   ▼
completed_pending_signoff
   │  tenant signs, then technician signs
   ▼
signed_off  →  PDF
```

## What the office asked for

| Request | What the app does now |
|---------|------------------------|
| 1. Enlarge photos | Tap a before/after thumbnail to open a full-screen photo. Close or tap outside to dismiss. |
| 2. Not resolved + notes, no signatures until complete | Each task is **Resolved** or **Not resolved**. If not resolved, write **Notes** (why you will return). **Finish job** stays disabled until every task is Resolved. **Save for later** keeps the ticket In progress. |
| 3. Inspect entire property? | After tasks: **Did you inspect the entire property?** **Yes** / **No**, then **Inspection results**. Required to finish. |
| 4. Details vs Notes | **Details (office)** is the original work description (read-only on the phone). **Notes** is for the technician. |
| 5. Save for later | **Save for later** stores inspection answers and already-saved task data. Status stays **In progress**. The dashboard/detail screen shows notes, photos, resolved flags, and inspection. |
| 6. No picture | **No picture** on Before and/or After. Uncheck later to capture a photo. Finish requires a photo **or** No picture for each slot. |

## Technician on `/wo/{token}`

1. **Assigned** — review office details, **Start job**.
2. **In progress** — per task: Resolved / Not resolved, Notes, Before/After (or No picture). Inspect Yes/No + results.
3. Leave the site? **Save for later**. Come back on the same link; timer and work are still there.
4. All Resolved + photos/skip + inspection filled → **Finish job**.
5. Tenant then tech signatures → PDF.

## Office

Open the work order while it is **In progress** to see technician notes, skipped photos, and inspection progress without waiting for signatures.
