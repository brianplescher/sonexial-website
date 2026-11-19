# Commercial outreach compliance runbook

This implementation affects cold outreach and automated commercial follow-ups, not customer-requested diagnostic reports.

## Mandatory production configuration
- Set `BUSINESS_POSTAL_ADDRESS` to the complete **real** business street address, USPS P.O. Box, or properly registered private mailbox, including city/state/ZIP. The code only checks that a plausible address is configured; a human must verify it.
- Set `UNSUBSCRIBE_SECRET` to a stable random value of 32+ characters. Changing it invalidates links already sent.
- Set `RESEND_API_KEY`, `SCANNER_FROM_EMAIL`, `DATA_DIR` to valid production values. `DATA_DIR` must be on a persistent, backed-up volume. Suppressions are stored in the same SQLite database.
- Confirm the Netlify signed `/api/*` proxy reaches the Railway backend and that the public unsubscribe URL works.

## Suppression workflow
- All commercial senders must use `sendCommercialOutreach` from `src/email.js`, which checks SQLite suppression immediately before the provider call and adds a business postal address, a human-readable opt-out link, and List-Unsubscribe headers.
- Batch CSV generation now skips suppressed or invalid recipients and includes the required footer. A CSV file **is not authorization to send**: recheck suppression immediately before importing/sending in any third-party platform.
- Public: `GET /api/unsubscribe?token=...` shows confirmation; `POST /api/unsubscribe` (form field or query token) records an immediate, permanent commercial suppression. Both are idempotent.
- Admin: `POST /outreach/suppress` with `Authorization: Bearer <ADMIN_TOKEN>` and JSON `{"email":"recipient@example.com"}` records manual opt-outs, including requests arriving by reply. `GET /outreach/suppressions` lists them.
- Do **not** automatically remove suppressions, even if the prospect is present in another CSV. Explicit documented re-subscription is a separate future feature.
- Replies saying "unsubscribe", "remove", or "stop" need inbox monitoring and prompt processing via the admin route. This repository does **not** include automatic inbound-email parsing or a scheduled follow-up sender, so such automation must be separately connected and tested.
- Cancel pending follow-ups in whichever platform schedules them. Suppression at actual send time is a second line of defense, not a substitute for canceling jobs.

## Pre-launch acceptance tests
1. Verify the physical postal address is valid and is included in both draft and sent commercial messages.
2. Verify GET on an emailed link shows a confirmation without removing the recipient, and POST does remove the recipient.
3. Confirm a second POST is harmless; confirm tampered tokens fail.
4. Confirm an unsubscribed address is skipped by CSV generation and `sendCommercialOutreach` and that no future scheduled sends occur.
5. Confirm reply-based opt-outs are recorded using the admin route.
6. Confirm signed Netlify proxy, Railway persistent SQLite, backup/restore, and sending-domain authentication work in production.
7. Confirm real campaign copy never asserts scarcity unless it is actually enforced.

**Launch is blocked** until the production mailing address and secret are set, complete opt-out testing passes, and any separately managed outbound/follow-up service checks the same suppression list.
