# SplitKit Parity Backlog

This backlog prioritizes post-V1 work to reach and exceed legacy SplitKit behavior.

## P0 - Stability and Compatibility Hardening

1. Add request/response contract tests for all implemented `/api/sk/*` endpoints.
2. Persist realtime live state to storage so process restarts do not drop active block.
3. Add migration-safe event versioning (`version`, `schemaVersion`) for blocks/settings.
4. Implement proper CORS env matrix (local, staging, production).

## P1 - Auth + Account Parity

1. Implement full Alby OAuth flow:
   - `/api/alby/auth`
   - `/api/alby/refresh`
   - token refresh lifecycle and secure cookie settings
   - Status: base implementation complete, needs production credential and end-to-end OAuth verification.
2. Replace `saveremotecreds` plaintext storage with encrypted-at-rest fields.
3. Add account profile route and session introspection endpoint.

## P1 - Payments and Webhooks

1. Implement `/api/alby/handlePayments` with split fanout logic.
   - Status: base implementation complete for keysend + LN address payment attempts.
2. Add invoice generation and metadata persistence.
3. Add webhook settlement routes with signature verification.
4. Add retry/queue strategy for failed keysend/LNURL payments.

## P2 - Triggerboard and Soundboard

1. Replace stubbed trigger routes with persistent event-scoped trigger CRUD.
2. Replace stubbed sound routes with persistent event-scoped sound CRUD.
3. Add ownership checks and payload validation for both subsystems.

## P2 - Public Data Streams

1. Implement real `/leaderboard` namespace events.
2. Implement real `/boostboard` namespace events.
3. Add bounded retention and pagination for client fetches.

## P3 - Protocol and Publisher Integrations

1. Document and version the custom `liveValue` payload format.
2. Add optional host feed update integrations (future hybrid mode).
3. Add export helpers to generate feed snippets and callback URLs.

## P3 - Ops and Quality

1. Add structured logging and request IDs.
2. Add basic observability (health detail, metrics counters, error reporting hooks).
3. Add CI checks (lint, unit tests, contract tests).
4. Write production deploy and rollback runbook.
