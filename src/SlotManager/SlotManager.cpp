/**
 * @file SlotManager.cpp
 * @brief Implementation of parking slot management system
 */

#include "SlotManager.h"

SlotManager::SlotManager() 
  : _availableSlots(TOTAL_SLOTS),
    _initialized(false) {
}

bool SlotManager::begin() {
  // Initialize all slots
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    _slots[i].occupied = false;
    _slots[i].cardUID[0] = '\0';
    _slots[i].entryTime = 0;
    _slots[i].slotNumber = i + 1;  // 1-based slot numbers
  }
  
  _availableSlots = TOTAL_SLOTS;
  _initialized = true;
  
  DEBUG_PRINTF("✓ Slot Manager initialized with %d slots\n", TOTAL_SLOTS);
  return true;
}

int SlotManager::allocateSlot(const String& cardUID, unsigned long entryTime) {
  if (!_initialized) {
    DEBUG_PRINTLN("✗ SlotManager not initialized");
    return -1;
  }
  
  // Check if card already has a slot
  int existingSlot = findSlotByCard(cardUID);
  if (existingSlot != -1) {
    DEBUG_PRINTF("⚠ Card %s already has slot %d\n", cardUID.c_str(), existingSlot);
    return existingSlot;
  }
  
  // Find available slot
  int slotIndex = findAvailableSlot();
  if (slotIndex == -1) {
    DEBUG_PRINTLN("✗ No available slots");
    return -1;
  }
  
  // Allocate slot
  _slots[slotIndex].occupied = true;
  cardUID.toCharArray(_slots[slotIndex].cardUID, 20);
  _slots[slotIndex].entryTime = (entryTime == 0) ? millis() / 1000 : entryTime;
  _availableSlots--;
  
  int slotNumber = _slots[slotIndex].slotNumber;
  DEBUG_PRINTF("✓ Allocated slot %d to card %s\n", slotNumber, cardUID.c_str());
  
  return slotNumber;
}

unsigned long SlotManager::releaseSlot(int slotNumber) {
  if (!_initialized || !isValidSlotNumber(slotNumber)) {
    return 0;
  }
  
  int index = slotNumberToIndex(slotNumber);
  
  if (!_slots[index].occupied) {
    DEBUG_PRINTF("⚠ Slot %d is not occupied\n", slotNumber);
    return 0;
  }
  
  // Calculate duration
  unsigned long duration = (millis() / 1000) - _slots[index].entryTime;
  
  // Release slot
  String cardUID = String(_slots[index].cardUID);
  _slots[index].occupied = false;
  _slots[index].cardUID[0] = '\0';
  _slots[index].entryTime = 0;
  _availableSlots++;
  
  DEBUG_PRINTF("✓ Released slot %d (card %s, duration %lus)\n", 
               slotNumber, cardUID.c_str(), duration);
  
  return duration;
}

unsigned long SlotManager::releaseSlotByCard(const String& cardUID, int& slotNumber) {
  slotNumber = findSlotByCard(cardUID);
  
  if (slotNumber == -1) {
    DEBUG_PRINTF("⚠ Card %s not found in any slot\n", cardUID.c_str());
    return 0;
  }
  
  return releaseSlot(slotNumber);
}

int SlotManager::findSlotByCard(const String& cardUID) const {
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    if (_slots[i].occupied && cardUID.equals(_slots[i].cardUID)) {
      return _slots[i].slotNumber;
    }
  }
  return -1;
}

bool SlotManager::isSlotOccupied(int slotNumber) const {
  if (!isValidSlotNumber(slotNumber)) {
    return false;
  }
  
  int index = slotNumberToIndex(slotNumber);
  return _slots[index].occupied;
}

int SlotManager::getAvailableSlots() const {
  return _availableSlots;
}

int SlotManager::getTotalSlots() const {
  return TOTAL_SLOTS;
}

bool SlotManager::getSlotInfo(int slotNumber, ParkingSlot& slot) const {
  if (!isValidSlotNumber(slotNumber)) {
    return false;
  }
  
  int index = slotNumberToIndex(slotNumber);
  slot = _slots[index];
  return true;
}

unsigned long SlotManager::getSlotDuration(int slotNumber, unsigned long currentTime) const {
  if (!isValidSlotNumber(slotNumber)) {
    return 0;
  }
  
  int index = slotNumberToIndex(slotNumber);
  
  if (!_slots[index].occupied) {
    return 0;
  }
  
  return currentTime - _slots[index].entryTime;
}

void SlotManager::clearAllSlots() {
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    _slots[i].occupied = false;
    _slots[i].cardUID[0] = '\0';
    _slots[i].entryTime = 0;
  }
  
  _availableSlots = TOTAL_SLOTS;
  DEBUG_PRINTLN("✓ All slots cleared");
}

int SlotManager::getAllSlots(ParkingSlot* slots, int maxSlots) const {
  int count = (maxSlots < TOTAL_SLOTS) ? maxSlots : TOTAL_SLOTS;
  
  for (int i = 0; i < count; i++) {
    slots[i] = _slots[i];
  }
  
  return count;
}

int SlotManager::findAvailableSlot() const {
  for (int i = 0; i < TOTAL_SLOTS; i++) {
    if (!_slots[i].occupied) {
      return i;
    }
  }
  return -1;
}

bool SlotManager::isValidSlotNumber(int slotNumber) const {
  return (slotNumber >= 1 && slotNumber <= TOTAL_SLOTS);
}

int SlotManager::slotNumberToIndex(int slotNumber) const {
  return slotNumber - 1;
}
