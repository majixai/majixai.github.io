// ESP32 I2C example: bus scanner.
// Board target: ESP32-class MCU with a standard Wire bus.
// Dependencies: Wire.h.

#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Serial.println("Scanning I2C bus");

  for (uint8_t address = 1; address < 127; ++address) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      Serial.printf("Found device at 0x%02x\n", address);
    }
  }
}

void loop() {
  delay(5000);
}

