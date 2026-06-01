# BM1373

This directory documents the BM1373 as a circuit-level companion page for the miner stack.

## Integrations

- [Integrated_circuit](../Integrated_circuit/)
- [ESP32](../ESP32/)
- [bitcoin_miner](../bitcoin_miner/)
- [esp32_bitcoin_pool_miner](../esp32_bitcoin_pool_miner/)
- [actions](../actions/)
- [hash](../hash/)
- [router](../router/)

## Spec ops

The supporting spec ops for BM1373 center on power, timing, telemetry, and safe recovery:

1. Power-up sequencing and rail verification
2. Clock discipline and burst timing
3. Hash-job intake and status reporting
4. Thermal monitoring and throttling
5. Retry, reset, and fallback handling
6. Router/hash provenance checks

## Notes

- Treat this page as an educational hardware companion rather than a replacement for a vendor datasheet.
- Keep all control paths aligned with repository router and hash metadata.

## Checklist

- [x] Create a dedicated BM1373 landing page
- [x] Link the circuit page to ESP32 and miner roots
- [x] Add spec ops guidance for power, timing, and recovery
- [ ] Add block diagrams
- [ ] Add a BOM table
- [ ] Add timing budget tables
