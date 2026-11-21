# ADR-0006: Durable email outbox with provider abstraction

- **Status:** Accepted
- **Date:** 2026-11-20
- **Supersedes:** None

## Context

Invitations and notification emails must be reliable without delaying or rolling
back user-facing mutations. Provider delivery can fail, email content contains
secure links, and development/test environments must not send real email. The
existing notification service already creates realtime records after mutations;
email needs equivalent durability and user-controlled preferences.

## Decision

- Store rendered email messages in `EmailDelivery` before asynchronous delivery.
- Poll due `PENDING` rows from the API process, claim them as `SENDING`, and use
  bounded exponential backoff until `maxAttempts` is exhausted.
- Hide provider behavior behind an `EmailTransport` interface. `log` is the safe
  development/test transport; `smtp` uses Nodemailer for real delivery.
- Store per-user category preferences and a unique unsubscribe token in
  `NotificationPreference`.
- Keep message bodies, invitation URLs, unsubscribe tokens, and SMTP credentials
  out of application logs.

## Consequences

### Positive

- Request transactions do not depend on an external email provider.
- Delivery failures are observable, retryable, and bounded.
- A fake transport can verify provider behavior without sending email.
- Secure invitation links are delivered by email while remaining out of logs.
- Additional providers can be added without route changes.

### Negative / trade-offs

- Rendered email bodies are stored in PostgreSQL until delivery completes.
- The in-process worker is suitable for one API replica; horizontal scaling will
  require locking or moving delivery to a dedicated worker.
- Unsubscribe links lead to a confirmation page; preference state changes only
  through a CSRF-protected POST carrying the public opaque token.

### Follow-ups

- Add a transactional HTTP provider if SMTP is not selected for production.
- Add operational metrics and alerting for old `PENDING` or `FAILED` deliveries.
- Revisit worker locking when running multiple API replicas (related to issue
  #24).

## Alternatives considered

| Alternative | Why not chosen |
| --- | --- |
| Send email in the request path | Provider latency/failure would affect user mutations and retry state. |
| Fire-and-forget after response | Process crashes could lose sends and provide no retry/audit state. |
| External queue immediately | Adds infrastructure before the production deployment shape is known. |

## Verification

`apps/api/tests/email.test.ts` covers invitation queueing, fake-transport
delivery, retry/backoff, category preferences, unsubscribe handling, and HTML
escaping. Production audit found no vulnerable dependencies after selecting a
patched Nodemailer release.
