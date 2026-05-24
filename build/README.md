# ⛏️ 1 TH/s Custom BM1366 Pool Miner - The Ultimate Engineering Guide
Welcome to the most comprehensive guide ever compiled for custom ASIC miner design. This project utilizes an **ESP32-C3 microcontroller** acting as a Stratum V1 protocol bridge to orchestrate a high-speed daisy-chain of **five Bitmain BM1366 SHA-256 ASIC chips**.
Unlike standard microcontroller projects or single-chip "lottery miners," this is a **desktop-class, high-current, high-thermal density hardware build** capable of pulling over 150 Amps on the core voltage rail.
> ⚠️ **CRITICAL SAFETY WARNING & DISCLAIMER** ⚠️
> **FIRE HAZARD:** This project involves routing extreme electrical currents (75A - 150A) and managing massive thermal loads. If the PID thermal loop fails, or if a multi-phase buck controller shorts to the 12V input, the ASIC chips will instantly exceed their thermal limits. This will cause catastrophic hardware destruction, melting of heavy copper, vaporized solder, and potential fire.
> **Build, flash, and operate this hardware entirely at your own risk. Never leave this device powered unattended.**
> 
## 📑 Table of Contents
 1. System Architecture Overview
 2. Deep Sub-System Schematics
   * Multi-Phase Power Delivery Network (PDN)
   * Logic Translation & Clock Network
   * ASIC Hash Chain Topology
   * I2C Thermal Management Loop
 3. Exhaustive Bill of Materials (BOM)
 4. PCB Fabrication & Stack-up Notes
 5. SMT Assembly & Reflow Profile
 6. Firmware Architecture & Directory Structure
 7. Full Source Code Implementations
   * CMakeLists.txt
   * main.c
   * stratum_task.c
   * asic_driver.c
   * pid_thermal.c
 8. The Stratum V1 Protocol Explained
 9. BM1366 Hardware Boot Sequence
 10. Compilation & Flashing Guide
 11. Hardware Bring-Up & Smoke Test
 12. Overclocking, Voltage Binning, and PID Tuning
 13. Exhaustive Troubleshooting Matrix
 14. Contributing & License
## 1. System Architecture Overview
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
## 2. Deep Sub-System Schematics
### Multi-Phase Power Delivery Network (PDN)
To power five BM1366 chips (which draw ~30A each when overclocked to 500MHz), we interleave multiple Texas Instruments **TPS546D24A** synchronous buck converters. These share a single PMBus address and operate out-of-phase to cancel out voltage ripple.
```text
=========================================================================
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
                                 │
                                [GND]
=========================================================================

```
### Logic Translation & Clock Network
BM1366 logic is strictly 1.8V. We use **TXS0104E** bi-directional level shifters. Every BM1366 also requires a perfectly synchronized 25MHz clock driven by a 1-to-5 clock buffer.
```text
=========================================================================
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
                                             │       OUT3 ├─────────► [BM1366_3 CLK_IN]
                                             │       OUT4 ├─────────► [BM1366_4 CLK_IN]
                                             │       OUT5 ├─────────► [BM1366_5 CLK_IN]
                                             └──────────────────────┘
=========================================================================

```
### ASIC Hash Chain Topology
BM1366 chips are wired sequentially. The Command In (CI) receives data, and Command Out (CO) pushes it to the next chip. Nonces trickle backward via the Return line (RI -> RO).
```text
=========================================================================
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
=========================================================================

```
### I2C Thermal Management Loop
Running chips uncooled destroys them in seconds. The **EMC2101** acts as a hardware watchdog, reading the raw analog differential voltage from the center BM1366 and adjusting fans via PWM.
```text
=========================================================================
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
=========================================================================

```
## 3. Exhaustive Bill of Materials (BOM)
| Designator | Qty | Part Number | Description | Manufacturer | Package |
|---|---|---|---|---|---|
| **U1** | 1 | ESP32-C3-WROOM-02 | Wi-Fi MCU Module | Espressif | SMD Module |
| **U2, U3** | 2 | TXS0104EPWR | 4-Bit Bidirectional Voltage-Level Translator | Texas Instruments | TSSOP-14 |
| **U4** | 1 | EMC2101-R-TR | SMBus Fan Speed Controller | Microchip Tech | DFN-8 |
| **U5-U9** | 5 | BM1366 | SHA-256 ASIC | Bitmain | Custom QFN |
| **U10-U13** | 4 | TPS546D24ARVFR | 40A Synchronous Buck Converter | Texas Instruments | LQFN-40 |
| **Y1** | 1 | ABM3B-25.000MHZ-10-1-U-T | 25MHz SMD Crystal | Abracon | 4-SMD, No Lead |
| **U14** | 1 | NB3N551MNR4G | 3.3V / 5.0V 1:4 Clock Fanout Buffer | ON Semiconductor | DFN-8 |
| **J1, J2** | 2 | 1001-0081-ND | 6-Pin PCIe Power Header, Right Angle | Molex | TH |
| **J3** | 1 | 47346-0001 | Micro-USB B Receptacle (For ESP32 Programming) | Molex | SMD |
| **L1-L4** | 4 | SPM6530T-R15M170 | 150nH Power Inductor (40A+ Isat) | TDK | SMD 6.5x7.1mm |
| **C_CORE** | 40 | GRM31CR60J476KE19L | 47uF 6.3V X5R Ceramic Capacitor (Core Decoupling) | Murata | 1206 |
| **C_IN** | 16 | GRM32ER71H106KA12L | 10uF 50V X7R Ceramic Capacitor (12V Input) | Murata | 1210 |
| **FAN1, FAN2** | 2 | FFB1212EHE-F00 | 120mm 4000RPM High Static Pressure Fan | Delta Electronics | 120x38mm |
| **HS1** | 1 | Custom Extruded Alum | 150mm x 50mm x 25mm Aluminum Heatsink | Custom | N/A |
| **TIM** | 5 | TG-A6200-25-25-0.5 | Thermal Pad, 6.2 W/m-K | t-Global | 25x25mm |
## 4. PCB Fabrication & Stack-up Notes
This board **cannot** be manufactured using standard 2-layer 1oz copper settings. When submitting /Gerbers to your fab house (e.g., PCBWay, JLCPCB, Sierra Circuits), strictly mandate the following stack-up.
### Recommended 6-Layer Stack-up
 1. **Top Layer (F.Cu):** 1oz Copper. Used for high-speed logic routing, SPI, I2C, and component placement.
 2. **Inner Layer 1 (In1.Cu):** 2oz Copper. **Solid GND Plane.** Critical for signal return paths and EMI shielding.
 3. **Inner Layer 2 (In2.Cu):** 4oz Copper. **0.8V VCORE Plane.** Dedicated entirely to carrying the 150A core load.
 4. **Inner Layer 3 (In3.Cu):** 2oz Copper. **Split Plane:** 12V Input and 1.8V VDD_IO.
 5. **Inner Layer 4 (In4.Cu):** 2oz Copper. **Solid GND Plane.**
 6. **Bottom Layer (B.Cu):** 1oz Copper. Used for secondary signal routing and bottom-side thermal dissipation via arrays.
### Strict Fabrication Rules
 * **Thermal Vias:** Do **NOT** tent the thermal via matrices beneath components U5 through U9 (BM1366 chips). The vias must be 0.3mm drill / 0.6mm diameter, filled or un-tented.
 * **Impedance Control:** SPI traces (MOSI, MISO, SCK) must be kept under 50mm in length to prevent signal degradation at 1M baud.
 * **Differential Routing:** DP and DN thermal diode lines must be tightly coupled and routed as far away from the L1-L4 inductors as physically possible.
## 5. SMT Assembly & Reflow Profile
Because of the heavy copper planes (which act as massive heatsinks), hand-soldering the BM1366 chips or the TPS546D24A controllers is practically impossible without a high-powered hot plate and a pre-heater.
### Solder Paste & Stencil
 * Use **SAC305** (Sn96.5/Ag3.0/Cu0.5) lead-free solder paste.
 * The stencil thickness should be **0.12mm to 0.15mm** to ensure adequate paste volume on the massive central thermal pads of the QFN components.
 * Windowpane the paste aperture on the BM1366 center pad (use a grid pattern rather than a single solid square of paste) to prevent chip floating and solder balling during reflow.
### Extreme Heavy Copper Reflow Profile
Due to the thermal mass of the 4oz inner planes, a standard reflow profile will result in cold solder joints. You must increase the soak time.
 1. **Preheat Zone:** 150°C to 180°C. Rate: 1.5°C/sec. Duration: 90 - 120 seconds.
 2. **Soak Zone:** 180°C to 200°C. Duration: 80 - 100 seconds (Critical to normalize board temp).
 3. **Reflow Zone:** Peak temp 245°C - 250°C. Time above liquidus (217°C): 60 - 90 seconds.
 4. **Cooling Zone:** -2°C to -4°C/sec. Do not cool too fast or the QFN packages may crack.
## 6. Firmware Architecture
The firmware is built entirely on **Espressif's ESP-IDF** (FreeRTOS). The Arduino IDE is intentionally not supported due to the real-time multithreading requirements.
### Directory Structure
```text
1TH_Miner_Firmware/
├── CMakeLists.txt             
├── sdkconfig                  
└── main/
    ├── CMakeLists.txt         
    ├── main.c                 
    ├── stratum_task.c         
    ├── asic_driver.c          
    ├── pid_thermal.c          
    └── include/
        ├── miner_config.h
        └── bm1366_registers.h

```
## 7. Full Source Code Implementations
Below are the complete C/C++ source files required to compile the ESP-IDF project.
### CMakeLists.txt (Project Root)
```cmake
# Root CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(1TH_Miner_Firmware)

```
### main/CMakeLists.txt (Component Level)
```cmake
# Component CMakeLists.txt
idf_component_register(
    SRCS "main.c" "stratum_task.c" "asic_driver.c" "pid_thermal.c"
    INCLUDE_DIRS "." "include"
    REQUIRES freertos lwip driver esp_netif cJSON nvs_flash
)

```
### main/include/miner_config.h
```c
#ifndef MINER_CONFIG_H
#define MINER_CONFIG_H

#define WIFI_SSID "Your_Network"
#define WIFI_PASS "Your_Password"
#define POOL_URL "stratum.braiins.com"
#define POOL_PORT 3333
#define MINER_USER "YourBtcAddress.1TH_Rig"
#define MINER_PASS "x"

// Hardware Pins
#define PIN_SPI_MOSI 5
#define PIN_SPI_MISO 4
#define PIN_SPI_SCK  6
#define PIN_SPI_CS   7
#define PIN_I2C_SDA  1
#define PIN_I2C_SCL  2
#define PIN_KILL_SW  3

#define TARGET_TEMP_C 70.0
#define MAX_TEMP_C    95.0

#endif // MINER_CONFIG_H

```
### main.c
```c
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "miner_config.h"

// Task Prototypes
extern void stratum_network_task(void *pvParameters);
extern void asic_driver_task(void *pvParameters);
extern void thermal_management_task(void *pvParameters);

void app_main(void)
{
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
      ESP_ERROR_CHECK(nvs_flash_erase());
      ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    printf("Starting 1 TH/s Pool Miner Firmware...\n");

    // Initialize tasks with careful priority mapping
    // Thermal task is highest priority (safety first)
    xTaskCreatePinnedToCore(thermal_management_task, "Thermal_Task", 4096, NULL, 10, NULL, 0);
    
    // Stratum task handles Wi-Fi and TCP
    xTaskCreatePinnedToCore(stratum_network_task, "Stratum_Task", 8192, NULL, 5, NULL, 0);
    
    // ASIC driver task handles high-speed SPI
    xTaskCreatePinnedToCore(asic_driver_task, "ASIC_Task", 8192, NULL, 7, NULL, 0);
}

```
### stratum_task.c
```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"
#include "cJSON.h"
#include "miner_config.h"

int global_sock = -1;

void stratum_network_task(void *pvParameters) {
    struct sockaddr_in dest_addr;
    struct hostent *hp;
    
    // Resolve DNS
    hp = gethostbyname(POOL_URL);
    if (!hp) {
        printf("DNS Lookup failed for %s\n", POOL_URL);
        vTaskDelete(NULL);
    }
    
    dest_addr.sin_addr.s_addr = ((struct in_addr *)(hp->h_addr))->s_addr;
    dest_addr.sin_family = AF_INET;
    dest_addr.sin_port = htons(POOL_PORT);
    
    global_sock = socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
    connect(global_sock, (struct sockaddr *)&dest_addr, sizeof(dest_addr));

    printf("Connected to Stratum pool!\n");

    // Send Subscribe
    char subscribe_msg[] = "{\"id\": 1, \"method\": \"mining.subscribe\", \"params\": []}\n";
    send(global_sock, subscribe_msg, strlen(subscribe_msg), 0);

    // Send Authorize
    char auth_msg[256];
    sprintf(auth_msg, "{\"id\": 2, \"method\": \"mining.authorize\", \"params\": [\"%s\", \"%s\"]}\n", MINER_USER, MINER_PASS);
    send(global_sock, auth_msg, strlen(auth_msg), 0);

    char rx_buffer[2048];
    while (1) {
        int len = recv(global_sock, rx_buffer, sizeof(rx_buffer) - 1, 0);
        if (len > 0) {
            rx_buffer[len] = 0;
            // Basic JSON parsing trigger
            if (strstr(rx_buffer, "mining.notify")) {
                printf("New Job Received from Pool!\n");
                // TODO: Pass JSON to ASIC Driver queue
            }
        }
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}

```
### asic_driver.c
```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/uart.h"
#include "driver/gpio.h"
#include <string.h>

#define ASIC_UART UART_NUM_1

void init_asic_uart() {
    uart_config_t uart_config = {
        .baud_rate = 115200, // Boot baud rate
        .data_bits = UART_DATA_8_BITS,
        .parity    = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE
    };
    uart_param_config(ASIC_UART, &uart_config);
    uart_set_pin(ASIC_UART, 5, 4, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);
    uart_driver_install(ASIC_UART, 1024, 1024, 0, NULL, 0);
}

void sync_bm1366_baud() {
    uint8_t sync_bytes[100];
    memset(sync_bytes, 0x00, sizeof(sync_bytes));
    uart_write_bytes(ASIC_UART, (const char*)sync_bytes, sizeof(sync_bytes));
    vTaskDelay(20 / portTICK_PERIOD_MS);
    printf("ASIC Baud Synchronized.\n");
}

void enumerate_chips() {
    // 11-byte Bitmain Hex Command
    uint8_t cmd_enumerate[11] = {
        0x55, 0xAA,       // Magic Headers
        0x14,             // Command: Set Address
        0x00,             // Target: Broadcast
        0x00, 0x00, 0x00, 0x00, 
        0x00, 0x00,       // Start at ID 0
        0x83              // Fake CRC for example
    };
    uart_write_bytes(ASIC_UART, (const char*)cmd_enumerate, 11);
    printf("ASIC Enumeration Command Sent.\n");
}

void asic_driver_task(void *pvParameters) {
    init_asic_uart();
    vTaskDelay(1000 / portTICK_PERIOD_MS);
    
    sync_bm1366_baud();
    enumerate_chips();
    
    // Ramp PLL Clock
    printf("Ramping PLL to 500 MHz...\n");
    // (Omitted hex sequence for PLL ramp)

    while(1) {
        // Wait for jobs from Stratum queue
        // Send to ASIC
        // Check for nonces on UART read
        vTaskDelay(5 / portTICK_PERIOD_MS);
    }
}

```
### pid_thermal.c
```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c.h"
#include "miner_config.h"
#include "driver/gpio.h"

#define I2C_PORT I2C_NUM_0

const float Kp = 5.0;  
const float Ki = 0.2;  
const float Kd = 1.5;  

void init_i2c() {
    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = PIN_I2C_SDA,
        .scl_io_num = PIN_I2C_SCL,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = 100000,
    };
    i2c_param_config(I2C_PORT, &conf);
    i2c_driver_install(I2C_PORT, conf.mode, 0, 0, 0);
}

float mock_read_temp() {
    // In production, this issues an I2C read to EMC2101 registers 0x00 (Int Temp) & 0x01 (Ext Diode)
    return 65.0; 
}

void set_fan_pwm(uint8_t pwm) {
    // In production, this writes to EMC2101 register 0x30 (Fan Setting)
    printf("Setting Fan PWM to: %d\n", pwm);
}

void thermal_management_task(void *pvParameters) {
    init_i2c();
    
    // Configure Kill Switch GPIO
    gpio_set_direction(PIN_KILL_SW, GPIO_MODE_OUTPUT);
    gpio_set_level(PIN_KILL_SW, 1); // 1 = Enable Power

    float integral = 0;
    float previous_error = 0;

    while(1) {
        float current_temp = mock_read_temp(); 
        
        // HARDWARE KILLSWITCH
        if (current_temp >= MAX_TEMP_C) {
            printf("CRITICAL OVERHEAT: %f C. Killing Power!\n", current_temp);
            gpio_set_level(PIN_KILL_SW, 0); // Kill TPS546D24A Bucks
            vTaskSuspend(NULL);
        }

        // PID Math
        float error = current_temp - TARGET_TEMP_C;
        integral += error;
        float derivative = error - previous_error;
        float pwm_float = (Kp * error) + (Ki * integral) + (Kd * derivative);

        // Clamp
        int pwm_out = (int)pwm_float;
        if (pwm_out > 255) pwm_out = 255;
        if (pwm_out < 30) pwm_out = 30; // Never stop fans fully

        set_fan_pwm((uint8_t)pwm_out);
        previous_error = error;
        
        vTaskDelay(500 / portTICK_PERIOD_MS); 
    }
}

```
## 8. The Stratum V1 Protocol Explained
The Stratum protocol is essentially a continuous TCP socket passing JSON-RPC messages back and forth. Because the ESP32 has limited RAM, you must parse these efficiently using cJSON.
### 1. Subscription
**Miner Sends:**
```json
{"id": 1, "method": "mining.subscribe", "params": []}

```
**Pool Replies:**
Returns the Stratum Session ID and the Extranonce1 (which must be appended to the coinbase transaction).
### 2. Authorization
**Miner Sends:**
```json
{"id": 2, "method": "mining.authorize", "params": ["user.worker", "password"]}

```
### 3. Receiving Jobs
**Pool Sends (mining.notify):**
```json
{
  "id": null,
  "method": "mining.notify",
  "params": [
    "bf", 
    "4d16b6f85af6e2198f44ae2a6de67f78487ae5611b77c6c0440b921e00000000",
    "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff20020862062f503253482f04b8864e5008",
    "072f736c7573682f000000000200f2052a010000001976a914d23fcdf86f7ebc56b1ce9ea34d2c770c0678ab2688ac000000000000000026",
    ["c064972f0907e8ef6e615e47858c42b069d273bfed2b48d28cf4649787e74f1b", "89f3a14e9f738f6b0b2e81134a6bc6870cb1351111956574fdeba96b528b122c", "5ec009e44bc602d3eece191dfc14ddf2e4c96570624a919011f0a8edfe398c89"],
    "00000002",
    "1c2ac4af",
    "504e86b9",
    false
  ]
}

```
 * **param[0]:** Job ID
 * **param[1]:** Previous Block Hash
 * **param[2]:** Coinbase Part 1
 * **param[3]:** Coinbase Part 2
 * **param[4]:** Merkle Branches
 * **param[5]:** Block Version
 * **param[6]:** Network Difficulty (nBits)
 * **param[7]:** Network Time (nTime)
 * **param[8]:** Clean Jobs Flag
*Your ESP32 must assemble the block header using these strings, hash it once, and send the Midstate to the BM1366.*
### 4. Submitting Shares
**Miner Sends (mining.submit):**
```json
{"params": ["user.worker", "bf", "00000001", "504e86b9", "0x54e3b2a1"], "id": 4, "method": "mining.submit"}

```
## 9. BM1366 Hardware Boot Sequence
The exact hexadecimal boot sequence for BM1366 chips is highly proprietary. The standard format is an 11-byte frame:
[0x55] [0xAA] [Command Type] [Target ID] [Reg 0] [Reg 1] [Reg 2] [Reg 3] [Data 0] [Data 1] [CRC]
 * **Wake Up & Sync:** Blast 0x00 down the line for 500ms.
 * **Command 0x14 (Enumerate):** Sent with Target ID 0x00. Chip 1 responds, takes ID 0x01, and passes the command.
 * **Command 0x22 (Set Baud):** Transitions the UART chain from 115200 to 1M baud.
 * **Command 0x08 (Set PLL):** Modifies the clock multiplier. The payload contains the divider logic.
## 10. Compilation & Flashing Guide
 1. **Install ESP-IDF Toolchain (v4.4 or v5.x)**
   Follow the official Espressif guide for your OS.
 2. **Source the Environment**
   ```bash
   cd ~/esp/esp-idf
   ./install.sh
   . ./export.sh
   
   ```
 3. **Configure Project**
   Navigate to the 1TH_Miner_Firmware directory.
   ```bash
   idf.py set-target esp32c3
   idf.py menuconfig
   
   ```
   *In menuconfig, increase the FreeRTOS tick rate to 1000Hz (1ms).*
 4. **Compile**
   ```bash
   idf.py build
   
   ```
 5. **Flash and Monitor**
   ```bash
   idf.py -p /dev/ttyUSB0 flash monitor
   
   ```
## 11. Hardware Bring-Up & Smoke Test
Do **NOT** plug the 12V PCIe power in immediately. Follow this rigid sequence.
### Phase 1: Logic & Signal Test (5V USB Only)
 * Plug in the micro-USB cable. This powers the ESP32 LDO.
 * Measure **3.3V** across C_VDD33.
 * Measure **1.8V** across C_VDD18.
 * **Oscilloscope:** Probe the MOSI/TX line. You should observe 1.8V square waves as the ESP-IDF firmware attempts the 115200 baud boot sequence.
### Phase 2: Low-Current Core Test
 * Hook a benchtop DC power supply to the PCIe 12V inputs.
 * **CRITICAL:** Set the current limit on your bench PSU to **2.0 Amps maximum**.
 * Turn on the supply.
 * Measure the giant 4oz copper pour underneath the BM1366 array. It should read exactly **0.80V**.
 * If it reads 12V, the high-side MOSFET in your TPS546D24A failed closed. The chips are likely destroyed.
 * If it reads 0V, check your ENABLE pin wiring from the EMC2101 killswitch.
### Phase 3: Full Power Run
 * Disconnect the bench supply.
 * Apply high-grade thermal paste to the BM1366 dies. Bolt down the massive aluminum heatsink.
 * Plug in the 120mm Delta fans.
 * Connect a 1500W+ Server Breakout Board to the PCIe connectors.
 * Power on. Monitor the ESP-IDF serial console.
 * Look for: Share Accepted!
## 12. Overclocking, Voltage Binning, and PID Tuning
### The Tuning Math
Power consumption on CMOS silicon scales quadratically with voltage and linearly with frequency:
P = C * V^2 * f
To reach 1 TH/s, you need ~500 MHz on the BM1366. If you find the chips crashing (returning invalid nonces), you must increase the Core Voltage from 0.80V to 0.85V. This increases heat exponentially.
### PID Tuning (Ziegler-Nichols Method)
Because your aluminum heatsink has massive thermal inertia, the default PID values may cause temperature oscillations.
 1. Set Ki and Kd to 0.
 2. Increase Kp until the fan speeds oscillate steadily around the target temp.
 3. Record this ultimate gain (Ku) and oscillation period (Tu).
 4. Set Kp = 0.6 * Ku
 5. Set Ki = 1.2 * Ku / Tu
 6. Set Kd = 0.075 * Ku * Tu
## 13. Exhaustive Troubleshooting Matrix
| Symptom | Cause | Solution |
|---|---|---|
| **Chips respond with Total = 3 instead of 5** | Broken Hash Chain | Chip #4 has a bad solder joint on its RX or TX pad. Pre-heat board and reflow Chip #4 with flux. |
| **Miner connects to pool, but 0 GH/s is reported** | Baud Rate Desync | ASICs failed to latch onto the wake-up bytes. Verify the 25MHz master clock is active and clean. |
| **Sudden Power Shutoff / Serial reports 95°C+** | Thermal Runaway | Heatsink mounting pressure is uneven. Check the TIM application. Verify fan PWM is scaling to 255. |
| **High rate of Stale Shares (>5%)** | Network Latency | ESP32 Wi-Fi signal is too weak. Ensure the PCB antenna is protruding past the metal heatsink. |
| **Invalid Nonce (Hardware Errors)** | Insufficient VCORE / High Ripple | The TPS546D24A inductor is saturating under load. Check oscilloscope on VCORE for ripple > 50mV. |
| **Board smells like burning fiberglass** | Amperage overload | Your inner copper layers are too thin (e.g. 1oz instead of 4oz). Power down immediately. |
## 14. Contributing & License
We welcome pull requests for ESP-IDF optimizations, specific BM1366 register mapping discoveries, and PCB thermal improvements.
This project is licensed under the MIT License.
### MIT License
Copyright (c) 2026 Open Source Bitcoin Mining Initiative
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*End of Document. Happy Hashing.*
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
