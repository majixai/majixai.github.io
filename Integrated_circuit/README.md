# Integrated Circuit

This directory captures circuit-level ideas that complement the Bitcoin miner and ESP32-P4/8x BM1373 exploration.

## Integrations

- [esp32_bitcoin_pool_miner](../esp32_bitcoin_pool_miner/)
- [BM1373](../BM1373/)
- [ESP32](../ESP32/)
- [Ttp223](../Ttp223/)
- [bitcoin_miner](../bitcoin_miner/)
- [actions](../actions/)
- [compiler](../compiler/)
- Mathematics roots:
  - [algebra](../algebra/)
  - [calculus](../calculus/)
  - [category_theory](../category_theory/)

## Notes

- Designed as an educational circuit/hardware companion.
- Current target concept: an ESP32-P4 control board for eight BM1373 ASICs with Bitaxe-style flashing support and reverse-engineered bring-up notes.
- Linked into the site router and repository hash system.

## 400GHz protocol paradigm

The 400GHz protocol paradigm describes the board-side interpretation of a fast, deterministic control channel. It emphasizes tiny bursts, explicit timing, and a clear path back to serial or Wi-Fi when the high-rate concept is unavailable.

### Principles

1. Prefer short, verified frames.
2. Make clock assumptions visible.
3. Keep fallback modes easy to reach.
4. Tie each transaction to repository provenance.
5. Use the same terminology across hardware and miner pages.
6. Treat BM1373 integration as schematic-driven reverse engineering unless proven otherwise.

### Conceptual layers

| Layer | Meaning |
|-------|---------|
| Analog | Fast signaling and board timing |
| Digital | Frame parsing and control words |
| Control | Power, LEDs, and job state |
| Audit | Hash and router integrity checks |
| Recovery | UART, Wi-Fi, and local diagnostics |

### Why it exists here

The circuit page is the right place to explain how a high-rate protocol maps onto actual components, because hardware design needs the same discipline as the mining workflow: tiny state, clear recovery, and visible metrics.

## What lives here

- A home for circuit-level reasoning, board layout notes, and embedded control descriptions.
- A companion to the ESP32 mining page for people thinking about hardware and transport together.
- A hub for Ttp223 touch-input notes.
- A hub for BM1373 and ESP32 spec ops notes.
- A place to keep low-level design notes separate from the higher-level bitcoin_miner dashboard.

## Suggested expansion areas

1. A simple block diagram for power, Wi-Fi, status LEDs, and UART.
2. BOM notes for regulators, sensors, and supporting passive components.
3. Pinout reference tables for common ESP32 boards.
4. Thermal and power constraints for sustained operation.
5. Linkable examples that show how circuit timing relates to mining throughput.
6. A 400GHz transport interpretation for control and telemetry.
7. Spec ops matrices for BM1373 and ESP32 control paths.

## Source organization

| Area | Purpose |
|------|---------|
| `index.html` | Browser-facing companion page and navigation hub |
| `README.md` | High-level documentation and integration guide |
| `../esp32_bitcoin_pool_miner/` | ESP32 mining concept page |
| `../BM1373/` | BM1373 circuit companion page |
| `../ESP32/` | ESP32 circuit companion page |
| `../bitcoin_miner/` | Main mining demo and live data dashboard |
| 400GHz protocol notes | Circuit-side transport vocabulary |

## Relationship to repository systems

The circuit page should remain visible to the same systems that power the rest of the site: router routes, hash-based integrity checks, and the actions layer. That keeps the hardware notes easy to discover and makes it simple to extend the directory later with diagrams, calculators, or embedded demos.

The 400GHz protocol paradigm belongs here because it gives the circuit page a structured way to talk about speed, determinism, and safe degradation without departing from repository conventions.

## Checklist

- [x] Present a dedicated circuit-level landing page
- [x] Link to the ESP32 mining directory
- [x] Link to the BM1373 circuit page
- [x] Link to the ESP32 circuit page
- [x] Link to the main mining demo
- [x] Keep math references visible
- [x] Add 400GHz protocol paradigm language
- [x] Add spec ops expansion language
- [ ] Add schematics
- [ ] Add a BOM table
- [ ] Add a frame timing budget
