# Ttp223

This directory documents the TTP223 capacitive touch sensor as a circuit-level companion for the repository's control and input pages.

## Integrations

- [Integrated_circuit](../Integrated_circuit/)
- [ESP32](../ESP32/)
- [bitcoin_miner](../bitcoin_miner/)
- [actions](../actions/)
- [router](../router/)
- [hash](../hash/)

## Spec ops

The TTP223 spec ops focus on touch behavior, wake handling, and safe control signaling:

1. Touch threshold calibration
2. Debounce and re-trigger handling
3. Wake and low-power behavior
4. GPIO and interrupt signaling
5. Status feedback and recovery
6. Router/hash provenance checks

## Notes

- Use this page as the touch-input companion for the control plane.
- Keep control vocabulary consistent with the ESP32 and Integrated_circuit pages.

## Checklist

- [x] Create a dedicated Ttp223 landing page
- [x] Link the touch sensor to ESP32 and circuit roots
- [x] Add spec ops guidance for touch, wake, and recovery
- [ ] Add wiring diagrams
- [ ] Add threshold tables
- [ ] Add debounce timing notes
