/**
 * @file SlotManager.h
 * @brief Parking slot allocation and tracking system
 * @details Manages 10 parking slots with card assignment tracking
 */

#ifndef SLOTMANAGER_H
#define SLOTMANAGER_H

#include <Arduino.h>
#include "../Config.h"

/**
 * @struct ParkingSlot
 * @brief Structure to hold parking slot information
 */
struct ParkingSlot {
  bool occupied;                ///< Occupation status
  char cardUID[20];            ///< UID of card assigned to this slot
  unsigned long entryTime;      ///< Entry timestamp
  int slotNumber;              ///< Slot identifier (1-based)
};

/**
 * @class SlotManager
 * @brief Manages parking slot allocation and tracking
 * 
 * Example usage:
 * @code
 * SlotManager slotMgr;
 * slotMgr.begin();
 * int slot = slotMgr.allocateSlot("0A1B2C3D");
 * unsigned long duration = slotMgr.releaseSlot(slot);
 * @endcode
 */
class SlotManager {
public:
  /**
   * @brief Constructor
   */
  SlotManager();

  /**
   * @brief Initialize slot manager
   * @return true if successful
   */
  bool begin();

  /**
   * @brief Allocate a parking slot to a card
   * @param cardUID Card UID to assign
   * @param entryTime Entry timestamp (0 = use current time)
   * @return Slot number (1-based), or -1 if no slots available
   */
  int allocateSlot(const String& cardUID, unsigned long entryTime = 0);

  /**
   * @brief Release a parking slot by slot number
   * @param slotNumber Slot number to release (1-based)
   * @return Duration in seconds, or 0 if slot was not occupied
   */
  unsigned long releaseSlot(int slotNumber);

  /**
   * @brief Release a parking slot by card UID
   * @param cardUID Card UID to find and release
   * @param slotNumber Output parameter for released slot number
   * @return Duration in seconds, or 0 if card not found
   */
  unsigned long releaseSlotByCard(const String& cardUID, int& slotNumber);

  /**
   * @brief Find slot number assigned to a card
   * @param cardUID Card UID to search for
   * @return Slot number (1-based), or -1 if not found
   */
  int findSlotByCard(const String& cardUID) const;

  /**
   * @brief Check if a slot is occupied
   * @param slotNumber Slot number to check (1-based)
   * @return true if occupied, false otherwise
   */
  bool isSlotOccupied(int slotNumber) const;

  /**
   * @brief Get number of available slots
   * @return Number of free slots
   */
  int getAvailableSlots() const;

  /**
   * @brief Get total number of slots
   * @return Total slots
   */
  int getTotalSlots() const;

  /**
   * @brief Get slot information
   * @param slotNumber Slot number (1-based)
   * @param slot Output parameter for slot data
   * @return true if valid slot number, false otherwise
   */
  bool getSlotInfo(int slotNumber, ParkingSlot& slot) const;

  /**
   * @brief Get parking duration for a slot
   * @param slotNumber Slot number (1-based)
   * @param currentTime Current timestamp
   * @return Duration in seconds, or 0 if not occupied
   */
  unsigned long getSlotDuration(int slotNumber, unsigned long currentTime) const;

  /**
   * @brief Clear all slots (for testing/reset)
   */
  void clearAllSlots();

  /**
   * @brief Get array of all slots (for status reporting)
   * @param slots Output array (must be size TOTAL_SLOTS)
   * @param maxSlots Maximum slots to copy
   * @return Number of slots copied
   */
  int getAllSlots(ParkingSlot* slots, int maxSlots) const;

private:
  ParkingSlot _slots[TOTAL_SLOTS];  ///< Array of parking slots
  int _availableSlots;               ///< Count of available slots
  bool _initialized;                 ///< Initialization status

  /**
   * @brief Find first available slot
   * @return Slot index (0-based), or -1 if none available
   */
  int findAvailableSlot() const;

  /**
   * @brief Validate slot number
   * @param slotNumber Slot number (1-based)
   * @return true if valid (1-10), false otherwise
   */
  bool isValidSlotNumber(int slotNumber) const;

  /**
   * @brief Convert 1-based slot number to 0-based array index
   * @param slotNumber Slot number (1-based)
   * @return Array index (0-based)
   */
  int slotNumberToIndex(int slotNumber) const;
};

#endif // SLOTMANAGER_H
