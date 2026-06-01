// ESP32 servo example: PCA9685 multi-servo driver over I2C.
// Board target: ESP32-class MCU with I2C-connected servo expansion.
// Dependencies: Wire.h, basic I2C register writes.

#include <Wire.h>

constexpr uint8_t kPcaAddr = 0x40;

void writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(kPcaAddr);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

void setPwmFreq(uint16_t freqHz) {
  const float prescaleVal = 25000000.0f / (4096.0f * freqHz) - 1.0f;
  const uint8_t prescale = static_cast<uint8_t>(prescaleVal + 0.5f);
  Wire.beginTransmission(kPcaAddr);
  Wire.write(0x00);
  Wire.write(0x10);
  Wire.endTransmission();
  writeRegister(0xFE, prescale);
  writeRegister(0x00, 0x20);
}

void setChannel(uint8_t channel, uint16_t on, uint16_t off) {
  const uint8_t base = 0x06 + 4 * channel;
  Wire.beginTransmission(kPcaAddr);
  Wire.write(base);
  Wire.write(on & 0xFF);
  Wire.write(on >> 8);
  Wire.write(off & 0xFF);
  Wire.write(off >> 8);
  Wire.endTransmission();
}

void writeServoAngle(uint8_t channel, int angle) {
  const uint16_t pulse = map(angle, 0, 180, 205, 410);
  setChannel(channel, 0, pulse);
}

void setup() {
  Wire.begin();
  setPwmFreq(50);
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 10) {
    for (uint8_t channel = 0; channel < 4; ++channel) {
      writeServoAngle(channel, (angle + channel * 15) % 180);
    }
    delay(30);
  }
  for (int angle = 180; angle >= 0; angle -= 10) {
    for (uint8_t channel = 0; channel < 4; ++channel) {
      writeServoAngle(channel, (angle + channel * 15) % 180);
    }
    delay(30);
  }
}

