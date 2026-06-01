// ESP32 servo example: multiple PWM servo sweep.
// Board target: ESP32-class MCU driving several hobby servos.
// Dependencies: native LEDC PWM support.

constexpr int kServoPins[] = {13, 14, 15, 16};
constexpr int kServoChannels[] = {0, 1, 2, 3};
constexpr int kServoFreq = 50;
constexpr int kServoResolution = 16;

int angleToDuty(int angle) {
  const int minDuty = 1638;
  const int maxDuty = 8192;
  return map(angle, 0, 180, minDuty, maxDuty);
}

void attachServo(int index) {
  ledcSetup(kServoChannels[index], kServoFreq, kServoResolution);
  ledcAttachPin(kServoPins[index], kServoChannels[index]);
}

void writeServo(int index, int angle) {
  ledcWrite(kServoChannels[index], angleToDuty(angle));
}

void setup() {
  for (int i = 0; i < 4; ++i) {
    attachServo(i);
  }
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 5) {
    for (int i = 0; i < 4; ++i) {
      writeServo(i, (angle + i * 20) % 180);
    }
    delay(20);
  }

  for (int angle = 180; angle >= 0; angle -= 5) {
    for (int i = 0; i < 4; ++i) {
      writeServo(i, (angle + i * 20) % 180);
    }
    delay(20);
  }
}

