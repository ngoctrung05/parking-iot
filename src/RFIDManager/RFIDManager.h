/**
 * @file RFIDManager.h
 * @brief RFID card management with EEPROM persistence
 * @details Handles RFID card reading, whitelist management,
 *          and EEPROM storage for persistent card database
 */

#ifndef RFIDMANAGER_H
#define RFIDMANAGER_H

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <EEPROM.h>
#include "../Config.h"

/**
 * @struct RFIDCard
 * @brief Structure to hold RFID card information
 */
struct RFIDCard {
  char uid[20];              ///< Card UID in hex string format
  bool isActive;             ///< Card activation status
  int accessLevel;           ///< Access level (0=regular, 1=admin, 2=temp)
  char ownerName[32];        ///< Owner name for identification
};

/**
 * @struct EEPROMData
 * @brief Structure for EEPROM storage format
 */
struct EEPROMData {
  int magic;                           ///< Magic number for validation
  int numCards;                        ///< Number of stored cards
  RFIDCard cards[MAX_RFID_CARDS];     ///< Card database array
};

/**
 * @class RFIDManager
 * @brief Manages RFID card operations and whitelist persistence
 * 
 * Example usage:
 * @code
 * RFIDManager rfidMgr;
 * rfidMgr.begin();
 * String uid = rfidMgr.readCard(RFIDManager::GATE_ENTRANCE);
 * if (rfidMgr.isAuthorized(uid)) {
 *   // Grant access
 * }
 * @endcode
 */
class RFIDManager {
public:
  /**
   * @enum GateType
   * @brief Gate identifier for RFID readers
   */
  enum GateType {
    GATE_ENTRANCE,    ///< Entrance gate RFID reader
    GATE_EXIT         ///< Exit gate RFID reader
  };

  /**
   * @brief Constructor
   */
  RFIDManager();

  /**
   * @brief Initialize RFID readers and load whitelist from EEPROM
   * @return true if successful, false otherwise
   */
  bool begin();

  /**
   * @brief Read RFID card from specified gate
   * @param gate Gate to read from (GATE_ENTRANCE or GATE_EXIT)
   * @return Card UID as hex string, empty string if no card detected
   */
  String readCard(GateType gate);

  /**
   * @brief Check if card UID is authorized
   * @param uid Card UID to check
   * @param accessLevel Output parameter for access level
   * @return true if authorized, false otherwise
   */
  bool isAuthorized(const String& uid, int& accessLevel) const;

  /**
   * @brief Check if card is authorized (without access level)
   * @param uid Card UID to check
   * @return true if authorized, false otherwise
   */
  bool isAuthorized(const String& uid) const;

  /**
   * @brief Add new card to whitelist
   * @param uid Card UID
   * @param ownerName Owner name
   * @param accessLevel Access level
   * @return true if added successfully, false if full
   */
  bool addCard(const String& uid, const String& ownerName, int accessLevel);

  /**
   * @brief Remove card from whitelist
   * @param uid Card UID to remove
   * @return true if removed, false if not found
   */
  bool removeCard(const String& uid);

  /**
   * @brief Update card information
   * @param uid Card UID
   * @param ownerName New owner name (nullptr to keep unchanged)
   * @param accessLevel New access level (-1 to keep unchanged)
   * @return true if updated, false if not found
   */
  bool updateCard(const String& uid, const char* ownerName = nullptr, 
                  int accessLevel = -1);

  /**
   * @brief Get card information
   * @param uid Card UID
   * @param card Output parameter for card data
   * @return true if found, false otherwise
   */
  bool getCardInfo(const String& uid, RFIDCard& card) const;

  /**
   * @brief Get number of authorized cards
   * @return Number of cards in whitelist
   */
  int getCardCount() const;

  /**
   * @brief Save current whitelist to EEPROM
   * @return true if saved successfully
   */
  bool saveToEEPROM();

  /**
   * @brief Load whitelist from EEPROM
   * @return true if loaded successfully
   */
  bool loadFromEEPROM();

  /**
   * @brief Reset EEPROM to default cards
   */
  void resetToDefaults();

  /**
   * @brief Clear all cards from whitelist
   * @return true if cleared successfully
   */
  bool clearAllCards();

  /**
   * @brief Get RFID reader object (for advanced operations)
   * @param gate Gate to get reader for
   * @return Pointer to MFRC522 object
   */
  MFRC522* getReader(GateType gate);

private:
  MFRC522 _rfidEntrance;              ///< Entrance RFID reader
  MFRC522 _rfidExit;                  ///< Exit RFID reader
  RFIDCard _authorizedCards[MAX_RFID_CARDS];  ///< Card whitelist
  int _numCards;                      ///< Current number of cards
  bool _initialized;                  ///< Initialization status

  /**
   * @brief Initialize EEPROM with default cards if needed
   */
  void initializeEEPROM();

  /**
   * @brief Find card index in whitelist
   * @param uid Card UID to find
   * @return Index if found, -1 otherwise
   */
  int findCardIndex(const String& uid) const;
};

#endif // RFIDMANAGER_H
