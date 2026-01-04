/**
 * @file LCDDisplay.h
 * @brief LCD display manager with I2C interface
 * @details Provides a clean wrapper around LiquidCrystal_I2C library
 *          with thread-safe operations and message formatting
 */

#ifndef LCDDISPLAY_H
#define LCDDISPLAY_H

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "../Config.h"

/**
 * @class LCDDisplay
 * @brief Manages LCD display operations with clean interface
 * 
 * Example usage:
 * @code
 * LCDDisplay lcd;
 * lcd.begin();
 * lcd.updateLine(0, "Hello World");
 * lcd.showMessage("Status", "Ready", 2000);
 * @endcode
 */
class LCDDisplay {
public:
  /**
   * @brief Constructor
   */
  LCDDisplay();

  /**
   * @brief Initialize LCD display and I2C bus
   * @return true if successful, false otherwise
   */
  bool begin();

  /**
   * @brief Clear entire display
   */
  void clear();

  /**
   * @brief Update a single line with text (auto-padded to 16 chars)
   * @param row Row number (0 or 1)
   * @param text Text to display (max 16 chars)
   */
  void updateLine(uint8_t row, const String& text);

  /**
   * @brief Display two-line message
   * @param line1 Text for first line
   * @param line2 Text for second line
   */
  void showMessage(const String& line1, const String& line2);

  /**
   * @brief Display temporary message then restore previous content
   * @param line1 Text for first line
   * @param line2 Text for second line
   * @param duration Duration in milliseconds
   */
  void showTemporaryMessage(const String& line1, const String& line2, 
                           unsigned long duration);

  /**
   * @brief Set cursor position
   * @param col Column (0-15)
   * @param row Row (0-1)
   */
  void setCursor(uint8_t col, uint8_t row);

  /**
   * @brief Print text at current cursor position
   * @param text Text to print
   */
  void print(const String& text);

  /**
   * @brief Turn backlight on/off
   * @param on true to turn on, false to turn off
   */
  void setBacklight(bool on);

  /**
   * @brief Format and display slot availability
   * @param availableSlots Number of available slots
   * @param totalSlots Total number of slots
   * @param row Row to display on (0 or 1)
   */
  void displaySlotStatus(int availableSlots, int totalSlots, uint8_t row = 1);

  /**
   * @brief Display gate status (IN/OUT)
   * @param gate Gate identifier ("IN" or "OUT")
   * @param status Status message
   * @param row Row to display on (0 or 1)
   */
  void displayGateStatus(const String& gate, const String& status, uint8_t row);

private:
  LiquidCrystal_I2C _lcd;    ///< LCD object instance
  String _line1Content;       ///< Current line 1 content (for restore)
  String _line2Content;       ///< Current line 2 content (for restore)
  bool _initialized;          ///< Initialization status

  /**
   * @brief Pad or truncate string to 16 characters
   * @param text Input text
   * @return Formatted string
   */
  String formatLine(const String& text) const;
};

#endif // LCDDISPLAY_H
