# FunStay Hotel Reservation Demo

A bright, interactive hotel reservation website with:

- Installable PWA (home screen support + service worker cache)
- Extensive offline behavior using local cache + compressed IndexedDB snapshot vault
- Google Maps + Places API hotel search with map markers and country scoping
- Batched parallel place-detail processing for richer hotel results
- Client GPS capture at relevant moments (init, search bias, booking confirmation)
- Service worker task engine with queue/stack batching and concurrent subprocess execution

- Search + autocomplete for hotel destinations
- Date, guest count, price cap, and amenity filtering
- Guest booking (with optional account mock flows)
- Return-visit discounts (1% per return visit)
- Weekly + monthly bonus discounts (5% and 7.5%)
- Calendar integration:
  - Google Calendar deep link
  - Apple Calendar `.ics` download
- Google Wallet integration-ready payload export for hotel card/door unlock workflows

## Run

Open `index.html` in a browser or host the folder with any static server.

## PWA + Offline

- The app registers a service worker (`sw.js`) and precaches the app shell.
- Core interactions keep working offline: search (local dataset), filtering, booking, discounts, calendar export, wallet payload generation.
- App state is mirrored into compressed IndexedDB (`FunStayOfflineDB`) for resilient local recovery.
- If backend endpoints are unavailable, flows degrade locally (no hard failures).

## API-first Hotel Search

- Uses Google Places city autocomplete and `nearbySearch` with `lodging` type.
- Enriches place results with batched parallel `getDetails` requests.
- Renders map markers and click details in the map panel.

## Client GPS

- Requests geolocation at key times:
   - Initial load (best-effort)
   - Empty-query search (nearby hotels around current location)
   - Booking confirmation (capture guest location context)
- Gracefully continues when location permission is denied/unavailable.

## Queue Engine

- `sw.js` includes a queue/stack task engine with:
   - Batch pulling + worker concurrency
   - Nested async subprocess pipeline (`validate -> prepare -> execute`)
   - Retry logic and worker/client status broadcasting
   - Ring-buffer logging for operational traces

Recommended verification:

1. Open the app once while online.
2. Install as PWA (browser install prompt/menu).
3. Disable network and reopen the app.
4. Confirm booking/search/discount/calendar/wallet demo continue to function.
5. Validate GPS permission flows (allow/deny) still complete bookings.
6. Validate Places search + map markers with a configured API key.

## Configuration

Edit `config.js` and provide credentials:

- `google.clientId`: Google Identity Services OAuth client ID
- `google.mapsApiKey`: Maps JavaScript API key with Places enabled
- `wallet.issuerId`: Google Wallet issuer ID
- `wallet.classId`: Wallet class ID for hotel cards
- `wallet.savePassEndpoint`: Optional backend endpoint returning `{ "saveUrl": "..." }`

When `google.clientId` and `google.mapsApiKey` are blank, the app automatically uses local demo sign-in and local autocomplete fallback.

## Notes on Live Google Integrations

This demo includes integration-ready UX and payload hooks. For production:

1. **Google Sign-In / Account Creation**
   - Use Google Identity Services (GIS) with OAuth client configuration.
2. **Google Hotel/Places Autocomplete**
   - Use Places API / Autocomplete API with API key restrictions.
3. **Google Wallet Hotel Card**
   - Configure Wallet issuer account.
   - Create class/object with signed JWT (`Save to Google Wallet`).
   - Expose backend endpoint in `wallet.savePassEndpoint` to return a Google Wallet save URL.
4. **Door Unlock**
   - Requires compatible smart lock provider and secure key lifecycle.

## Discount Logic Used

- Return discount = `(total visits - 1) * 1%`
- Weekly bonus = `5%` when 2+ visits in last 7 days
- Monthly bonus = `7.5%` when 4+ visits in last 30 days
- Final discount = return discount + best period bonus, capped at 40%
