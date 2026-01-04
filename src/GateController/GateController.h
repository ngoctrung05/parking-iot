/**
 * @file GateController.h
 * @brief Gate controller with state machine logic
 * @details Manages entrance/exit gate with IR sensor, servo, and RFID
 */

#ifndef GATECONTROLLER_H
#define GATECONTROLLER_H

#include <Arduino.h>
#include <ESP32Servo.h>
#include "../Config.h"

/**
 * @enum GateEvent
 * @brief Events that can occur during gate operation
 */
enum GateEvent {
  EVENT_NONE,                ///< No event
  EVENT_VEHICLE_DETECTED,    ///< Vehicle detected by IR sensor
  EVENT_VEHICLE_LEFT,        ///< Vehicle left detection zone
  EVENT_CARD_SCANNED,        ///< Valid RFID card scanned
  EVENT_CARD_DENIED,         ///< Invalid RFID card scanned
  EVENT_PARKING_FULL,        ///< Parking is full
  EVENT_VEHICLE_PASSED,      ///< Vehicle passed through gate
  EVENT_TIMEOUT              ///< Operation timeout
};

/**
 * @struct GateEventData
 * @brief Data associated with gate events
 */
struct GateEventData {
  GateEvent event;           ///< Event type
  String cardUID;            ///< Card UID (if applicable)
  int slotNumber;            ///< Assigned slot number (if applicable)
  unsigned long duration;    ///< Parking duration (exit only)
};

// Forward declaration for callback
typedef void (*GateEventCallback)(const GateEventData& eventData);

/**
 * @class GateController
 * @brief Controls a single gate (entrance or exit) with state machine
 * 
 * Example usage:
 * @code
 * GateController entranceGate("ENTRANCE", IR_IN_PIN, SERVO_IN_PIN);
 * entranceGate.begin();
 * entranceGate.setEventCallback(myEventHandler);
 * 
 * void loop() {
 *   String cardUID = rfidManager.readCard(...);
 *   if (!cardUID.isEmpty()) {
 *     entranceGate.handleCardScanned(cardUID, authorized);
 *   }
 *   entranceGate.update();
 * }
 * @endcode
 */
class GateController {
public:
  /**
   * @brief Constructor
   * @param name Gate name for debugging ("ENTRANCE" or "EXIT")
   * @param irPin IR sensor pin number
   * @param servoPin Servo motor pin number
   */
  GateController(const char* name, uint8_t irPin, uint8_t servoPin);

  /**
   * @brief Initialize gate controller
   * @return true if successful
   */
  bool begin();

  /**
   * @brief Update gate state machine (call in loop)
   */
  void update();

  /**
   * @brief Handle RFID card scan result
   * @param cardUID Scanned card UID
   * @param authorized Whether card is authorized
   * @param slotNumber Assigned slot number (entrance) or found slot (exit)
   * @param parkingFull Whether parking is full (entrance only)
   */
  void handleCardScanned(const String& cardUID, bool authorized, 
                        int slotNumber = -1, bool parkingFull = false);

  /**
   * @brief Manually open gate (emergency or remote command)
   * @param duration How long to keep gate open (ms), 0 = until vehicle passes
   */
  void openGate(unsigned long duration = 0);

  /**
   * @brief Manually close gate
   */
  void closeGate();

  /**
   * @brief Check if gate is currently open
   * @return true if open, false if closed
   */
  bool isOpen() const;

  /**
   * @brief Get current gate state
   * @return Current GateState
   */
  GateState getState() const;

  /**
   * @brief Set event callback function
   * @param callback Function to call when events occur
   */
  void setEventCallback(GateEventCallback callback);

  /**
   * @brief Get last scanned card UID
   * @return Last card UID
   */
  String getLastScannedCard() const;

  /**
   * @brief Reset gate to idle state
   */
  void reset();

  /**
   * @brief Check if vehicle is currently detected
   * @return true if detected, false otherwise
   */
  bool isVehicleDetected() const;

private:
  String _name;                      ///< Gate name for debugging
  uint8_t _irPin;                    ///< IR sensor pin
  uint8_t _servoPin;                 ///< Servo motor pin
  Servo _servo;                      ///< Servo object
  GateState _state;                  ///< Current state
  String _lastScannedCard;           ///< Last scanned card UID
  unsigned long _stateStartTime;     ///< Time when current state started
  GateEventCallback _eventCallback;  ///< Event callback function
  bool _vehicleWasDetected;          ///< Previous vehicle detection state
  bool _initialized;                 ///< Initialization status

  /**
   * @brief Read IR sensor state
   * @return true if vehicle detected, false otherwise
   */
  bool readIRSensor() const;

  /**
   * @brief Set servo position
   * @param angle Servo angle
   */
  void setServoAngle(int angle);

  /**
   * @brief Transition to new state
   * @param newState New state to transition to
   */
  void setState(GateState newState);

  /**
   * @brief Fire event callback
   * @param eventData Event data to send
   */
  void fireEvent(const GateEventData& eventData);

  /**
   * @brief Get time elapsed in current state
   * @return Elapsed time in milliseconds
   */
  unsigned long getStateElapsedTime() const;
};

#endif // GATECONTROLLER_H
