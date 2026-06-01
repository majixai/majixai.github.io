// ESP32 I2C example: generic sensor register probe.
// Board target: ESP32-class MCU reading a simple I2C peripheral.
// Dependencies: Wire.h.

#include <Wire.h>

constexpr uint8_t kSensorAddr = 0x68;
constexpr uint8_t kRegisterId = 0x00;
constexpr uint8_t kRegisterValue = 0x01;

uint8_t readRegister(uint8_t reg) {
  Wire.beginTransmission(kSensorAddr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(kSensorAddr, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  const uint8_t id = readRegister(kRegisterId);
  const uint8_t value = readRegister(kRegisterValue);
  Serial.printf("Device ID: 0x%02x\n", id);
  Serial.printf("Value: 0x%02x\n", value);
}

void loop() {
  delay(5000);
}

