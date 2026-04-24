# SplitKit API V1 Schemas

## Session/Auth

- Session cookie: `sk_session` (JWT)
- Claims:
  - `userId: string`
  - `email: string`

## User

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "passwordHash": "bcrypt-hash",
  "remoteCreds": {
    "username": "string",
    "password": "string"
  },
  "createdAt": 0
}
```

## Event

```json
{
  "guid": "uuid",
  "ownerId": "uuid",
  "eventName": "string",
  "settings": {
    "splits": 95,
    "broadcastMode": "edit",
    "editEnclosure": "",
    "broadcastDelay": 0
  },
  "blocks": [],
  "activeBlockGuid": "uuid-or-null",
  "createdAt": 0,
  "updatedAt": 0
}
```

## Block (pass-through, compatibility-first)

Block payloads are accepted as opaque objects to preserve legacy behavior.

Recommended minimum shape:

```json
{
  "blockGuid": "uuid",
  "eventGuid": "uuid",
  "title": "string",
  "line": ["string", "string"],
  "value": {
    "type": "lightning",
    "method": "keysend",
    "destinations": []
  },
  "settings": {
    "split": 95,
    "default": false
  }
}
```

## Live Value Snapshot

Saved in realtime memory map by event GUID:

```json
{
  "serverData": {
    "eventGuid": "uuid",
    "blockGuid": "uuid",
    "value": {},
    "startTime": 0
  },
  "updatedAt": 0
}
```
