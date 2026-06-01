# ESP32

This directory documents the ESP32 as a circuit-level control companion for the repository's mining stack.

## Integrations

- [Integrated_circuit](../Integrated_circuit/)
- [BM1373](../BM1373/)
- [bitcoin_miner](../bitcoin_miner/)
- [esp32_bitcoin_pool_miner](../esp32_bitcoin_pool_miner/)
- [actions](../actions/)
- [compiler](../compiler/)
- [hash](../hash/)
- [router](../router/)

## Spec ops

The ESP32 spec ops focus on control, network, and safety behavior:

1. Boot and flash workflow
2. Wi-Fi and pool transport setup
3. GPIO, LED, and serial control
4. Telemetry, timing, and retry handling
5. Thermal and power-safe fallback modes
6. Router/hash provenance checks

## Notes

- Use this page as the MCU-side companion to the BM1373 circuit page.
- Keep board, firmware, and transport vocabulary consistent with the integrated circuit hub.

## Examples

- [Mining](./examples/mining/) — pool client and double-SHA256 bring-up scripts
- [Multiple servos](./examples/servos/) — native PWM and PCA9685-backed servo demos
- [I2C](./examples/i2c/) — bus scan and generic peripheral probe scripts

## Checklist

- [x] Create a dedicated ESP32 landing page
- [x] Link the circuit page to BM1373 and miner roots
- [x] Add spec ops guidance for boot, network, and recovery
- [x] Add example script families for mining, multiple servos, and I2C
- [ ] Add pinout tables
- [ ] Add firmware diagrams
- [ ] Add protocol frame references
