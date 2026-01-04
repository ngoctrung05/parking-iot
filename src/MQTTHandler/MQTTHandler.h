/**
 * @file MQTTHandler.h
 * @brief MQTT client with JSON message handling
 * @details Manages MQTT connection, publishes events, subscribes to commands
 */

#ifndef MQTTHANDLER_H
#define MQTTHANDLER_H

#include <Arduino.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <WiFiClientSecure.h>
#include "../Config.h"

// Forward declarations for callback
class MQTTHandler;
typedef void (*MQTTCommandCallback)(const char* command, JsonDocument& doc);

/**
 * @class MQTTHandler
 * @brief Manages MQTT communication and JSON message handling
 * 
 * Example usage:
 * @code
 * MQTTHandler mqtt;
 * mqtt.begin();
 * mqtt.publishEntry("0A1B2C3D", 5, "success");
 * mqtt.setCommandCallback(myCommandHandler);
 * @endcode
 */
class MQTTHandler {
public:
  /**
   * @brief Constructor
   */
  MQTTHandler();

  /**
   * @brief Initialize MQTT client
   * @param server MQTT broker address (nullptr = use Config.h default)
   * @param port MQTT broker port (0 = use Config.h default)
   * @return true if connected, false otherwise
   */
  bool begin(const char* server = nullptr, int port = 0);

  /**
   * @brief Check if MQTT is connected
   * @return true if connected, false otherwise
   */
  bool isConnected();

  /**
   * @brief Update MQTT client (call in loop)
   * @details Handles reconnection and processes incoming messages
   */
  void update();

  /**
   * @brief Attempt to reconnect to MQTT broker
   * @return true if connected, false otherwise
   */
  bool reconnect();

  /**
   * @brief Publish entry event
   * @param cardUID Card UID
   * @param slotId Slot number
   * @param status Status message ("success", "denied_full", etc.)
   * @param availableSlots Number of available slots
   * @param timestamp Unix timestamp
   * @return true if published successfully
   */
  bool publishEntry(const String& cardUID, int slotId, const String& status,
                   int availableSlots, unsigned long timestamp);

  /**
   * @brief Publish exit event
   * @param cardUID Card UID
   * @param slotId Slot number
   * @param status Status message
   * @param duration Parking duration in seconds
   * @param availableSlots Number of available slots
   * @param timestamp Unix timestamp
   * @return true if published successfully
   */
  bool publishExit(const String& cardUID, int slotId, const String& status,
                  unsigned long duration, int availableSlots, 
                  unsigned long timestamp);

  /**
   * @brief Publish system status update
   * @param totalSlots Total number of slots
   * @param availableSlots Number of available slots
   * @param authorizedCards Number of authorized cards
   * @param emergencyMode Emergency mode status
   * @param rssi WiFi RSSI
   * @param uptime System uptime in seconds
   * @return true if published successfully
   */
  bool publishStatus(int totalSlots, int availableSlots, int authorizedCards,
                    bool emergencyMode, int rssi, unsigned long uptime);

  /**
   * @brief Publish card scan event (scan mode)
   * @param cardUID Card UID that was scanned
   * @param gate Gate where card was scanned
   * @param timestamp Unix timestamp
   * @return true if published successfully
   */
  bool publishScanEvent(const String& cardUID, const String& gate, 
                       unsigned long timestamp);

  /**
   * @brief Publish custom JSON message
   * @param topic MQTT topic
   * @param doc JSON document to publish
   * @return true if published successfully
   */
  bool publishJSON(const char* topic, JsonDocument& doc);

  /**
   * @brief Set command callback function
   * @param callback Function to call when command received
   */
  void setCommandCallback(MQTTCommandCallback callback);

  /**
   * @brief Subscribe to additional topic
   * @param topic Topic to subscribe to
   * @return true if subscribed successfully
   */
  bool subscribe(const char* topic);

  /**
   * @brief Get MQTT client state
   * @return Client state code
   */
  int getState();

  /**
   * @brief Get number of messages published
   * @return Message count
   */
  unsigned long getPublishCount() const;

  /**
   * @brief Get number of messages received
   * @return Message count
   */
  unsigned long getReceiveCount() const;

private:
  WiFiClientSecure _wifiClient;     ///< Secure WiFi client for MQTT (TLS/SSL)
  PubSubClient _mqttClient;         ///< MQTT client instance
  String _server;                   ///< MQTT broker address
  int _port;                        ///< MQTT broker port
  String _clientId;                 ///< MQTT client ID
  MQTTCommandCallback _commandCallback;  ///< Command callback function
  unsigned long _lastReconnectAttempt;   ///< Last reconnect attempt time
  unsigned long _publishCount;      ///< Number of published messages
  unsigned long _receiveCount;      ///< Number of received messages

  /**
   * @brief Generate unique client ID
   * @return Client ID string
   */
  String generateClientId();

  /**
   * @brief Static callback wrapper for MQTT messages
   * @param topic Topic of received message
   * @param payload Message payload
   * @param length Payload length
   */
  static void mqttCallback(char* topic, byte* payload, unsigned int length);

  /**
   * @brief Handle incoming MQTT message
   * @param topic Topic of received message
   * @param payload Message payload
   * @param length Payload length
   */
  void handleMessage(char* topic, byte* payload, unsigned int length);

  // Static instance pointer for callback
  static MQTTHandler* _instance;
};

#endif // MQTTHANDLER_H
