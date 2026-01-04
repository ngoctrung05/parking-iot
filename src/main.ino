/**
 * @file main.ino
 * @brief Main orchestration file for IoT Parking Barrier System
 * @details Coordinates all modules: RFID, gates, slots, network, MQTT, display
 * @author Enhanced Modular Version - December 2025
 */

#include <Arduino.h>
#include "Config.h"
#include "TimeSync/TimeSync.h"
#include "LCDDisplay/LCDDisplay.h"
#include "RFIDManager/RFIDManager.h"
#include "SlotManager/SlotManager.h"
#include "NetworkManager/NetworkManager.h"
#include "MQTTHandler/MQTTHandler.h"
#include "GateController/GateController.h"

// ==================== GLOBAL MODULE INSTANCES ====================

TimeSync timeSync;
LCDDisplay lcd;
RFIDManager rfidManager;
SlotManager slotManager;
NetworkManager networkManager;
MQTTHandler mqttHandler;

// Gate controllers
GateController entranceGate("ENTRANCE", IR_IN_PIN, SERVO_IN_PIN);
GateController exitGate("EXIT", IR_OUT_PIN, SERVO_OUT_PIN);

// ==================== GLOBAL STATE ====================

bool emergencyMode = false;
bool scanModeActive = false;
unsigned long scanModeStartTime = 0;
String scanModeGate = "entrance";
unsigned long lastStatusUpdate = 0;
String lastScannedCardEntrance = "";
String lastScannedCardExit = "";

// ==================== FORWARD DECLARATIONS ====================

void handleEntranceGateEvent(const GateEventData& eventData);
void handleExitGateEvent(const GateEventData& eventData);
void handleMQTTCommand(const char* command, JsonDocument& doc);
void processScanMode();
void updateDisplay();
void sendPeriodicStatusUpdate();

// ==================== SETUP FUNCTION ====================

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  
  Serial.println("\n\n========================================");
  Serial.println("IoT Parking System - Modular Version");
  Serial.println("========================================");
  
  // Initialize LCD display
  lcd.begin();
  lcd.showMessage(MSG_SYSTEM_INIT, "Please wait");
  delay(1000);
  
  // Initialize slot manager
  slotManager.begin();
  
  // Initialize RFID manager
  rfidManager.begin();
  
  // Initialize gate controllers
  entranceGate.begin();
  exitGate.begin();
  
  // Set gate event callbacks
  entranceGate.setEventCallback(handleEntranceGateEvent);
  exitGate.setEventCallback(handleExitGateEvent);
  
  // Connect to WiFi
  lcd.showMessage(MSG_WIFI_CONNECT, WIFI_SSID);
  if (networkManager.begin()) {
    lcd.showMessage(MSG_WIFI_CONNECTED, networkManager.getIPAddress());
    delay(2000);
  } else {
    lcd.showMessage(MSG_WIFI_FAILED, "Check config");
    delay(3000);
  }
  
  // Sync time with NTP
  timeSync.begin();
  
  // Connect to MQTT broker
  if (mqttHandler.begin()) {
    mqttHandler.setCommandCallback(handleMQTTCommand);
  }
  
  // Display ready status
  updateDisplay();
  
  Serial.println("========================================");
  Serial.println("✓ System Ready!");
  Serial.printf("✓ Authorized Cards: %d\n", rfidManager.getCardCount());
  Serial.printf("✓ Available Slots: %d/%d\n", 
                slotManager.getAvailableSlots(), 
                slotManager.getTotalSlots());
  Serial.println("========================================\n");
}

// ==================== MAIN LOOP ====================

void loop() {
  // Update network connection
  networkManager.update();
  
  // Update MQTT client
  mqttHandler.update();
  
  // Process scan mode if active
  if (scanModeActive) {
    processScanMode();
  } else {
    // Normal operation: Read RFID cards and handle gate logic
    processEntranceGate();
    processExitGate();
  }
  
  // Update gate state machines
  entranceGate.update();
  exitGate.update();
  
  // Send periodic status updates
  sendPeriodicStatusUpdate();
}

// ==================== ENTRANCE GATE PROCESSING ====================

void processEntranceGate() {
  // Read RFID card at entrance
  String cardUID = rfidManager.readCard(RFIDManager::GATE_ENTRANCE);
  
  // Check if new card detected (avoid duplicate scans)
  if (!cardUID.isEmpty() && !cardUID.equals(lastScannedCardEntrance)) {
    lastScannedCardEntrance = cardUID;
    
    // Check authorization
    int accessLevel;
    bool authorized = rfidManager.isAuthorized(cardUID, accessLevel);
    
    // Check if parking is full
    bool parkingFull = (slotManager.getAvailableSlots() == 0);
    
    // Allocate slot if authorized and space available
    int slotNumber = -1;
    if (authorized && !parkingFull) {
      slotNumber = slotManager.allocateSlot(cardUID, timeSync.getTimestamp());
    }
    
    // Send to gate controller
    entranceGate.handleCardScanned(cardUID, authorized, slotNumber, parkingFull);
  }
  
  // Clear last scanned card when vehicle leaves
  if (!entranceGate.isVehicleDetected() && !lastScannedCardEntrance.isEmpty()) {
    lastScannedCardEntrance = "";
  }
}

// ==================== EXIT GATE PROCESSING ====================

void processExitGate() {
  // Read RFID card at exit
  String cardUID = rfidManager.readCard(RFIDManager::GATE_EXIT);
  
  // Check if new card detected (avoid duplicate scans)
  if (!cardUID.isEmpty() && !cardUID.equals(lastScannedCardExit)) {
    lastScannedCardExit = cardUID;
    
    // Check authorization
    int accessLevel;
    bool authorized = rfidManager.isAuthorized(cardUID, accessLevel);
    
    // Find and release slot
    int slotNumber = -1;
    if (authorized) {
      slotNumber = slotManager.findSlotByCard(cardUID);
      
      // If slot found, it will be released in the event handler
      // If not found, still allow exit (manual override or system restart)
      if (slotNumber == -1) {
        slotNumber = 0;  // Indicate no slot record
      }
    }
    
    // Send to gate controller
    exitGate.handleCardScanned(cardUID, authorized, slotNumber, false);
  }
  
  // Clear last scanned card when vehicle leaves
  if (!exitGate.isVehicleDetected() && !lastScannedCardExit.isEmpty()) {
    lastScannedCardExit = "";
  }
}

// ==================== ENTRANCE GATE EVENT HANDLER ====================

void handleEntranceGateEvent(const GateEventData& eventData) {
  switch (eventData.event) {
    case EVENT_VEHICLE_DETECTED:
      lcd.displayGateStatus("IN", MSG_SCAN_CARD, 0);
      break;
      
    case EVENT_VEHICLE_LEFT:
      lcd.displayGateStatus("IN", "Ready", 0);
      break;
      
    case EVENT_CARD_SCANNED:
      // Access granted
      lcd.displayGateStatus("IN", "Open S" + String(eventData.slotNumber), 0);
      
      // Publish MQTT event
      mqttHandler.publishEntry(
        eventData.cardUID,
        eventData.slotNumber,
        "success",
        slotManager.getAvailableSlots(),
        timeSync.getTimestamp()
      );
      break;
      
    case EVENT_CARD_DENIED:
      lcd.displayGateStatus("IN", "Denied", 0);
      
      // Publish MQTT event
      mqttHandler.publishEntry(
        eventData.cardUID,
        0,
        "denied_unauthorized",
        slotManager.getAvailableSlots(),
        timeSync.getTimestamp()
      );
      break;
      
    case EVENT_PARKING_FULL:
      lcd.displayGateStatus("IN", "Full", 0);
      
      // Publish MQTT event
      mqttHandler.publishEntry(
        eventData.cardUID,
        0,
        "denied_full",
        slotManager.getAvailableSlots(),
        timeSync.getTimestamp()
      );
      break;
      
    case EVENT_VEHICLE_PASSED:
      updateDisplay();
      break;
      
    default:
      break;
  }
}

// ==================== EXIT GATE EVENT HANDLER ====================

void handleExitGateEvent(const GateEventData& eventData) {
  switch (eventData.event) {
    case EVENT_VEHICLE_DETECTED:
      lcd.displayGateStatus("OUT", MSG_SCAN_CARD, 1);
      break;
      
    case EVENT_VEHICLE_LEFT:
      lcd.displayGateStatus("OUT", "Ready", 1);
      break;
      
    case EVENT_CARD_SCANNED:
      {
        // Release slot and calculate duration
        int slotNumber = eventData.slotNumber;
        unsigned long duration = 0;
        
        if (slotNumber > 0) {
          duration = slotManager.releaseSlot(slotNumber);
          lcd.displayGateStatus("OUT", "Open S" + String(slotNumber), 1);
        } else {
          lcd.displayGateStatus("OUT", "Open", 1);
        }
        
        // Publish MQTT event
        mqttHandler.publishExit(
          eventData.cardUID,
          slotNumber,
          (slotNumber > 0) ? "success" : "success_no_slot",
          duration,
          slotManager.getAvailableSlots(),
          timeSync.getTimestamp()
        );
      }
      break;
      
    case EVENT_CARD_DENIED:
      lcd.displayGateStatus("OUT", "Denied", 1);
      
      // Publish MQTT event
      mqttHandler.publishExit(
        eventData.cardUID,
        0,
        "denied_unauthorized",
        0,
        slotManager.getAvailableSlots(),
        timeSync.getTimestamp()
      );
      break;
      
    case EVENT_VEHICLE_PASSED:
      updateDisplay();
      break;
      
    default:
      break;
  }
}

// ==================== MQTT COMMAND HANDLER ====================

void handleMQTTCommand(const char* command, JsonDocument& doc) {
  DEBUG_PRINTF("Processing MQTT command: %s\n", command);
  
  if (strcmp(command, "open_barrier") == 0) {
    const char* gate = doc["gate"];
    
    if (strcmp(gate, "entrance") == 0) {
      entranceGate.openGate(5000);
      lcd.displayGateStatus("IN", "Manual Open", 0);
      delay(5000);
      entranceGate.closeGate();
      updateDisplay();
      
    } else if (strcmp(gate, "exit") == 0) {
      exitGate.openGate(5000);
      lcd.displayGateStatus("OUT", "Manual Open", 1);
      delay(5000);
      exitGate.closeGate();
      updateDisplay();
    }
    
  } else if (strcmp(command, "emergency") == 0) {
    bool enable = doc["enable"];
    emergencyMode = enable;
    
    if (emergencyMode) {
      DEBUG_PRINTLN("🚨 EMERGENCY MODE ACTIVATED");
      entranceGate.openGate();
      exitGate.openGate();
      lcd.showMessage(MSG_EMERGENCY_MODE, "All gates open");
    } else {
      DEBUG_PRINTLN("✓ Emergency mode deactivated");
      entranceGate.closeGate();
      exitGate.closeGate();
      updateDisplay();
    }
    
  } else if (strcmp(command, "update_whitelist") == 0) {
    // Reload RFID cards from EEPROM
    DEBUG_PRINTLN("Whitelist update requested");
    rfidManager.loadFromEEPROM();
    
  } else if (strcmp(command, "sync_whitelist") == 0) {
    // Synchronize whitelist from backend
    DEBUG_PRINTLN("🔄 Syncing whitelist from backend...");
    
    // Clear existing cards
    rfidManager.clearAllCards();
    
    // Parse cards array from JSON
    JsonArray cardsArray = doc["cards"].as<JsonArray>();
    int successCount = 0;
    int failCount = 0;
    
    for (JsonObject cardObj : cardsArray) {
      const char* uid = cardObj["card_uid"];
      const char* ownerName = cardObj["owner_name"] | "Unknown";
      int accessLevel = cardObj["access_level"] | 0;
      bool isActive = cardObj["is_active"] | true;
      
      // Only add active cards
      if (isActive && uid != nullptr) {
        if (rfidManager.addCard(uid, ownerName, accessLevel)) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }
    
    DEBUG_PRINTF("✓ Whitelist sync complete: %d added, %d failed\n", successCount, failCount);
    lcd.showMessage("Whitelist Synced", String(successCount) + " cards added");
    delay(2000);
    updateDisplay();
    
  } else if (strcmp(command, "get_status") == 0) {
    sendStatusUpdate();
    
  } else if (strcmp(command, "scan_mode") == 0) {
    // Card scan mode for enrollment
    bool enable = doc["enable"].as<bool>();
    const char* gate = doc["gate"] | "entrance";
    
    DEBUG_PRINT("📋 Scan mode command received - enable: ");
    DEBUG_PRINT(enable);
    DEBUG_PRINT(", gate: ");
    DEBUG_PRINTLN(gate);
    
    if (enable) {
      scanModeActive = true;
      scanModeStartTime = millis();
      scanModeGate = String(gate);
      
      DEBUG_PRINTLN("🔍 Scan mode ACTIVATED - waiting for card...");
      lcd.showMessage("SCAN MODE", "Tap card now...");
      
    } else {
      scanModeActive = false;
      DEBUG_PRINTLN("✓ Scan mode deactivated");
      updateDisplay();
    }
    
  } else if (strcmp(command, "reset_slots") == 0) {
    // Clear all slots (for testing)
    slotManager.clearAllSlots();
    DEBUG_PRINTLN("All slots cleared");
    updateDisplay();
  }
}

// ==================== DISPLAY UPDATE ====================

void updateDisplay() {
  int availableSlots = slotManager.getAvailableSlots();
  int totalSlots = slotManager.getTotalSlots();
  
  lcd.displayGateStatus("IN", "Ready", 0);
  lcd.displaySlotStatus(availableSlots, totalSlots, 1);
}

// ==================== STATUS UPDATE ====================

void sendPeriodicStatusUpdate() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
    lastStatusUpdate = currentTime;
    sendStatusUpdate();
  }
}

// ==================== SCAN MODE PROCESSING ====================

void processScanMode() {
  // Auto-timeout after 30 seconds
  if (millis() - scanModeStartTime > 30000) {
    scanModeActive = false;
    DEBUG_PRINTLN("⏱ Scan mode timeout");
    updateDisplay();
    return;
  }
  
  // Determine which gate to read from
  RFIDManager::GateType gate = (scanModeGate == "exit") ? 
                                 RFIDManager::GATE_EXIT : 
                                 RFIDManager::GATE_ENTRANCE;
  
  // Read card without authorization check
  String cardUID = rfidManager.readCard(gate);
  
  if (!cardUID.isEmpty()) {
    DEBUG_PRINT("📋 Card scanned in scan mode: ");
    DEBUG_PRINTLN(cardUID);
    
    // Publish scan event
    mqttHandler.publishScanEvent(cardUID, scanModeGate, timeSync.getTimestamp());
    
    // Show feedback on LCD
    lcd.showMessage("Card Scanned!", cardUID);
    delay(2000);
    
    // Deactivate scan mode
    scanModeActive = false;
    updateDisplay();
  }
}

void sendStatusUpdate() {
  if (!mqttHandler.isConnected()) {
    return;
  }
  
  mqttHandler.publishStatus(
    slotManager.getTotalSlots(),
    slotManager.getAvailableSlots(),
    rfidManager.getCardCount(),
    emergencyMode,
    networkManager.getRSSI(),
    timeSync.getUptime()
  );
}
