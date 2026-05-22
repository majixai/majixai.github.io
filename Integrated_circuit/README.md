# Integrated Circuit

This directory captures circuit-level ideas that complement the Bitcoin miner and ESP32 exploration.

## Integrations

- [esp32_bitcoin_pool_miner](../esp32_bitcoin_pool_miner/)
- [bitcoin_miner](../bitcoin_miner/)
- [actions](../actions/)
- [compiler](../compiler/)
- Mathematics roots:
  - [algebra](../algebra/)
  - [calculus](../calculus/)
  - [category_theory](../category_theory/)

## Notes

- Designed as an educational circuit/hardware companion.
- Linked into the site router and repository hash system.

## What lives here

- A home for circuit-level reasoning, board layout notes, and embedded control descriptions.
- A companion to the ESP32 mining page for people thinking about hardware and transport together.
- A place to keep low-level design notes separate from the higher-level bitcoin_miner dashboard.

## Suggested expansion areas

1. A simple block diagram for power, Wi-Fi, status LEDs, and UART.
2. BOM notes for regulators, sensors, and supporting passive components.
3. Pinout reference tables for common ESP32 boards.
4. Thermal and power constraints for sustained operation.
5. Linkable examples that show how circuit timing relates to mining throughput.

## Source organization

| Area | Purpose |
|------|---------|
| `index.html` | Browser-facing companion page and navigation hub |
| `README.md` | High-level documentation and integration guide |
| `../esp32_bitcoin_pool_miner/` | ESP32 mining concept page |
| `../bitcoin_miner/` | Main mining demo and live data dashboard |

## Relationship to repository systems

The circuit page should remain visible to the same systems that power the rest of the site: router routes, hash-based integrity checks, and the actions layer. That keeps the hardware notes easy to discover and makes it simple to extend the directory later with diagrams, calculators, or embedded demos.

## Checklist

- [x] Present a dedicated circuit-level landing page
- [x] Link to the ESP32 mining directory
- [x] Link to the main mining demo
- [x] Keep math references visible
- [ ] Add schematics
- [ ] Add a BOM table
