# thesplitkit-api

Compatibility-first backend for The Split Kit.

## Run

```bash
npm install
npm run dev
```

Server defaults to `http://localhost:8000`.

## Purpose

- Implement core `/api/sk/*` contract used by the current frontend.
- Provide `/event` socket namespace for live block broadcasting.
- Expose a public lookup endpoint for custom liveValue links:
  - `GET /api/sk/event/lookup?eventGuid=<guid>`

## Notes

- Data is persisted to `data/store.json` by default.
- `api/alby/auth`, `api/alby/refresh`, `api/alby/logout`, and `api/alby/handlePayments` are wired.
- Set `ALBY_ID`, `ALBY_SECRET`, and `ALBY_JWT` for Alby flows.
- Run contract smoke test (server must be running):
  - `npm run test:contract`
