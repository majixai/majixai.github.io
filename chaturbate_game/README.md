# chaturbate_game

`chaturbate_game` is a Chaturbate app bundle centered on tip-driven slot gameplay, chat automation, and broadcast overlays.  
The directory is organized so each file maps directly to either:

- a Chaturbate **event handler** script,
- a **broadcast overlay** HTML/JS asset, or
- **shared utility** code reused across handlers.

## Project Structure

```text
chaturbate_game/
├── AppStart.js               # App lifecycle initialization ($kv defaults, callback scheduling)
├── BroadcastStart.js         # Runs when broadcast goes live
├── Callback.js               # Scheduled callback loop (feature announcements)
├── ChatMessage.js            # Command parsing + chat command handlers
├── ChatMessageTransform.js   # Message filtering/VIP/repetition transform
├── TipReceived.js            # Core tip pipeline (slot triggers, goals, overlay emits)
├── TipDilogueOpen.js         # Tip dialog option customization
├── UserEnter.js              # User enter notices/segmented welcomes
├── UserFollow.js             # Follow tracking + follow events to overlay
├── FanClubJoin.js            # Fan club join logic + KV updates
├── MediaPurchase.js          # Media purchase acknowledgments + totals
├── RoomStatusChange.js       # Room status tracking/announcements
├── BroadcastPanelUpdate.js   # Panel template refresh from $kv values
├── shared.js                 # Reusable helpers for commands/spin/slot logic
├── Slots.html                # Basic slot overlay markup + styles
├── Slots.js                  # Slot overlay runtime (setConfig + slotResult listener)
├── Spinner.html              # Alternate/advanced overlay shell (visual styling + modal UI)
└── Spinner.js                # Alternate slot overlay runtime implementation
```

## Event Handler Mapping

Use the files in this directory as the source for Chaturbate app editor handler slots:

| File | Chaturbate handler slot |
|---|---|
| `AppStart.js` | App Lifecycle → App Start |
| `BroadcastStart.js` | Broadcast Start |
| `Callback.js` | Callback |
| `ChatMessage.js` | Chat Message |
| `ChatMessageTransform.js` | Chat Message Transform |
| `TipReceived.js` | Tip Received |
| `TipDilogueOpen.js` | Tip Dialog Open |
| `UserEnter.js` | User Enter |
| `UserFollow.js` | User Follow |
| `FanClubJoin.js` | Fan Club Join |
| `MediaPurchase.js` | Media Purchase |
| `RoomStatusChange.js` | Room Status Changed |
| `BroadcastPanelUpdate.js` | Broadcast Panel Update |

`shared.js` belongs in Shared Code and is referenced by handlers for reusable logic.

## Overlay Mechanics

### Core overlay event flow

1. **Backend handlers** emit events via `$overlay.emit(...)`.
2. Overlay browser page receives `window.postMessage` messages where `event.data.type === 'overlayMessage'`.
3. Overlay JS reads `event.data.payload` and dispatches by `eventName`.

### Slot-focused overlay events

- `setConfig` (used by `Slots.js`)
  - emitted from shared/app-load logic
  - payload: symbol set + reel count
- `slotResult`
  - emitted from tip logic when a slot spin is triggered
  - payload includes:
    - `user`
    - `outcome` (symbol array)
    - `isWin`
    - `prize`
    - optional multiplier metadata

### Additional general overlay events

`TipReceived.js` may also emit to a general-purpose overlay (using `spinnerOverlayName`):

- `goalReachedAnimation`
- `superTipAnimation`
- `fanClubTipAnimation`
- `newTipReceived` (with tip + user + goal status payload)

### Overlay assets

- **`Slots.html` + `Slots.js`**: recommended baseline slot-machine overlay pairing.
- **`Spinner.html` + `Spinner.js`**: alternate variant with different visual shell/behavior.

## Event Handler Responsibilities

- **App bootstrap (`AppStart.js`)**
  - Initializes persistent `$kv` defaults.
  - Seeds moderation/filtering defaults.
  - Schedules recurring callbacks (feature announcements).
- **Tip pipeline (`TipReceived.js`)**
  - Detects tiered instant-spin tips.
  - Computes outcomes and prizes.
  - Tracks per-user spin progress and earned spins in `$kv`.
  - Maintains tip-goal progress and emits related overlay events.
  - Emits slot/general overlay updates and sends notices.
- **Chat handling (`ChatMessage.js`, `ChatMessageTransform.js`)**
  - Registers slash/bang command handlers.
  - Supports runtime spin-wheel config updates via chat commands.
  - Filters profanity patterns, handles VIP formatting, and repetition spam marking.
- **Room/user lifecycle handlers**
  - `BroadcastStart.js`, `UserEnter.js`, `UserFollow.js`, `FanClubJoin.js`, `MediaPurchase.js`, `RoomStatusChange.js`
  - Focus on audience messaging, per-broadcast counters, and event-driven notices.
- **Panel and callbacks**
  - `BroadcastPanelUpdate.js` builds panel rows from `$kv` state.
  - `Callback.js` loops scheduled room announcements.

## Shared Utilities (`shared.js`)

Key reusable helpers include:

- command/admin helpers:
  - `canUserUseAdminCommand(user, kv)`
  - `extractCommand(messageText, prefix)`
  - `getCommandIndex(message)`
- spin-wheel config + weighted selection:
  - `getSpinWheelConfig(kv)`
  - `getDefaultSpinWheelConfig()`
  - `getRandomWeightedSpinResult(config)`
  - `grantSpinOpportunity(username, tipAmount, kv)`
  - `handleSpinOutcome(result, username, callback, kv)`
- slot logic helpers:
  - `getSlotConfig(settings)`
  - `generateSlotOutcome(config)`
  - `handleSlotOutcome(result, username, overlayName, chatCallback)`

## Runtime Environment Expectations

This code expects execution inside the Chaturbate app runtime (not plain Node/browser alone).

### Platform globals and services

Depending on handler context, scripts assume access to injected objects such as:

- `$app`, `$room`, `$user`, `$tip`, `$message`, `$media`
- `$kv` (persistent key-value store with `get/set/incr/delete`)
- `$callback` (chat + callback scheduling + overlay callbacks)
- `$overlay` (overlay event emitter)
- `$settings` (app configuration values)

### Expected app settings

Handlers reference these common settings (with in-code fallbacks if missing):

- `slotOverlayName`
- `slotReelCount`
- `slotBaseSpinCost`
- `slotTipThreshold`
- `spinnerOverlayName`

Overlay names must exactly match overlays configured in the Chaturbate app.

### Permissions/features relied on

- Sending notices/messages to room and users
- Updating tip options (`setTipOptions`)
- Updating panel templates (`setPanelTemplate`)
- Scheduling callbacks (`$callback.create`)
- Overlay event emission (`$overlay.emit`)
- Persistent state reads/writes (`$kv`)

## Notes for Operators

- Keep symbol lists and reel count assumptions aligned across:
  - `TipReceived.js`
  - shared/app-load slot config logic
  - selected overlay JS (`Slots.js` or `Spinner.js`)
- If you modify tip tiers or thresholds, update both:
  - tip logic,
  - and user-facing chat notices/docs.
- Validate overlay event names when customizing, since handlers and overlays depend on exact string matches.
