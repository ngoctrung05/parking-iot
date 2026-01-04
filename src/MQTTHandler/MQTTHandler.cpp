/**
 * @file MQTTHandler.cpp
 * @brief Implementation of MQTT client with JSON handling
 */

#include "MQTTHandler.h"

// Initialize static instance pointer
MQTTHandler* MQTTHandler::_instance = nullptr;

MQTTHandler::MQTTHandler() 
  : _mqttClient(_wifiClient),
    _server(MQTT_SERVER),
    _port(MQTT_PORT),
    _commandCallback(nullptr),
    _lastReconnectAttempt(0),
    _publishCount(0),
    _receiveCount(0) {
  
  // Set static instance pointer for callback
  _instance = this;
  _clientId = generateClientId();
}

bool MQTTHandler::begin(const char* server, int port) {
  // Use provided values or defaults from Config.h
  if (server != nullptr) {
    _server = String(server);
  }
  if (port > 0) {
    _port = port;
  }
  
  DEBUG_PRINT("Connecting to MQTT broker: ");
  DEBUG_PRINT(_server);
  DEBUG_PRINT(":");
  DEBUG_PRINTLN(_port);
  
  // Configure TLS/SSL for HiveMQ Cloud
  _wifiClient.setInsecure();  // Skip certificate validation (for development)
  // For production, use: _wifiClient.setCACert(root_ca); with a proper certificate
  
  DEBUG_PRINTLN("✓ TLS/SSL configured (insecure mode for testing)");
  
  _mqttClient.setServer(_server.c_str(), _port);
  _mqttClient.setCallback(mqttCallback);
  _mqttClient.setBufferSize(MQTT_BUFFER_SIZE);
  
  return reconnect();
}

bool MQTTHandler::isConnected() {
  return _mqttClient.connected();
}

void MQTTHandler::update() {
  unsigned long currentTime = millis();
  
  if (!_mqttClient.connected()) {
    // Try to reconnect periodically
    if (currentTime - _lastReconnectAttempt >= MQTT_RECONNECT_INTERVAL) {
      _lastReconnectAttempt = currentTime;
      reconnect();
    }
  } else {
    _mqttClient.loop();
  }
}

bool MQTTHandler::reconnect() {
  if (_mqttClient.connected()) {
    return true;
  }
  
  DEBUG_PRINT("Attempting MQTT connection (");
  DEBUG_PRINT(_clientId);
  DEBUG_PRINT(")...");
  
  // Connect with username and password
  if (_mqttClient.connect(_clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    DEBUG_PRINTLN(" connected!");
    
    // Subscribe to command topic
    if (_mqttClient.subscribe(MQTT_TOPIC_COMMANDS)) {
      DEBUG_PRINT("✓ Subscribed to: ");
      DEBUG_PRINTLN(MQTT_TOPIC_COMMANDS);
    }
    
    return true;
  } else {
    DEBUG_PRINT(" failed, rc=");
    DEBUG_PRINTLN(_mqttClient.state());
    return false;
  }
}

bool MQTTHandler::publishEntry(const String& cardUID, int slotId, 
                               const String& status, int availableSlots, 
                               unsigned long timestamp) {
  if (!isConnected()) {
    return false;
  }
  
  JsonDocument doc;
  doc["action"] = "entry";
  doc["card_uid"] = cardUID;
  doc["slot_id"] = slotId;
  doc["gate"] = "entrance";
  doc["status"] = status;
  doc["available_slots"] = availableSlots;
  doc["timestamp"] = timestamp;
  
  bool result = publishJSON(MQTT_TOPIC_ENTRY, doc);
  
  if (result) {
    _publishCount++;
    DEBUG_PRINT("✓ Published entry: ");
    DEBUG_PRINT(cardUID);
    if (slotId > 0) {
      DEBUG_PRINT(" -> Slot ");
      DEBUG_PRINT(slotId);
      DEBUG_PRINT(" (");
      DEBUG_PRINT(status);
      DEBUG_PRINTLN(")");
    } else {
      DEBUG_PRINT(" -> DENIED (");
      DEBUG_PRINT(status);
      DEBUG_PRINTLN(")");
    }
  }
  
  return result;
}

bool MQTTHandler::publishExit(const String& cardUID, int slotId, 
                              const String& status, unsigned long duration,
                              int availableSlots, unsigned long timestamp) {
  if (!isConnected()) {
    return false;
  }
  
  JsonDocument doc;
  doc["action"] = "exit";
  doc["card_uid"] = cardUID;
  doc["slot_id"] = slotId;
  doc["gate"] = "exit";
  doc["status"] = status;
  doc["duration"] = duration;
  doc["available_slots"] = availableSlots;
  doc["timestamp"] = timestamp;
  
  bool result = publishJSON(MQTT_TOPIC_EXIT, doc);
  
  if (result) {
    _publishCount++;
    DEBUG_PRINT("✓ Published exit: ");
    DEBUG_PRINT(cardUID);
    DEBUG_PRINT(" <- Slot ");
    DEBUG_PRINT(slotId);
    DEBUG_PRINT(" (");
    DEBUG_PRINT(duration);
    DEBUG_PRINTLN("s)");
  }
  
  return result;
}

bool MQTTHandler::publishStatus(int totalSlots, int availableSlots, 
                                int authorizedCards, bool emergencyMode,
                                int rssi, unsigned long uptime) {
  if (!isConnected()) {
    return false;
  }
  
  JsonDocument doc;
  doc["type"] = "status";
  doc["timestamp"] = millis() / 1000;
  doc["total_slots"] = totalSlots;
  doc["available_slots"] = availableSlots;
  doc["occupied_slots"] = totalSlots - availableSlots;
  doc["authorized_cards"] = authorizedCards;
  doc["emergency_mode"] = emergencyMode;
  doc["wifi_rssi"] = rssi;
  doc["uptime"] = uptime;
  
  bool result = publishJSON(MQTT_TOPIC_SYSTEM, doc);
  
  if (result) {
    _publishCount++;
    DEBUG_PRINTLN("✓ Published system status");
  }
  
  return result;
}

bool MQTTHandler::publishScanEvent(const String& cardUID, const String& gate, 
                                   unsigned long timestamp) {
  if (!isConnected()) {
    return false;
  }
  
  JsonDocument doc;
  doc["type"] = "card_scanned";
  doc["card_uid"] = cardUID;
  doc["gate"] = gate;
  doc["timestamp"] = timestamp;
  
  bool result = publishJSON(MQTT_TOPIC_SCAN, doc);
  
  if (result) {
    _publishCount++;
    DEBUG_PRINT("✓ Published scan event: ");
    DEBUG_PRINT(cardUID);
    DEBUG_PRINT(" at ");
    DEBUG_PRINT(gate);
    DEBUG_PRINTLN(" gate");
  }
  
  return result;
}

bool MQTTHandler::publishJSON(const char* topic, JsonDocument& doc) {
  if (!isConnected()) {
    return false;
  }
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  bool result = _mqttClient.publish(topic, jsonString.c_str());
  
  if (!result) {
    DEBUG_PRINT("✗ MQTT publish failed to topic: ");
    DEBUG_PRINTLN(topic);
  }
  
  return result;
}

void MQTTHandler::setCommandCallback(MQTTCommandCallback callback) {
  _commandCallback = callback;
  DEBUG_PRINTLN("✓ MQTT command callback set");
}

bool MQTTHandler::subscribe(const char* topic) {
  if (!isConnected()) {
    return false;
  }
  
  bool result = _mqttClient.subscribe(topic);
  
  if (result) {
    DEBUG_PRINT("✓ Subscribed to: ");
    DEBUG_PRINTLN(topic);
  } else {
    DEBUG_PRINT("✗ Failed to subscribe to: ");
    DEBUG_PRINTLN(topic);
  }
  
  return result;
}

int MQTTHandler::getState() {
  return _mqttClient.state();
}

unsigned long MQTTHandler::getPublishCount() const {
  return _publishCount;
}

unsigned long MQTTHandler::getReceiveCount() const {
  return _receiveCount;
}

String MQTTHandler::generateClientId() {
  return "ESP32Parking-" + String(random(0xffff), HEX);
}

void MQTTHandler::mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (_instance != nullptr) {
    _instance->handleMessage(topic, payload, length);
  }
}

void MQTTHandler::handleMessage(char* topic, byte* payload, unsigned int length) {
  _receiveCount++;
  
  DEBUG_PRINT("MQTT message received on topic: ");
  DEBUG_PRINTLN(topic);
  
  // Convert payload to string
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  DEBUG_PRINT("Payload: ");
  DEBUG_PRINTLN(message);
  
  // Parse JSON
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    DEBUG_PRINT("✗ JSON parse error: ");
    DEBUG_PRINTLN(error.c_str());
    return;
  }
  
  // Extract command
  const char* command = doc["command"];
  if (command != nullptr && _commandCallback != nullptr) {
    _commandCallback(command, doc);
  }
}
