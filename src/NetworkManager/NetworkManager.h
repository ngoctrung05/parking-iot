/**
 * @file NetworkManager.h
 * @brief WiFi connection and network management
 * @details Handles WiFi connection, reconnection logic, and status monitoring
 */

#ifndef NETWORKMANAGER_H
#define NETWORKMANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "../Config.h"

/**
 * @class NetworkManager
 * @brief Manages WiFi connection and network status
 * 
 * Example usage:
 * @code
 * NetworkManager network;
 * network.begin();
 * if (network.isConnected()) {
 *   String ip = network.getIPAddress();
 * }
 * @endcode
 */
class NetworkManager {
public:
  /**
   * @brief Constructor
   */
  NetworkManager();

  /**
   * @brief Initialize and connect to WiFi
   * @param ssid WiFi SSID (nullptr = use Config.h default)
   * @param password WiFi password (nullptr = use Config.h default)
   * @param timeout Connection timeout in milliseconds
   * @return true if connected, false otherwise
   */
  bool begin(const char* ssid = nullptr, 
             const char* password = nullptr,
             unsigned long timeout = 15000);

  /**
   * @brief Check if WiFi is connected
   * @return true if connected, false otherwise
   */
  bool isConnected() const;

  /**
   * @brief Get current WiFi RSSI (signal strength)
   * @return RSSI in dBm
   */
  int getRSSI() const;

  /**
   * @brief Get local IP address as string
   * @return IP address string (e.g., "192.168.1.100")
   */
  String getIPAddress() const;

  /**
   * @brief Get MAC address
   * @return MAC address string
   */
  String getMACAddress() const;

  /**
   * @brief Get WiFi SSID
   * @return SSID string
   */
  String getSSID() const;

  /**
   * @brief Disconnect from WiFi
   */
  void disconnect();

  /**
   * @brief Attempt to reconnect to WiFi
   * @param timeout Timeout in milliseconds
   * @return true if reconnected, false otherwise
   */
  bool reconnect(unsigned long timeout = 10000);

  /**
   * @brief Update network status (call periodically in loop)
   * @details Automatically reconnects if connection lost
   */
  void update();

  /**
   * @brief Set auto-reconnect behavior
   * @param enable true to enable auto-reconnect, false to disable
   */
  void setAutoReconnect(bool enable);

  /**
   * @brief Check if auto-reconnect is enabled
   * @return true if enabled, false otherwise
   */
  bool isAutoReconnectEnabled() const;

  /**
   * @brief Get uptime since last connection
   * @return Uptime in seconds
   */
  unsigned long getConnectionUptime() const;

  /**
   * @brief Get number of reconnection attempts
   * @return Reconnect count
   */
  int getReconnectCount() const;

private:
  String _ssid;                      ///< Stored SSID
  String _password;                  ///< Stored password
  bool _autoReconnect;               ///< Auto-reconnect enabled
  unsigned long _lastCheckTime;      ///< Last connection check time
  unsigned long _connectionTime;     ///< Time of last successful connection
  int _reconnectCount;               ///< Number of reconnection attempts
  bool _wasConnected;                ///< Previous connection state

  /**
   * @brief Connect to WiFi (internal)
   * @param timeout Timeout in milliseconds
   * @return true if connected, false otherwise
   */
  bool connect(unsigned long timeout);
};

#endif // NETWORKMANAGER_H
