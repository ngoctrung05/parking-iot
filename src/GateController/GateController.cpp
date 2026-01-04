/**
 * @file GateController.cpp
 * @brief Implementation of gate controller state machine
 */

#include "GateController.h"

GateController::GateController(const char* name, uint8_t irPin, uint8_t servoPin)
  : _name(name),
    _irPin(irPin),
    _servoPin(servoPin),
    _state(STATE_IDLE),
    _lastScannedCard(""),
    _stateStartTime(0),
    _eventCallback(nullptr),
    _vehicleWasDetected(false),
    _initialized(false) {
}

bool GateController::begin() {
  // Initialize IR sensor pin
  pinMode(_irPin, INPUT_PULLUP);
  
  // Initialize servo
  _servo.setPeriodHertz(SERVO_FREQ);
  _servo.attach(_servoPin, SERVO_MIN_PULSE, SERVO_MAX_PULSE);
  
  // Set initial closed position
  _servo.write(SERVO_CLOSED_ANGLE);
  
  _state = STATE_IDLE;
  _stateStartTime = millis();
  _initialized = true;
  
  DEBUG_PRINTF("✓ Gate controller '%s' initialized\n", _name.c_str());
  
  return true;
}

void GateController::update() {
  if (!_initialized) {
    return;
  }
  
  bool vehicleDetected = readIRSensor();
  
  switch (_state) {
    case STATE_IDLE:
      // Check for vehicle detection
      if (vehicleDetected && !_vehicleWasDetected) {
        DEBUG_PRINTF("→ %s: Vehicle detected\n", _name.c_str());
        setState(STATE_WAITING_CARD);
        
        GateEventData eventData;
        eventData.event = EVENT_VEHICLE_DETECTED;
        fireEvent(eventData);
      }
      break;
      
    case STATE_WAITING_CARD:
      // Check if vehicle left without scanning
      if (!vehicleDetected && _vehicleWasDetected) {
        DEBUG_PRINTF("← %s: Vehicle left without scanning\n", _name.c_str());
        setState(STATE_IDLE);
        
        GateEventData eventData;
        eventData.event = EVENT_VEHICLE_LEFT;
        fireEvent(eventData);
      }
      
      // Timeout after waiting too long
      if (getStateElapsedTime() > CARD_SCAN_TIMEOUT) {
        DEBUG_PRINTF("⏱ %s: Card scan timeout\n", _name.c_str());
        setState(STATE_IDLE);
        
        GateEventData eventData;
        eventData.event = EVENT_TIMEOUT;
        fireEvent(eventData);
      }
      break;
      
    case STATE_BARRIER_OPEN:
      // Check if vehicle has passed (IR sensor no longer detecting)
      if (!vehicleDetected && _vehicleWasDetected) {
        DEBUG_PRINTF("→ %s: Vehicle passed through\n", _name.c_str());
        setState(STATE_CLOSING_DELAY);
        
        GateEventData eventData;
        eventData.event = EVENT_VEHICLE_PASSED;
        fireEvent(eventData);
      }
      break;
      
    case STATE_CLOSING_DELAY:
      // Wait for delay period before closing
      if (getStateElapsedTime() >= GATE_CLOSE_DELAY) {
        DEBUG_PRINTF("← %s: Closing barrier\n", _name.c_str());
        closeGate();
        setState(STATE_IDLE);
      }
      break;
  }
  
  _vehicleWasDetected = vehicleDetected;
}

void GateController::handleCardScanned(const String& cardUID, bool authorized,
                                      int slotNumber, bool parkingFull) {
  if (_state != STATE_WAITING_CARD) {
    DEBUG_PRINTF("⚠ %s: Card scan ignored (not in WAITING_CARD state)\n", 
                 _name.c_str());
    return;
  }
  
  _lastScannedCard = cardUID;
  
  DEBUG_PRINTF("RFID scanned at %s: %s\n", _name.c_str(), cardUID.c_str());
  
  GateEventData eventData;
  eventData.cardUID = cardUID;
  eventData.slotNumber = slotNumber;
  
  if (!authorized) {
    // Unauthorized card
    DEBUG_PRINTF("✗ %s: Access denied - unauthorized card\n", _name.c_str());
    eventData.event = EVENT_CARD_DENIED;
    fireEvent(eventData);
    
    // Brief delay to show message, then return to idle
    delay(DISPLAY_MESSAGE_DURATION);
    setState(STATE_IDLE);
    
  } else if (parkingFull) {
    // Parking is full
    DEBUG_PRINTF("✗ %s: Access denied - parking full\n", _name.c_str());
    eventData.event = EVENT_PARKING_FULL;
    fireEvent(eventData);
    
    delay(DISPLAY_MESSAGE_DURATION);
    setState(STATE_IDLE);
    
  } else {
    // Access granted
    DEBUG_PRINTF("✓ %s: Access granted - Slot %d\n", _name.c_str(), slotNumber);
    eventData.event = EVENT_CARD_SCANNED;
    fireEvent(eventData);
    
    openGate();
  }
}

void GateController::openGate(unsigned long duration) {
  setServoAngle(SERVO_OPEN_ANGLE);
  setState(STATE_BARRIER_OPEN);
  
  DEBUG_PRINTF("✓ %s: Barrier opened\n", _name.c_str());
  
  // If duration specified, schedule auto-close
  if (duration > 0) {
    // This would require a timer implementation
    // For now, we rely on vehicle detection
  }
}

void GateController::closeGate() {
  setServoAngle(SERVO_CLOSED_ANGLE);
  DEBUG_PRINTF("✓ %s: Barrier closed\n", _name.c_str());
}

bool GateController::isOpen() const {
  return (_state == STATE_BARRIER_OPEN || _state == STATE_CLOSING_DELAY);
}

GateState GateController::getState() const {
  return _state;
}

void GateController::setEventCallback(GateEventCallback callback) {
  _eventCallback = callback;
  DEBUG_PRINTF("✓ %s: Event callback set\n", _name.c_str());
}

String GateController::getLastScannedCard() const {
  return _lastScannedCard;
}

void GateController::reset() {
  closeGate();
  setState(STATE_IDLE);
  _lastScannedCard = "";
  DEBUG_PRINTF("✓ %s: Reset to idle state\n", _name.c_str());
}

bool GateController::isVehicleDetected() const {
  return readIRSensor();
}

bool GateController::readIRSensor() const {
  // IR sensor is active LOW (LOW = vehicle detected)
  return (digitalRead(_irPin) == LOW);
}

void GateController::setServoAngle(int angle) {
  _servo.write(angle);
}

void GateController::setState(GateState newState) {
  _state = newState;
  _stateStartTime = millis();
}

void GateController::fireEvent(const GateEventData& eventData) {
  if (_eventCallback != nullptr) {
    _eventCallback(eventData);
  }
}

unsigned long GateController::getStateElapsedTime() const {
  return millis() - _stateStartTime;
}
