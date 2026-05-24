# ⛏️ 1 TH/s Custom BM1366 Pool Miner
An advanced, open-source-style Terahash-class Bitcoin pool miner. This project utilizes an **ESP32-C3 microcontroller** acting as a Stratum V1 protocol bridge to orchestrate a high-speed daisy-chain of **five Bitmain BM1366 SHA-256 ASIC chips**.
Unlike standard microcontroller projects, this is a **desktop-class, high-current, high-thermal density hardware build** capable of pulling over 150 Amps on the core voltage rail.
> ⚠️ **CRITICAL SAFETY WARNING & DISCLAIMER** ⚠️
> **FIRE HAZARD:** This project involves routing extreme electrical currents (75A - 150A) and managing massive thermal loads. If the PID thermal loop fails, or if a multi-phase buck controller shorts to the 12V input, the ASIC chips will instantly exceed their thermal limits. This will cause catastrophic hardware destruction, melting of heavy copper, vaporized solder, and potential fire.
> **Build, flash, and operate this hardware entirely at your own risk. Never leave this device powered unattended.**
> 
## 📑 Table of Contents
 1. System Architecture
 2. Deep Sub-System Schematics
 3. Bill of Materials (BOM)
 4. PCB Fabrication Notes
 5. Firmware Architecture
 6. Compilation & Flashing
 7. Hardware Bring-Up & Smoke Test
 8. Overclocking & Tuning
## 🧠 System Architecture
The miner operates by isolating the networking domain from the raw hashing domain, utilizing bi-directional logic shifting to bridge the voltage gap.
```text
[High-Current Server PSU: 12V] 
              │ (Via 6-Pin PCIe)
              ▼
[Multi-Phase Buck Stage (TPS546D24A)] ───► [Active Cooling/Fan System]
   │          │          │                    (Controlled via EMC2101)
   │          │          │                              ▲
(0.8V Core) (1.8V I/O) (3.3V VDD)                       │ (PWM / Tacho)
   │          │          │                              │
   ▼          ▼          ▼                              │
[TXS0104E Level Shifters] ◄──────────────► [5x BM1366 ASIC Array]
   ▲          ▲                            (Daisy-Chained TX/RX)
   │          │                                         │
   └──────────┴── [ESP32-C3 Stratum Bridge] ◄───────────┘ (Thermal Diode Data)
                  (Wi-Fi & FreeRTOS Pool Logic)

```
## 🔬 Deep Sub-System Schematics
### Block 1: Multi-Phase Power Delivery Network (PDN)
To power five BM1366 chips (which draw ~30A each when overclocked to 500MHz), we interleave multiple Texas Instruments **TPS546D24A** synchronous buck converters. These share a single PMBus address and operate out-of-phase to cancel out voltage ripple.
```text
[12V_PCIe_INPUT] ─────────┬──────────────┬─────────────────────────┐
(Massive Copper Plane)    │              │                         │
                         [C_IN]         [C_IN]                    [LDO]
                         10uF           10uF                       │
                          │              │                         ▼
                          ▼              ▼                     (+5V_VDD)
                  ┌───────┴──────┐ ┌─────┴────────┐                │
   [SYNC_CLK] ◄───┤SYNC_IN       │ │SYNC_IN       │                │
                  │   TPS546D24A │ │   TPS546D24A │                │
   [PMBus_SDA] ◄──┤SDA  (Master) │ │SDA  (Slave)  │                │
   [PMBus_SCL] ◄──┤SCL           │ │SCL           │                │
                  │              │ │              │                │
                  │        SW_OUT├─┤SW_OUT        │                │
                  └───────┬──────┘ └─────┬────────┘                │
                          │              │                         │
                        [L1]           [L2]  (High Saturation Inductors)
                        150nH          150nH                       │
                          │              │                         │
[0.80V_VCORE] ◄───────────┴──────┬───────┴─────────────────────────┘
(4oz Inner Copper Plane)         │
                              [C_OUT] (Array of 47uF MLCCs)

```
 * **Phase Interleaving:** Master IC dictates the clock; the Slave switches exactly 180 degrees out of phase, preventing the 12V supply from collapsing under 80A+ switching transients.
### Block 2: Logic Translation & Clock Network
BM1366 logic is strictly 1.8V. We use **TXS0104E** bi-directional level shifters. Every BM1366 also requires a perfectly synchronized 25MHz clock driven by a 1-to-5 clock buffer.
```text
      [ESP32-C3 Host]                        [TXS0104E Level Shifter]
      (3.3V Domain)                          (3.3V ◄───► 1.8V Domain)
                                             ┌──────────────────────┐
[VDD_3.3V] ──────────────────────────────────┤ VCCA          VCCB ├─────── [VDD_1.8V]
                                             │                      │
[GPIO5] (SPI_MOSI) / Job Data Out ───────────┤ A1 (3.3V) ► B1 (1.8V)├──────► [ASIC_CHAIN_CI]
[GPIO6] (SPI_CLK)  / Serial Clock ───────────┤ A2 (3.3V) ► B2 (1.8V)├──────► [ASIC_CHAIN_CLK]
[GPIO7] (SPI_CS)   / Chip Select  ───────────┤ A3 (3.3V) ► B3 (1.8V)├──────► [ASIC_CHAIN_CS]
[GPIO4] (SPI_MISO) / Nonce Return ◄──────────┤ A4 (3.3V) ◄ B4 (1.8V)│◄────── [ASIC_CHAIN_RO]
                                             └──────────────────────┘

       [25MHz SMD Crystal]                      [Clock Buffer IC]
             ┌─────┐                         ┌──────────────────────┐
             │ OUT ├───────(25 MHz)─────────►│ IN                   │
             └─────┘                         │       OUT1 ├─────────► [BM1366_1 CLK_IN]
                                             │       OUT2 ├─────────► [BM1366_2 CLK_IN]
                                             │       ...  ├─────────► [BM1366_5 CLK_IN]
                                             └──────────────────────┘

```
### Block 3: The ASIC Hash Chain Topology
BM1366 chips are wired sequentially. The Command In (CI) receives data, and Command Out (CO) pushes it to the next chip. Nonces trickle backward via the Return line (RI -> RO).
```text
  [From Level Shifter]
         │
         ▼
     [BM1366 #1]
  ┌──────────────────┐
  │ CI   (Cmd In)    │
  │ CO   (Cmd Out)   ├──────┐
  │                  │      │
  │ RI   (Rtn In)    │◄──┐  │
  │ RO   (Rtn Out)   │   │  │
  └───────┬──────────┘   │  │
          │              │  │
 (To ESP32 MISO via B4)  │  │
                         │  │
     [BM1366 #2]         │  │
  ┌──────────────────┐   │  │
  │ CI ◄─────────────┼───┘  │
  │ CO ──────────────┼──────┼──────► (To BM1366 #3 CI)
  │                  │      │
  │ RI ◄─────────────┼──────┼─────── (From BM1366 #3 RO)
  │ RO ──────────────┘      │
  └──────────────────┘      │

```
 * **Thermal Pad (Critical):** The physical BM1366 package has a massive exposed GND pad. Your PCB MUST include a 5x5 grid of un-tented 0.3mm vias directly inside this pad to wick 30W of heat per chip down to the heatsink.
### Block 4: I2C Thermal Management Loop
Running chips uncooled destroys them in seconds. The **EMC2101** acts as a hardware watchdog, reading the raw analog differential voltage from the center BM1366 and adjusting fans via PWM.
```text
     [ESP32-C3]                            [EMC2101 Controller]
                                          ┌──────────────────────┐
[GPIO1] (I2C_SDA) ────────────────────────┤ SDA                  │
[GPIO2] (I2C_SCL) ────────────────────────┤ SCL                  │
                                          │                      │
                                          │           DP (Diode+)├──────► [BM1366 #3 D+]
                                          │           DN (Diode-)├──────► [BM1366 #3 D-]
                                          │                      │
                                          │           FAN_PWM    ├──────► [120mm Server Fan PWM Pin]
                                          │           TACH       │◄────── [120mm Server Fan Tach Pin]
                                          │                      │
                                          │           ALERT#     ├──────► [Hardware Power Kill Switch]
                                          └──────────────────────┘

```
 * **The Kill Switch:** The ALERT# pin wires directly to the ENABLE pin of the TPS546D24A buck controllers. If the EMC2101 detects 95°C, it asserts low, instantly killing the 150A power stage regardless of ESP32 software state.
## 🛒 Bill of Materials (BOM)
### Core Logic & Orchestration
 * **Host Microcontroller:** ESP32-C3-WROOM-02 (Single-core RISC-V, Wi-Fi enabled).
 * **Level Shifters:** 2x TXS0104E.
 * **Thermal Controller:** Microchip EMC2101.
 * **Master Clock:** 25MHz high-precision SMD Crystal Oscillator & 1-to-5 Clock Buffer.
### The Hashing Engine
 * **ASIC Silicon:** 5x Bitmain BM1366 (Harvested or sourced).
 * **Thermal Interface:** High-conductivity thermal paste or phase-change pads (> 5 W/mK) + Extruded aluminum block heatsink.
### Power Delivery Network (PDN)
 * **Core Voltage Regulators:** 3-5x TI TPS546D24A.
 * **Power Connectors:** 2x standard 6-pin PCIe through-hole connectors.
 * **Inductors:** High-saturation surface mount power inductors (>40A peak).
## 🛠️ PCB Fabrication Notes (CRITICAL)
This board **cannot** be manufactured using standard 2-layer 1oz copper settings. When submitting /Gerbers to your fab house (e.g., PCBWay, JLCPCB, Sierra Circuits), strictly mandate:
 * **Layer Count:** 4-Layer or 6-Layer stack-up minimum.
 * **Copper Weight (Outer):** 1oz to 2oz minimum for F.Cu and B.Cu.
 * **Copper Weight (Inner):** **2oz to 4oz copper required** for internal power planes (In1.Cu / In2.Cu).
 * **Thermal Vias:** Do **NOT** tent the thermal via matrices beneath components U4 through U8 (BM1366 chips).
 * **Impedance Control:** Keep SPI traces incredibly short to prevent signal degradation at 1M baud rates. Differential thermal traces must remain tightly coupled and shielded from switching node noise.
## 💻 Firmware Architecture
Built entirely on **Espressif's ESP-IDF** (FreeRTOS). The software operates across four concurrent tasks:
 1. **Stratum Task:** Maintains persistent TCP socket. Parses mining.notify payloads.
 2. **ASIC Driver Task:** Pushes the proprietary 11-byte hex boot sequence. Synchronizes baud rate, assigns IDs, pushes hash jobs down CI.
 3. **Nonce Catcher (Interrupt):** Listens on MISO/RO for valid nonces and triggers mining.submit.
 4. **PID Thermal Task:** Background loop polling EMC2101 via I2C every 500ms to modulate fan PWM and hold exactly 70°C.
## ⚡ Compilation & Flashing
 1. Ensure ESP-IDF (v4.4 or v5.0+) is sourced:
   ```bash
   . $HOME/esp/esp-idf/export.sh
   
   ```
 2. Set credentials in Firmware/main/stratum_task.c:
   ```c
   #define WIFI_SSID "Your_Network"
   #define WIFI_PASS "Your_Password"
   #define POOL_URL "stratum.braiins.com"
   #define POOL_PORT 3333
   #define MINER_USER "YourBtcAddress.1TH_Rig"
   
   ```
 3. Build and Flash:
   ```bash
   cd Firmware/
   idf.py set-target esp32c3
   idf.py build
   idf.py -p /dev/ttyUSB0 flash monitor
   
   ```
## 🚀 Hardware Bring-Up & Smoke Test
Follow this rigid three-stage sequence to prevent hardware destruction:
 1. **The Logic & Signal Test (5V USB Only):** Power the ESP32 via USB. Verify 3.3V and 1.8V rails. Probe MOSI/TX to confirm 1.8V square waves from the ESP32.
 2. **The Low-Current Core Test (Benchtop PSU):** Connect a benchtop DC PSU to the 12V PCIe input with a **2.0 Amp current limit**. Verify the TPS546D24A controllers awaken and output exactly 0.80V (or target core voltage). *If you read 12V on the core plane, KILL POWER IMMEDIATELY.*
 3. **Full Power Hashing (Server PSU):** Bolt on the aluminum heatsink with thermal paste. Connect high-static-pressure fans. Connect a 1500W+ server breakout PSU. Monitor the console for Share Accepted!.
## 📈 Overclocking & Tuning
Hitting 1 TH/s requires tuning the BM1366 Phase-Locked Loop (PLL) registers.
 * **Target Frequency:** To achieve ~200 GH/s per chip (1 TH/s total), multiply the 25MHz base clock up to **450 MHz - 550 MHz** via ESP32 hex commands.
 * **Voltage Binning:** Adjust TPS546D24A feedback to bump core voltage from 0.80V to 0.85V or 0.88V for stability at higher frequencies. *Warning: Power draw scales quadratically with voltage; thermal output will increase exponentially.*
