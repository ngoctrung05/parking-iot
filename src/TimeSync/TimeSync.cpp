/**
 * @file TimeSync.cpp
 * @brief Implementation of NTP time synchronization manager
 */

#include "TimeSync.h"

TimeSync::TimeSync() : _synced(false), _bootTime(0) {
  _bootTime = millis() / 1000;
}

bool TimeSync::begin() {
  DEBUG_PRINTLN("Syncing time with NTP server...");
  
  // Configure NTP time
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  
  struct tm timeinfo;
  int attempts = 0;
  const int maxAttempts = 10;
  
  // Try to get time from NTP server
  while (!getLocalTime(&timeinfo) && attempts < maxAttempts) {
    delay(500);
    DEBUG_PRINT(".");
    attempts++;
  }
  
  if (attempts < maxAttempts) {
    _synced = true;
    DEBUG_PRINTLN("\n✓ Time synchronized with NTP");
    
    char buffer[64];
    strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
    DEBUG_PRINT("✓ Current time: ");
    DEBUG_PRINTLN(buffer);
    
    return true;
  } else {
    _synced = false;
    DEBUG_PRINTLN("\n✗ NTP sync failed, using millis() timestamps");
    return false;
  }
}

bool TimeSync::isSynced() const {
  return _synced;
}

unsigned long TimeSync::getTimestamp() const {
  if (_synced) {
    time_t now;
    time(&now);
    return (unsigned long)now;
  } else {
    // Fallback: return seconds since boot
    return millis() / 1000;
  }
}

bool TimeSync::getFormattedTime(char* buffer, size_t bufferSize, 
                                 const char* format) const {
  if (!_synced || buffer == nullptr || bufferSize == 0) {
    return false;
  }
  
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return false;
  }
  
  strftime(buffer, bufferSize, format, &timeinfo);
  return true;
}

bool TimeSync::resync() {
  return begin();
}

unsigned long TimeSync::getUptime() const {
  return millis() / 1000;
}
