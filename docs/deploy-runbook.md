# Deployment Runbook (V1)

## Environment

Required variables:
- `SK_PORT` (dev/local optional override, default is `8010`)
- `PORT` (production host-assigned port)
- `SK_JWT_SECRET`
- `CORS_ORIGIN` (comma-separated allow list)
- `SK_DATA_PATH` (optional, defaults to `data/store.json`)

## Local Validation Checklist

1. Install deps:
   - `npm install`
2. Start API:
   - `npm run dev`
3. Health check:
   - `GET /health` returns `{"status":"ok"}`
4. Contract smoke:
   - `npm run test:contract`
5. Start integrated UI+API from repo root:
   - `npm run dev`

## Production Launch Checklist

1. Set strong random `SK_JWT_SECRET`.
2. Set explicit `CORS_ORIGIN` to production frontend origin(s).
3. Use persistent volume/storage path for `SK_DATA_PATH`.
4. Run API behind HTTPS (required for secure cookies in production).
5. Run health and smoke checks after deploy.

## Rollback

1. Keep previous API image/artifact available.
2. Revert service to previous version.
3. Validate:
   - `/health`
   - login/register
   - `getevents/getblocks`
   - websocket `/event` broadcast receive

## Known V1 Gaps

- Alby routes have baseline support; full webhook settlement/retry behavior is pending.
- Triggerboard/soundboard persistence is stubbed.
- Leaderboard/boostboard sockets currently emit placeholder payloads.
