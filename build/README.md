# 1 TH/s Custom BM1366 Pool Miner
An advanced, open-source-style Terahash-class Bitcoin pool miner. This project utilizes an ESP32-C3 microcontroller as a Stratum protocol bridge to orchestrate a high-speed daisy-chain of five Bitmain BM1366 SHA-256 ASIC chips.
Unlike standard microcontroller projects, this is a **high-current, high-thermal density** hardware build capable of pulling over 100 Amps on the core voltage rail.
## ⚙️ Hardware Specifications
 * **Host Controller:** ESP32-C3-WROOM-02 (Handles Wi-Fi & Stratum V1 TCP connections).
 * **Hashing Array:** 5x Bitmain BM1366 ASICs in a sequential TX/RX daisy-chain topology.
 * **Target Hashrate:** ~1.0 TH/s (Requires ~500 MHz PLL overclock).
 * **Core Power Delivery:** Multi-phase synchronous buck controllers (TI TPS546D24A) delivering 0.8V at up to 150A total.
 * **Logic Bridging:** TXS0104E bi-directional level shifters translating 3.3V (ESP32) to 1.8V (ASIC I/O).
 * **Thermal Management:** EMC2101 I2C PWM Fan Controller with dynamic PID loop monitoring the BM1366 internal thermal diode.
 * **Power Input:** Standard 6-pin PCIe (12V) connected to a server PSU.
## 📁 Repository Structure
```text
├── Hardware/
│   ├── KiCad_Project/        # Schematic (.sch) and PCB Layout (.kicad_pcb)
│   ├── Gerbers/              # Fabrication files for the board house
│   └── README-FAB.txt        # Critical instructions for heavy copper fabrication
└── Firmware/
    ├── CMakeLists.txt        # ESP-IDF Project Configuration
    ├── sdkconfig             # FreeRTOS and ESP32 hardware configurations
    └── main/
        ├── main.c            # Entry point and task initialization
        ├── stratum_task.c    # Wi-Fi networking and Pool JSON parsing
        ├── asic_driver.c     # BM1366 proprietary UART/SPI boot and overclock logic
        └── pid_thermal.c     # I2C EMC2101 temperature monitoring and fan PID loop

```
## 🛠️ PCB Fabrication Notes (CRITICAL)
This board cannot be manufactured using standard 2-layer 1oz copper settings. Attempting to pass 100+ Amps through a standard PCB will result in catastrophic failure and fire.
When submitting the /Gerbers folder to a manufacturer (e.g., PCBWay, JLCPCB), you **must** specify the following in your order notes:
 1. **Stack-Up:** 4-Layer or 6-Layer Board minimum.
 2. **Copper Weight:** Outer layers (F.Cu/B.Cu) must be minimum 1oz. Inner power planes (In1.Cu/In2.Cu) **MUST be 2oz to 4oz copper**.
 3. **Thermal Vias:** Do NOT tent the thermal via arrays beneath components U4 through U8 (the BM1366 chips). These must remain open to wick heat into the bottom thermal plane.
 4. **Clearance:** Ensure inner layer trace spacing accommodates the heavy copper etching process (refer to your specific fab's capabilities).
## 💻 Firmware Build Instructions
The firmware is built using **Espressif's ESP-IDF** (C/C++ based on FreeRTOS). The Arduino IDE is not supported due to the real-time multithreading required to balance network latency and hardware interrupts.
### 1. Setup ESP-IDF
Ensure you have ESP-IDF v4.4 or v5.0+ installed on your machine.
```bash
. $HOME/esp/esp-idf/export.sh

```
### 2. Configure Pool Credentials
Before compiling, open Firmware/main/stratum_task.c and update your mining pool URL, port, and Bitcoin worker credentials:
```c
#define POOL_URL "stratum.slushpool.com"
#define POOL_PORT 3333
#define MINER_USER "YourBtcAddress.Worker1"
#define MINER_PASS "x"

```
### 3. Build and Flash
Navigate to the Firmware/ directory, build the project, and flash it to your ESP32-C3 via USB.
```bash
idf.py set-target esp32c3
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor

```
*(Replace /dev/ttyUSB0 or COM3 with your actual serial port).*
## 🚀 Hardware Bring-Up & Testing
Do **NOT** plug the 12V PCIe power in immediately. Follow this strict bring-up sequence:
 1. **Logic Test:** Power the ESP32 via USB 5V only. Verify 3.3V and 1.8V logic lines using a multimeter. Ensure the ESP32 is outputting the ASIC enumeration sequence on the TX line using an oscilloscope.
 2. **Low-Current Core Test:** Connect a benchtop PSU to the 12V PCIe input with a strict **2 Amp current limit**. Verify the TPS546D24A buck controllers are outputting exactly 0.8V to the ASIC core planes.
 3. **Full Power Run:** Attach the extruded aluminum heatsink with high-conductivity thermal paste. Connect server-grade high-RPM fans to the EMC2101. Connect a 100A+ server PSU to the PCIe ports and monitor the ESP-IDF serial output for Share Accepted!
## ⚠️ Disclaimer & Safety Warning
**FIRE HAZARD:** This project involves routing extreme electrical currents (75A - 150A) and managing massive thermal loads. If the PID thermal loop fails or the buck controllers short to 12V, the ASIC chips will instantly exceed their thermal limits, potentially causing hardware destruction, melting of solder, or fire.
**Build and operate this hardware entirely at your own risk.** Do not leave the miner unattended during the initial testing and tuning phases.
