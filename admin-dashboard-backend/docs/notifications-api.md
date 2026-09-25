# Notifications API contract (backend)

Canonical contract for the Super Bae Admin Dashboard notifications module
(Steps 2–8). The source of truth is the code:

- `src/models/notification.ts` — schema / stored fields
- `src/services/notificationManagement.ts` — allowed values + validation rules
- `src/services/notificationSegments.ts` — supported segments (pure constants)
- `src/services/notificationTargeting.ts` — segment → device resolution
- `src/services/notificationSender.ts` — the single FCM delivery path
- `src/services/notificationScheduler.ts` — dispatcher for scheduled sends
- `src/routes/notificationManagement.ts` — the dedicated permission-gated router

Read-only machine-readable list of the allowed values: `GET /notifications/options`.

## 1. Canonical fields

| Field | Type | Writable by client | Notes |
| --- | --- | --- | --- |
| `id` | string | no | Server-generated (`notification_<uuid>`); legacy ids (e.g. `notif_1`) kept as-is |
| `title` | string | yes | Required, non-empty |
| `body` | string | yes | Required, non-empty |
| `channel` | string | yes | `push` \| `sms` (default `push`); `email` removed — 400 on create/update |
| `segmentId` | string \| null | yes | See §3; `null`/absent = `all_users` |
| `scheduleAt` | ISO date \| null | yes | Dispatcher trigger time |
| `templateId` | string \| null | yes | Free-form template reference (not resolved yet) |
| `status` | string | restricted | See §4 |
| `sentAt` | ISO date \| null | no | Written only by the delivery pipeline |
| `sendResult` | object \| null | no | Written only by the delivery pipeline (§6) |
| `createdAt` / `updatedAt` | ISO date | no | Maintained by the server |
| `scheduledClaimedAt` | internal | no | Dispatcher claim/backoff marker — **never returned by the API** |

Unknown body keys are dropped on write. Client-supplied `token`, `tokens`,
`userId`, `userIds`, `deviceTokens` are never persisted and never used as
destinations (targeting is resolved server-side from `segmentId`).

## 2. Legacy / frontend field mappings

The existing admin UI (and older records such as the seeded `notif_1`) use a
different vocabulary. Both are accepted on write, the canonical field wins when
both are present:

| Frontend field | Canonical field |
| --- | --- |
| `type` | `channel` |
| `targetSegment` | `segmentId` |
| `scheduledFor` | `scheduleAt` |

Responses always include the canonical fields and add the legacy aliases when
they are absent from the stored record, so the current UI keeps rendering.
Aliases are **read-only projections**: nothing extra is ever persisted.

Segment values are canonicalized on write (`"Premium Subscribers"` →
`premium_users`). Unrecognized values are stored verbatim for backward
compatibility with legacy records and then rejected (400) by send/dispatch,
never guessed.

## 3. Allowed values

`channel`: `push`, `sms` — only `push` has a delivery implementation
(`sendableChannels`). Sending `sms` returns 400 ("SMS delivery is not
implemented yet") without touching Firebase. `email` is no longer accepted
for new/updated records (400 listing `push, sms`); stored records are never
rewritten or deleted.

`status`: `draft`, `scheduled`, `sent`, `failed`.

`segmentId` (only these four exist; no Firebase-identity segments yet):

| value | label | resolves to |
| --- | --- | --- |
| `all_users` | All Users | all active device registrations |
| `active_users` | Active Users (last 7 days) | users with `lastSeen` inside 7 days |
| `premium_users` | Premium Subscribers | users with `plan: 'premium'` |
| `inactive_users` | Inactive Users | users not seen inside 7 days |

## 4. Validation rules

- `title`, `body`: required and non-empty (400).
- `channel`: must be one of the supported values (400).
- `scheduleAt`: must parse as a date (ISO string preferred), else 400.
- `status` transitions:
  - create: only `draft` or `scheduled`; choosing `sent`/`failed` → 400
    (pipeline-owned).
  - update: `sent` is final in both directions → 400; setting `sent`/`failed`
    by hand → 400 (use `POST /notifications/:id/send`); a value equal to the
    stored status is a no-op (the UI echoes the loaded status back).
  - `scheduled` always requires a real schedule date → 400 otherwise (such a
    record could never be dispatched).
  - `PUT` is a full replace of the editable fields: an omitted `status` resets
    to `draft`, **except** when the stored status is `sent`, which is preserved.
- segment: unsupported values cannot reach Firebase (send returns 400 and no FCM
  call is made).
- sending: an already-sent notification returns 409 and is never re-sent.
- destinations: resolved server-side only; client-supplied tokens/user ids are
  ignored.

Status codes: 400 validation, 401 unauthenticated, 403 missing
`NOTIFICATION_MANAGE` (writes/send), 404 unknown notification, 409 already sent,
500 unexpected.

Authorization matrix (Step 8 verified):

| Operation | `requireAuth` | `NOTIFICATION_MANAGE` |
| --- | --- | --- |
| `GET /notifications`, `GET /notifications/:id`, `GET /notifications/options` | required | not required (read-only) |
| `POST` / `PUT` / `PATCH` / `DELETE`, `POST /notifications/:id/send` | required | required |

`notifications` is excluded from the generic CRUD mount in `src/routes/index.ts`,
so no authenticated admin can reach a write/send path without the permission.
Error bodies are always `{ "message": string }`.



## 5. Response shapes

`GET /notifications` — array of notification objects.
`GET /notifications/options` — allowed channels/statuses/segments + UI aliases.
`GET /notifications/:id` — one notification object, 404 with
`{ "message": "notifications not found" }`.
`POST /notifications` — 201 + the created object.
`PUT`/`PATCH /notifications/:id` — 200 + the updated object.
`DELETE /notifications/:id` — 200 + the deleted object.

Notification object (canonical fields plus legacy aliases):

```json
{
  "id": "notification_...",
  "title": "Premium push",
  "body": "Hello",
  "channel": "push",
  "segmentId": "premium_users",
  "scheduleAt": "2026-09-24T09:00:00.000Z",
  "templateId": null,
  "status": "scheduled",
  "sentAt": null,
  "sendResult": null,
  "createdAt": "...",
  "updatedAt": "...",
  "type": "push",
  "targetSegment": "premium_users",
  "scheduledFor": "2026-09-24T09:00:00.000Z"
}
```

Never returned: Firebase credentials / service-account data, full device tokens,
internal dispatcher bookkeeping (`scheduledClaimedAt`), Mongo `_id`/`__v`.

## 6. Send response

`POST /notifications/:id/send` (requires `NOTIFICATION_MANAGE`):

```json
{
  "result": {
    "targeted": 2,
    "successful": 2,
    "failed": 0,
    "skipped": 0,
    "outcome": "sent",
    "sentAt": "2026-09-23T10:00:00.000Z",
    "failures": []
  },
  "notification": { "": "updated notification object" }
}
```

`outcome` is the explicit discriminator:

| outcome | meaning | status after |
| --- | --- | --- |
| `sent` | every targeted device accepted the message | `sent` |
| `partial` | >=1 success and >=1 failure | `sent` |
| `failed` | every attempt failed (no `sentAt`) | `failed` (retryable) |
| `no_devices` | `targeted = 0`: nothing attempted, no Firebase call | unchanged |

`skipped` is `targeted - successful - failed` (reserved for future per-device
skip categories; `0` today). `failures[]` entries carry
`{ deviceTokenId, userId, tokenMask, code, message }` — the token is always
masked (`...last6`), never returned in full. Invalid/unregistered destinations
are deactivated (never deleted); temporary Firebase errors leave devices active.

Distinguishing cases on the client:

- success: `outcome === 'sent'`
- zero devices: `outcome === 'no_devices'` (or `targeted === 0`)
- partial failure: `outcome === 'partial'`
- complete failure: `outcome === 'failed'`
- already sent: HTTP 409 (`Notification has already been sent...`)

`sendResult` is only persisted when a delivery attempt actually happened, so
`sendResult === null` (with an unchanged status) means "no delivery attempted".

## 7. Scheduling lifecycle

```
draft --(create/patch with scheduleAt)--> scheduled
scheduled --(dispatcher tick, scheduleAt <= now)--> sendNotification() --> sent | failed
failed --(retry: POST /notifications/:id/send, or PATCH back to draft/scheduled)--> ...
sent --(terminal: no re-send, no status revert)
```

The cron dispatcher (`node-cron`, every minute, in-process) claims each due
notification atomically before handing it to the same sender used by the manual
endpoint. Zero registered devices keep the notification scheduled and retry with
backoff instead of claiming a delivery.

## 8. Segments and the mobile dependency

Segments resolve only against existing users fields (`plan`, `lastSeen`).
Registration of real FCM device tokens for mobile users is still blocked on the
mobile-user authentication contract (no `firebaseUid` on users, no Firebase
ID-token verification in this backend), so a send with no registered devices
honestly reports `targeted = 0` / `outcome = "no_devices"`.
