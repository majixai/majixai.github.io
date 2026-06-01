// ESP32 mining example: double-SHA256 core demo.
// Board target: ESP32-class MCU used for educational mining workloads.
// Dependencies: mbedtls/sha256.h, Serial.

#include <mbedtls/sha256.h>

void sha256Once(const uint8_t* input, size_t length, uint8_t out[32]) {
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts_ret(&ctx, 0);
  mbedtls_sha256_update_ret(&ctx, input, length);
  mbedtls_sha256_finish_ret(&ctx, out);
  mbedtls_sha256_free(&ctx);
}

void sha256d(const uint8_t* input, size_t length, uint8_t out[32]) {
  uint8_t first[32];
  sha256Once(input, length, first);
  sha256Once(first, sizeof(first), out);
}

void setup() {
  Serial.begin(115200);
  delay(200);
  const uint8_t blockHeader[] = {0x00, 0x01, 0x02, 0x03, 0x04};
  uint8_t digest[32];
  sha256d(blockHeader, sizeof(blockHeader), digest);

  Serial.println("Double-SHA256 digest:");
  for (uint8_t byte : digest) {
    Serial.printf("%02x", byte);
  }
  Serial.println();
}

void loop() {
  delay(1000);
}

