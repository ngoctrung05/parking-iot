/**
 * @file LCDDisplay.cpp
 * @brief Implementation of LCD display manager
 */

#include "LCDDisplay.h"

LCDDisplay::LCDDisplay() 
  : _lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS),
    _line1Content(""),
    _line2Content(""),
    _initialized(false) {
}

bool LCDDisplay::begin() {
  // Initialize I2C with custom pins
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  
  // Initialize LCD
  _lcd.init();
  _lcd.backlight();
  _lcd.clear();
  
  _initialized = true;
  DEBUG_PRINTLN("✓ LCD display initialized");
  
  return true;
}

void LCDDisplay::clear() {
  if (!_initialized) return;
  
  _lcd.clear();
  _line1Content = "";
  _line2Content = "";
}

void LCDDisplay::updateLine(uint8_t row, const String& text) {
  if (!_initialized || row > 1) return;
  
  String formattedText = formatLine(text);
  
  _lcd.setCursor(0, row);
  _lcd.print(formattedText);
  
  // Store current content
  if (row == 0) {
    _line1Content = formattedText;
  } else {
    _line2Content = formattedText;
  }
}

void LCDDisplay::showMessage(const String& line1, const String& line2) {
  if (!_initialized) return;
  
  updateLine(0, line1);
  updateLine(1, line2);
}

void LCDDisplay::showTemporaryMessage(const String& line1, const String& line2, 
                                     unsigned long duration) {
  if (!_initialized) return;
  
  // Save current content
  String savedLine1 = _line1Content;
  String savedLine2 = _line2Content;
  
  // Show temporary message
  showMessage(line1, line2);
  delay(duration);
  
  // Restore previous content
  showMessage(savedLine1, savedLine2);
}

void LCDDisplay::setCursor(uint8_t col, uint8_t row) {
  if (!_initialized) return;
  _lcd.setCursor(col, row);
}

void LCDDisplay::print(const String& text) {
  if (!_initialized) return;
  _lcd.print(text);
}

void LCDDisplay::setBacklight(bool on) {
  if (!_initialized) return;
  
  if (on) {
    _lcd.backlight();
  } else {
    _lcd.noBacklight();
  }
}

void LCDDisplay::displaySlotStatus(int availableSlots, int totalSlots, uint8_t row) {
  if (!_initialized) return;
  
  String message = "Slots: " + String(availableSlots) + "/" + String(totalSlots);
  updateLine(row, message);
}

void LCDDisplay::displayGateStatus(const String& gate, const String& status, uint8_t row) {
  if (!_initialized) return;
  
  String message = gate + ": " + status;
  updateLine(row, message);
}

String LCDDisplay::formatLine(const String& text) const {
  String formatted = text;
  
  // Truncate if too long
  if (formatted.length() > LCD_COLS) {
    formatted = formatted.substring(0, LCD_COLS);
  }
  
  // Pad with spaces if too short
  while (formatted.length() < LCD_COLS) {
    formatted += " ";
  }
  
  return formatted;
}
