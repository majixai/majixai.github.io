# FunStay v1.0 Commit Prep

## Scope

- `fun_hotel_reservation/*` (PWA app, APIs, queueing, GPS, docs)
- Optional root launcher updates: `index.html` (menu link)

## Core Features in v1.0

- Installable PWA + offline shell cache
- Extensive offline local persistence (compressed IndexedDB snapshots)
- API-first Google Places hotel flow (autocomplete + nearby search + map markers)
- Batched parallel detail enrichment
- Client geolocation requests at relevant moments
- Guest booking, discounts, calendar export, wallet integration hooks
- Service worker queue/stack async task engine with retries and logs

## Suggested Commit Message

`feat(funstay): release v1.0 with PWA offline, Places hotel search, GPS capture, and async queue engine`

## Suggested Staging (scoped)

```bash
git add fun_hotel_reservation/index.html \
        fun_hotel_reservation/styles.css \
        fun_hotel_reservation/app.js \
        fun_hotel_reservation/sw.js \
        fun_hotel_reservation/manifest.webmanifest \
        fun_hotel_reservation/config.js \
        fun_hotel_reservation/icons/icon-192.svg \
        fun_hotel_reservation/icons/icon-512.svg \
        fun_hotel_reservation/README.md \
        fun_hotel_reservation/RELEASE_v1.0.md
```

Optional launcher include:

```bash
git add index.html
```

## Pre-commit checks

- Open app online once, then verify offline behavior
- Validate Google API key/client ID config paths
- Validate geolocation allow/deny behavior
- Validate booking + discount + calendar + wallet fallback
