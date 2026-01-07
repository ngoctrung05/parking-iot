/**
 * @file Config.h
 * @brief Central configuration file for IoT Parking Barrier System
 * @details Contains all system constants, pin definitions, network credentials,
 *          and hardware configuration parameters
 * @author Enhanced version - December 2025
 */

#ifndef CONFIG_H
#define CONFIG_H

// ==================== NETWORK CONFIGURATION ====================

// WiFi Credentials (UPDATE THESE FOR YOUR NETWORK)
#define WIFI_SSID "Cnt3"
#define WIFI_PASSWORD "123456987"
#define WIFI_CHECK_INTERVAL 10000 // Check WiFi connection every 10 seconds

// MQTT Broker Settings (HiveMQ Cloud Configuration)
#define Hive "d17c7b0faa964c81bb1a8c203be8b280.s1.eu.hivemq.cloud" // HiveMQ Cloud cluster URL
#define MQTT_PORT 8883                                             // TLS/SSL port for HiveMQ Cloud
#define MQTT_USERNAME "dung123"                                    // HiveMQ Cloud username
#define MQTT_PASSWORD "Iot2025@"                                   // HiveMQ Cloud password
#define MQTT_BUFFER_SIZE 512                                       // Increased for JSON messages

// MQTT Topics
#define MQTT_TOPIC_ENTRY "parking/events/entry"
#define MQTT_TOPIC_EXIT "parking/events/exit"
#define MQTT_TOPIC_SCAN "parking/events/scan"
#define MQTT_TOPIC_SYSTEM "parking/system"
#define MQTT_TOPIC_COMMANDS "parking/commands"

// MQTT Connection
#define MQTT_RECONNECT_INTERVAL 5000 // Try reconnect every 5 seconds
#define STATUS_UPDATE_INTERVAL 30000 // Send status update every 30 seconds

// ==================== TIME SYNC CONFIGURATION ====================

// NTP Server Configuration
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC 25200 // GMT+7 for Vietnam (7 * 3600)
#define DAYLIGHT_OFFSET_SEC 0
#define NTP_SYNC_TIMEOUT 5000 // NTP sync timeout in ms

// ==================== PARKING SYSTEM CONFIGURATION ====================

// Slot Management
#define TOTAL_SLOTS 10    // Total number of parking slots
#define MAX_RFID_CARDS 50 // Maximum cards in whitelist

// EEPROM Configuration
#define EEPROM_SIZE 4096
#define EEPROM_MAGIC 0xABCD1234 // Magic number for EEPROM validation

// ==================== HARDWARE PIN DEFINITIONS ====================

// I2C LCD Configuration
#define I2C_SDA_PIN 33
#define I2C_SCL_PIN 32
#define LCD_ADDRESS 0x27
#define LCD_COLS 16
#define LCD_ROWS 2

// ENTRANCE GATE PINS
#define IR_IN_PIN 14    // IR sensor for entrance
#define SERVO_IN_PIN 13 // Servo motor for entrance barrier
#define RFID_IN_SS 27   // SPI SS pin for entrance RFID
#define RFID_IN_RST 26  // RST pin for entrance RFID

// EXIT GATE PINS
#define IR_OUT_PIN 16   // IR sensor for exit
#define SERVO_OUT_PIN 4 // Servo motor for exit barrier
#define RFID_OUT_SS 5   // SPI SS pin for exit RFID
#define RFID_OUT_RST 17 // RST pin for exit RFID

// ==================== SERVO CONFIGURATION ====================

#define SERVO_FREQ 50        // Standard servo frequency (50Hz)
#define SERVO_MIN_PULSE 500  // Minimum pulse width in microseconds
#define SERVO_MAX_PULSE 2400 // Maximum pulse width in microseconds
#define SERVO_CLOSED_ANGLE 0 // Angle when barrier is closed
#define SERVO_OPEN_ANGLE 90  // Angle when barrier is open

// ==================== GATE TIMING CONFIGURATION ====================

#define GATE_CLOSE_DELAY 2000         // Delay before closing gate (ms)
#define CARD_SCAN_TIMEOUT 10000       // Timeout for card scanning (ms)
#define DISPLAY_MESSAGE_DURATION 2000 // Duration to show messages (ms)

// ==================== RFID CARD ACCESS LEVELS ====================

enum RFIDAccessLevel
{
  ACCESS_REGULAR = 0,  // Regular user
  ACCESS_ADMIN = 1,    // Administrator
  ACCESS_TEMPORARY = 2 // Temporary/guest access
};

// ==================== GATE STATE ENUMERATION ====================

enum GateState
{
  STATE_IDLE,         // No vehicle detected
  STATE_WAITING_CARD, // Vehicle detected, waiting for RFID
  STATE_BARRIER_OPEN, // Barrier is open
  STATE_CLOSING_DELAY // Waiting before closing barrier
};

// ==================== DEBUG & LOGGING ====================

#define SERIAL_BAUD_RATE 115200
#define DEBUG_ENABLED true // Enable/disable debug logging

// Debug logging macro
#if DEBUG_ENABLED
#define DEBUG_PRINT(x) Serial.print(x)
#define DEBUG_PRINTLN(x) Serial.println(x)
#define DEBUG_PRINTF(...) Serial.printf(__VA_ARGS__)
#else
#define DEBUG_PRINT(x)
#define DEBUG_PRINTLN(x)
#define DEBUG_PRINTF(...)
#endif

// ==================== DEFAULT RFID CARDS ====================
// These cards are initialized on first boot

#define DEFAULT_CARD_COUNT 5

// Card UIDs (format: "0A1B2C3D")
#define DEFAULT_CARD_1_UID "0A1B2C3D"
#define DEFAULT_CARD_1_NAME "Admin"
#define DEFAULT_CARD_1_LEVEL ACCESS_ADMIN

#define DEFAULT_CARD_2_UID "1A2B3C4D"
#define DEFAULT_CARD_2_NAME "User1"
#define DEFAULT_CARD_2_LEVEL ACCESS_REGULAR

#define DEFAULT_CARD_3_UID "2A3B4C5D"
#define DEFAULT_CARD_3_NAME "User2"
#define DEFAULT_CARD_3_LEVEL ACCESS_REGULAR

#define DEFAULT_CARD_4_UID "83DF0756"
#define DEFAULT_CARD_4_NAME "Card1"
#define DEFAULT_CARD_4_LEVEL ACCESS_REGULAR

#define DEFAULT_CARD_5_UID "739E3F13"
#define DEFAULT_CARD_5_NAME "Card2"
#define DEFAULT_CARD_5_LEVEL ACCESS_REGULAR

// ==================== SYSTEM STATUS MESSAGES ====================

#define MSG_SYSTEM_INIT "System Init..."
#define MSG_SYSTEM_READY "System Ready"
#define MSG_WIFI_CONNECT "Connecting WiFi"
#define MSG_WIFI_CONNECTED "WiFi Connected"
#define MSG_WIFI_FAILED "WiFi Failed!"
#define MSG_PARKING_FULL "Parking Full"
#define MSG_ACCESS_DENIED "Access Denied"
#define MSG_EMERGENCY_MODE "EMERGENCY MODE"
#define MSG_SCAN_CARD "Scan Card"
#define MSG_BARRIER_OPEN "Barrier Open"

// ==================== ERROR CODES ====================

enum ErrorCode
{
  ERR_NONE = 0,
  ERR_WIFI_CONNECTION = 1,
  ERR_MQTT_CONNECTION = 2,
  ERR_NTP_SYNC_FAILED = 3,
  ERR_EEPROM_CORRUPT = 4,
  ERR_RFID_READ_ERROR = 5,
  ERR_SLOT_ALLOCATION = 6,
  ERR_NO_SLOTS_AVAILABLE = 7
};

#endif // CONFIG_H
