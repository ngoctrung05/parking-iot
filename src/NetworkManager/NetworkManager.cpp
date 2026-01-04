/**
 * @file NetworkManager.cpp
 * @brief Implementation of WiFi network management
 */

#include "NetworkManager.h"

NetworkManager::NetworkManager() 
  : _ssid(WIFI_SSID),
    _password(WIFI_PASSWORD),
    _autoReconnect(true),
    _lastCheckTime(0),
    _connectionTime(0),
    _reconnectCount(0),
    _wasConnected(false) {
}

bool NetworkManager::begin(const char* ssid, const char* password, 
                          unsigned long timeout) {
  // Use provided credentials or defaults from Config.h
  if (ssid != nullptr) {
    _ssid = String(ssid);
  }
  if (password != nullptr) {
    _password = String(password);
  }
  
  DEBUG_PRINT("Connecting to WiFi: ");
  DEBUG_PRINTLN(_ssid);
  
  WiFi.mode(WIFI_STA);
  
  return connect(timeout);
}

bool NetworkManager::isConnected() const {
  return (WiFi.status() == WL_CONNECTED);
}

int NetworkManager::getRSSI() const {
  if (!isConnected()) {
    return 0;
  }
  return WiFi.RSSI();
}

String NetworkManager::getIPAddress() const {
  if (!isConnected()) {
    return "0.0.0.0";
  }
  return WiFi.localIP().toString();
}

String NetworkManager::getMACAddress() const {
  return WiFi.macAddress();
}

String NetworkManager::getSSID() const {
  if (!isConnected()) {
    return "";
  }
  return WiFi.SSID();
}

void NetworkManager::disconnect() {
  WiFi.disconnect();
  DEBUG_PRINTLN("WiFi disconnected");
}

bool NetworkManager::reconnect(unsigned long timeout) {
  DEBUG_PRINTLN("Attempting WiFi reconnection...");
  
  disconnect();
  delay(100);
  
  bool success = connect(timeout);
  
  if (success) {
    _reconnectCount++;
  }
  
  return success;
}

void NetworkManager::update() {
  unsigned long currentTime = millis();
  
  // Check connection status periodically
  if (currentTime - _lastCheckTime >= WIFI_CHECK_INTERVAL) {
    _lastCheckTime = currentTime;
    
    bool currentlyConnected = isConnected();
    
    // Connection lost
    if (_wasConnected && !currentlyConnected) {
      DEBUG_PRINTLN("⚠ WiFi connection lost");
      
      if (_autoReconnect) {
        reconnect(10000);
      }
    }
    
    // Connection established
    if (!_wasConnected && currentlyConnected) {
      DEBUG_PRINTLN("✓ WiFi connection established");
      _connectionTime = currentTime;
    }
    
    _wasConnected = currentlyConnected;
  }
}

void NetworkManager::setAutoReconnect(bool enable) {
  _autoReconnect = enable;
  DEBUG_PRINTF("Auto-reconnect %s\n", enable ? "enabled" : "disabled");
}

bool NetworkManager::isAutoReconnectEnabled() const {
  return _autoReconnect;
}

unsigned long NetworkManager::getConnectionUptime() const {
  if (!isConnected() || _connectionTime == 0) {
    return 0;
  }
  return (millis() - _connectionTime) / 1000;
}

int NetworkManager::getReconnectCount() const {
  return _reconnectCount;
}

bool NetworkManager::connect(unsigned long timeout) {
  WiFi.begin(_ssid.c_str(), _password.c_str());
  
  unsigned long startTime = millis();
  int attempts = 0;
  
  while (WiFi.status() != WL_CONNECTED && 
         (millis() - startTime) < timeout) {
    delay(500);
    DEBUG_PRINT(".");
    attempts++;
    
    // Give up after reasonable attempts
    if (attempts > timeout / 500) {
      break;
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    DEBUG_PRINTLN();
    DEBUG_PRINTLN("✓ WiFi connected");
    DEBUG_PRINT("✓ IP Address: ");
    DEBUG_PRINTLN(WiFi.localIP());
    DEBUG_PRINT("✓ RSSI: ");
    DEBUG_PRINT(WiFi.RSSI());
    DEBUG_PRINTLN(" dBm");
    
    _connectionTime = millis();
    _wasConnected = true;
    
    return true;
  } else {
    DEBUG_PRINTLN();
    DEBUG_PRINTLN("✗ WiFi connection failed");
    DEBUG_PRINT("✗ Status: ");
    DEBUG_PRINTLN(WiFi.status());
    
    return false;
  }
}
