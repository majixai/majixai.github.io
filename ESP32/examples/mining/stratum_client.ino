// ESP32 mining example: minimal Wi-Fi pool client scaffold.
// Board target: ESP32-class MCU used as a control plane for mining demos.
// Dependencies: WiFi.h, built-in TCP client support.

#include <WiFi.h>

constexpr char kSsid[] = "YOUR_WIFI_SSID";
constexpr char kPassword[] = "YOUR_WIFI_PASSWORD";
constexpr char kPoolHost[] = "pool.example.com";
constexpr uint16_t kPoolPort = 3333;

WiFiClient client;
unsigned long lastConnectAttempt = 0;

void connectToPool() {
  if (client.connected()) {
    return;
  }

  if (millis() - lastConnectAttempt < 5000) {
    return;
  }

  lastConnectAttempt = millis();
  Serial.printf("Connecting to %s:%u\n", kPoolHost, kPoolPort);
  if (client.connect(kPoolHost, kPoolPort)) {
    client.print("{\"id\":1,\"method\":\"mining.subscribe\",\"params\":[]}\n");
    client.print("{\"id\":2,\"method\":\"mining.authorize\",\"params\":[\"worker\",\"x\"]}\n");
    Serial.println("Pool connection established");
  } else {
    Serial.println("Pool connection failed");
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(kSsid, kPassword);
  Serial.println("Booting mining example");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  connectToPool();

  while (client.available()) {
    Serial.write(client.read());
  }
}

