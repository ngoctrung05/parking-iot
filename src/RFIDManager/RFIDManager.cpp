/**
 * @file RFIDManager.cpp
 * @brief Implementation of RFID card management system
 */

#include "RFIDManager.h"

RFIDManager::RFIDManager() 
  : _rfidEntrance(RFID_IN_SS, RFID_IN_RST),
    _rfidExit(RFID_OUT_SS, RFID_OUT_RST),
    _numCards(0),
    _initialized(false) {
}

bool RFIDManager::begin() {
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  initializeEEPROM();
  
  // Initialize SPI bus (shared between two readers)
  SPI.begin();
  
  // Initialize RFID readers
  _rfidEntrance.PCD_Init();
  _rfidExit.PCD_Init();
  
  // Load whitelist from EEPROM
  bool loaded = loadFromEEPROM();
  
  _initialized = true;
  DEBUG_PRINTLN("✓ RFID Manager initialized");
  DEBUG_PRINTF("✓ Loaded %d authorized cards\n", _numCards);
  
  // Print card list
  for (int i = 0; i < _numCards; i++) {
    DEBUG_PRINTF("  Card %d: %s (%s) - Level %d - %s\n", 
                 i + 1, 
                 _authorizedCards[i].uid,
                 _authorizedCards[i].ownerName,
                 _authorizedCards[i].accessLevel,
                 _authorizedCards[i].isActive ? "Active" : "Inactive");
  }
  
  return loaded;
}

String RFIDManager::readCard(GateType gate) {
  MFRC522* reader = (gate == GATE_ENTRANCE) ? &_rfidEntrance : &_rfidExit;
  
  // Check for new card
  if (!reader->PICC_IsNewCardPresent() || !reader->PICC_ReadCardSerial()) {
    return "";
  }
  
  // Build UID string
  String uid = "";
  for (byte i = 0; i < reader->uid.size; i++) {
    if (reader->uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(reader->uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  
  // Halt card and stop encryption
  reader->PICC_HaltA();
  reader->PCD_StopCrypto1();
  
  return uid;
}

bool RFIDManager::isAuthorized(const String& uid, int& accessLevel) const {
  for (int i = 0; i < _numCards; i++) {
    if (uid.equals(_authorizedCards[i].uid) && _authorizedCards[i].isActive) {
      accessLevel = _authorizedCards[i].accessLevel;
      return true;
    }
  }
  return false;
}

bool RFIDManager::isAuthorized(const String& uid) const {
  int accessLevel;
  return isAuthorized(uid, accessLevel);
}

bool RFIDManager::addCard(const String& uid, const String& ownerName, 
                         int accessLevel) {
  // Check if card already exists
  if (findCardIndex(uid) != -1) {
    DEBUG_PRINTLN("Card already exists");
    return false;
  }
  
  // Check if whitelist is full
  if (_numCards >= MAX_RFID_CARDS) {
    DEBUG_PRINTLN("Whitelist is full");
    return false;
  }
  
  // Add new card
  uid.toCharArray(_authorizedCards[_numCards].uid, 20);
  ownerName.toCharArray(_authorizedCards[_numCards].ownerName, 32);
  _authorizedCards[_numCards].accessLevel = accessLevel;
  _authorizedCards[_numCards].isActive = true;
  
  _numCards++;
  
  DEBUG_PRINTF("✓ Added card: %s (%s)\n", uid.c_str(), ownerName.c_str());
  
  return saveToEEPROM();
}

bool RFIDManager::removeCard(const String& uid) {
  int index = findCardIndex(uid);
  if (index == -1) {
    return false;
  }
  
  // Shift remaining cards
  for (int i = index; i < _numCards - 1; i++) {
    _authorizedCards[i] = _authorizedCards[i + 1];
  }
  
  _numCards--;
  
  DEBUG_PRINTF("✓ Removed card: %s\n", uid.c_str());
  
  return saveToEEPROM();
}

bool RFIDManager::updateCard(const String& uid, const char* ownerName, 
                             int accessLevel) {
  int index = findCardIndex(uid);
  if (index == -1) {
    return false;
  }
  
  // Update owner name if provided
  if (ownerName != nullptr) {
    strncpy(_authorizedCards[index].ownerName, ownerName, 32);
    _authorizedCards[index].ownerName[31] = '\0';
  }
  
  // Update access level if valid
  if (accessLevel >= 0) {
    _authorizedCards[index].accessLevel = accessLevel;
  }
  
  DEBUG_PRINTF("✓ Updated card: %s\n", uid.c_str());
  
  return saveToEEPROM();
}

bool RFIDManager::getCardInfo(const String& uid, RFIDCard& card) const {
  int index = findCardIndex(uid);
  if (index == -1) {
    return false;
  }
  
  card = _authorizedCards[index];
  return true;
}

int RFIDManager::getCardCount() const {
  return _numCards;
}

bool RFIDManager::saveToEEPROM() {
  EEPROMData data;
  data.magic = EEPROM_MAGIC;
  data.numCards = _numCards;
  
  for (int i = 0; i < _numCards; i++) {
    data.cards[i] = _authorizedCards[i];
  }
  
  EEPROM.put(0, data);
  bool success = EEPROM.commit();
  
  if (success) {
    DEBUG_PRINTF("✓ Saved %d cards to EEPROM\n", _numCards);
  } else {
    DEBUG_PRINTLN("✗ EEPROM save failed");
  }
  
  return success;
}

bool RFIDManager::loadFromEEPROM() {
  EEPROMData data;
  EEPROM.get(0, data);
  
  // Validate magic number and card count
  if (data.magic == EEPROM_MAGIC && 
      data.numCards >= 0 && 
      data.numCards <= MAX_RFID_CARDS) {
    
    _numCards = data.numCards;
    for (int i = 0; i < _numCards; i++) {
      _authorizedCards[i] = data.cards[i];
    }
    
    DEBUG_PRINTF("✓ Loaded %d cards from EEPROM\n", _numCards);
    return true;
    
  } else {
    DEBUG_PRINTLN("✗ EEPROM data corrupted or not initialized");
    return false;
  }
}

void RFIDManager::resetToDefaults() {
  DEBUG_PRINTLN("Resetting RFID whitelist to defaults...");
  
  _numCards = DEFAULT_CARD_COUNT;
  
  // Card 1: Admin
  strcpy(_authorizedCards[0].uid, DEFAULT_CARD_1_UID);
  strcpy(_authorizedCards[0].ownerName, DEFAULT_CARD_1_NAME);
  _authorizedCards[0].accessLevel = DEFAULT_CARD_1_LEVEL;
  _authorizedCards[0].isActive = true;
  
  // Card 2: User1
  strcpy(_authorizedCards[1].uid, DEFAULT_CARD_2_UID);
  strcpy(_authorizedCards[1].ownerName, DEFAULT_CARD_2_NAME);
  _authorizedCards[1].accessLevel = DEFAULT_CARD_2_LEVEL;
  _authorizedCards[1].isActive = true;
  
  // Card 3: User2
  strcpy(_authorizedCards[2].uid, DEFAULT_CARD_3_UID);
  strcpy(_authorizedCards[2].ownerName, DEFAULT_CARD_3_NAME);
  _authorizedCards[2].accessLevel = DEFAULT_CARD_3_LEVEL;
  _authorizedCards[2].isActive = true;
  
  // Card 4: Your Card 1
  strcpy(_authorizedCards[3].uid, DEFAULT_CARD_4_UID);
  strcpy(_authorizedCards[3].ownerName, DEFAULT_CARD_4_NAME);
  _authorizedCards[3].accessLevel = DEFAULT_CARD_4_LEVEL;
  _authorizedCards[3].isActive = true;
  
  // Card 5: Your Card 2
  strcpy(_authorizedCards[4].uid, DEFAULT_CARD_5_UID);
  strcpy(_authorizedCards[4].ownerName, DEFAULT_CARD_5_NAME);
  _authorizedCards[4].accessLevel = DEFAULT_CARD_5_LEVEL;
  _authorizedCards[4].isActive = true;
  
  saveToEEPROM();
  
  DEBUG_PRINTLN("✓ Reset to default cards");
}

bool RFIDManager::clearAllCards() {
  DEBUG_PRINTLN("Clearing all cards from whitelist...");
  _numCards = 0;
  
  bool success = saveToEEPROM();
  if (success) {
    DEBUG_PRINTLN("✓ All cards cleared");
  } else {
    DEBUG_PRINTLN("✗ Failed to clear cards");
  }
  
  return success;
}

MFRC522* RFIDManager::getReader(GateType gate) {
  return (gate == GATE_ENTRANCE) ? &_rfidEntrance : &_rfidExit;
}

void RFIDManager::initializeEEPROM() {
  int magic;
  EEPROM.get(0, magic);
  
  if (magic != EEPROM_MAGIC) {
    DEBUG_PRINTLN("Initializing EEPROM with default cards...");
    resetToDefaults();
  } else {
    DEBUG_PRINTLN("✓ EEPROM already initialized");
  }
}

int RFIDManager::findCardIndex(const String& uid) const {
  for (int i = 0; i < _numCards; i++) {
    if (uid.equals(_authorizedCards[i].uid)) {
      return i;
    }
  }
  return -1;
}
