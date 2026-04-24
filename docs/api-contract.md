# SplitKit API Compatibility Contract (V1)

This document maps calls from the current `thesplitkit` frontend to the new API.

## Must-Have V1 (Implemented)

### Auth/session
- `POST /api/sk/register`
  - Body: `{ email: string, password: string }`
  - Returns: `{ status: "success", user: { email } }`
- `POST /api/sk/login`
  - Body: `{ email: string, password: string }`
  - Returns: `{ status: "success", user: { email } }`
- `GET /api/sk/refresh`
  - Cookie auth refresh/check
  - Returns: `{ status: "success", user: { email } }` or `{ status: "unauthorized" }`
- `GET /api/sk/checkforuser`
  - Returns: `{ hasCreds: boolean }`
- `POST /api/sk/saveremotecreds`
  - Body: `{ username: string, password: string }`
  - Returns: `{ status: "saved" }`

### Event and block core
- `POST /api/sk/generateguid`
  - Body: `{ eventName: string }`
  - Returns: `{ guid: string }`
- `GET /api/sk/getevents`
  - Returns: `{ events: Array<EventSummary> }`
- `GET /api/sk/getblocks?guid=<eventGuid>`
  - Returns: `{ guid, eventName, settings, blocks, activeBlockGuid }`
- `POST /api/sk/saveblocks`
  - Body: `{ guid: string, blocks: Array<any> }`
  - Returns: `{ status: "success" }`
- `POST /api/sk/savesettings`
  - Body: `{ guid: string, settings: object }`
  - Returns: `{ status: "success" }`
- `POST /api/sk/verifyowner`
  - Body: `{ guid: string }`
  - Returns 200 when owner, 403 otherwise
- `GET /api/sk/deleteguid?guid=<eventGuid>`
  - Returns: `{ status: "deleted" }`

### Realtime live switching
- Socket namespace: `/event`
  - Query: `event_id=<eventGuid>`
  - Client emits:
    - `connected`
    - `valueBlock` with `{ valueGuid, serverData }`
  - Server emits:
    - `remoteValue` with latest active block payload

### Public live value lookup
- `GET /api/sk/event/lookup?eventGuid=<eventGuid>`
  - Returns latest active payload for `podcast:liveItem` custom links.

## Stub V1 (Implemented as non-breaking placeholders)

- `GET /api/sk/getsounds?guid=<eventGuid>`
- `POST /api/sk/savesounds`
- `GET /api/sk/gettriggers?guid=<eventGuid>`
- `POST /api/sk/savetriggers`
- `POST /api/alby/handlePayments`
- `GET /api/alby/logout`
- Socket namespace: `/leaderboard`
- Socket namespace: `/boostboard`

Stub behavior:
- Returns success-shaped empty payloads so existing UI does not hard fail.

## Parity-Later Endpoints

- `GET /api/alby/auth`
- `GET /api/alby/refresh`
- Webhook/payment settlement routes
- Invoice generation and forwarding
- Advanced triggerboard/soundboard persistence and execution
