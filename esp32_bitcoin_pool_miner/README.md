# ESP32 Bitcoin Pool Miner

This directory bridges the Bitcoin miner demo with ESP32-P4 hardware ideas for an 8-chip BM1373 mining chain and Bitaxe-style flash driver workflows.

## Integrations

- [bitcoin_miner](../bitcoin_miner/)
- [Integrated_circuit](../Integrated_circuit/)
- [BM1373](../BM1373/)
- [ESP32](../ESP32/)
- [actions](../actions/)
- [compiler](../compiler/)
- Mathematics roots:
  - [algebra](../algebra/)
  - [calculus](../calculus/)
  - [category_theory](../category_theory/)
  - [numerical_methods](../numerical_methods/)

## Notes

- The goal is educational pool-mining and hardware-integration exploration.
- The current target concept is an ESP32-P4 controller with eight BM1373 ASICs, level shifting, and Bitaxe-inspired flashing/recovery support.
- The page is wired into the repository router and hashing system.
- It now acts as the coordination hub for BM1373 and ESP32 spec ops notes.

## 400GHz protocol paradigm

The 400GHz protocol paradigm is a conceptual high-rate control channel for the directory. It is not a replacement for the ordinary browser or Wi-Fi stack; instead, it gives the page a vocabulary for deterministic bursts, short frames, and hash-verified state changes.

### Principles

1. Keep exchanges tiny and inspectable.
2. Treat timing as a first-class design constraint.
3. Hash every control frame that matters.
4. Fall back to standard interfaces when the fast path is unavailable.
5. Keep transport semantics aligned with router and hash metadata.
6. Treat BM1373 details as reverse-engineered behavior unless verified by open schematics.

### Conceptual layers

| Layer | Meaning |
|-------|---------|
| Physical | Ultra-fast conceptual signaling around the board |
| Link | Burst windows, acknowledgements, and retries |
| Session | Board identity, miner role, and current job |
| Application | Mining jobs, telemetry, and diagnostics |
| Governance | Router/hash validation and repo provenance |

### Why it exists here

The ESP32 miner page is the natural place to describe a transport that wants strict timing and compact state. By keeping the concept beside the mining workflow, the repository can talk about performance, control, and safety in one place.

## What lives here

- A landing page for ESP32-focused pool-mining ideas.
- Cross-links to the mining demo and circuit companion directory.
- A place for firmware, board, and transport notes without mixing them into the main miner.

## Suggested expansion areas

1. Flashing and setup steps for common ESP32 boards.
2. Pool-connection profiles for testnet and educational environments.
3. Energy and thermal notes for continuous duty operation.
4. Hash-rate estimation, nonce-window sizing, and share-submission timing.
5. Router/hash integration for any future subpages.
6. A 400GHz protocol sketch with fallback behavior and integrity checks.
7. BM1373 and ESP32 spec ops references for board-level coordination.

## Source organization

| Area | Purpose |
|------|---------|
| `index.html` | Browser-facing landing page and navigation hub |
| `README.md` | Human-readable project overview |
| `../bitcoin_miner/` | Mining simulator and live-data dashboard |
| `../Integrated_circuit/` | Hardware companion and circuit notes |
| `../BM1373/` | BM1373 circuit companion page |
| `../ESP32/` | ESP32 circuit companion page |
| 400GHz protocol notes | Conceptual control-plane vocabulary |

## Relationship to the rest of the repo

This directory intentionally points to existing repository primitives rather than creating a closed island. The ESP32 miner concept should remain linked to the router, the hash module, the actions automation layer, the math directories, and the BM1373/ESP32 circuit pages so future pages inherit the same navigation model used by the rest of the site.

The new 400GHz protocol framing fits this pattern because it can be expressed as metadata, docs, and constrained control flow without breaking the rest of the navigation fabric.

## Checklist

- [x] Present a dedicated ESP32 mining entry point
- [x] Link to circuit-level documentation
- [x] Link to the BM1373 circuit page
- [x] Link to the ESP32 circuit page
- [x] Link to actions and compiler roots
- [x] Keep math references visible
- [x] Add 400GHz protocol paradigm language
- [x] Add spec ops expansion language
- [ ] Add firmware diagrams
- [ ] Add a board-specific pin map
- [ ] Add a protocol frame reference
