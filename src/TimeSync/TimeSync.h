/**
 * @file TimeSync.h
 * @brief NTP time synchronization manager for ESP32
 * @details Handles NTP server connection, time synchronization,
 *          and provides timestamp services
 */

#ifndef TIMESYNC_H
#define TIMESYNC_H

#include <Arduino.h>
#include <time.h>
#include "../Config.h"

/**
 * @class TimeSync
 * @brief Manages NTP time synchronization and timestamp generation
 * 
 * Example usage:
 * @code
 * TimeSync timeSync;
 * timeSync.begin();
 * unsigned long timestamp = timeSync.getTimestamp();
 * @endcode
 */
class TimeSync {
public:
  /**
   * @brief Constructor
   */
  TimeSync();

  /**
   * @brief Initialize NTP time synchronization
   * @return true if sync successful, false otherwise
   */
  bool begin();

  /**
   * @brief Check if NTP time has been synchronized
   * @return true if synced, false otherwise
   */
  bool isSynced() const;

  /**
   * @brief Get current Unix timestamp
   * @return Current Unix timestamp (seconds since 1970)
   */
  unsigned long getTimestamp() const;

  /**
   * @brief Get formatted date/time string
   * @param buffer Buffer to store formatted string
   * @param bufferSize Size of buffer
   * @param format strftime format string (default: "%Y-%m-%d %H:%M:%S")
   * @return true if successful, false otherwise
   */
  bool getFormattedTime(char* buffer, size_t bufferSize, 
                        const char* format = "%Y-%m-%d %H:%M:%S") const;

  /**
   * @brief Retry NTP synchronization
   * @return true if sync successful, false otherwise
   */
  bool resync();

  /**
   * @brief Get uptime in seconds since system boot
   * @return Uptime in seconds
   */
  unsigned long getUptime() const;

private:
  bool _synced;             ///< NTP synchronization status
  unsigned long _bootTime;  ///< System boot time for fallback timestamps
};

#endif // TIMESYNC_H
