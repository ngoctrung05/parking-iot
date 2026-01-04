# IoT Parking Management System

A complete IoT-based smart parking system with ESP32, RFID authentication, and real-time web dashboard.

## 🚀 Features

### Hardware (ESP32)
- ✅ **Dual-gate control** - Separate entrance and exit barriers with servo motors
- ✅ **RFID authentication** - Two MFRC522 readers for card-based access control
- ✅ **IR sensors** - Vehicle detection at both gates
- ✅ **LCD display** - Real-time status with I2C 16x2 LCD
- ✅ **WiFi connectivity** - Connects to HiveMQ Cloud via TLS/SSL
- ✅ **NTP time sync** - Accurate timestamps for all events
- ✅ **MQTT communication** - Publishes events and receives commands

### Backend (FastAPI + Python)
- ✅ **RESTful API** - Complete CRUD operations for cards, logs, and stats
- ✅ **MQTT integration** - Subscribes to ESP32 events in real-time
- ✅ **WebSocket support** - Live updates to connected dashboards
- ✅ **JWT authentication** - Secure admin access
- ✅ **Database** - SQLite (dev) or PostgreSQL (production)
- ✅ **Auto-sync** - Card whitelist automatically syncs to ESP32

### Frontend (Vanilla JavaScript)
- ✅ **Real-time dashboard** - Live parking occupancy and activity feed
- ✅ **Card management** - Add, edit, deactivate RFID cards
- ✅ **Scan-to-add** - Direct card scanning from web interface 🆕
- ✅ **Unknown card detection** - One-click add for denied scans
- ✅ **Reports & analytics** - Revenue tracking, peak hours, frequent users
- ✅ **Manual controls** - Open barriers, emergency mode

## 📋 System Requirements

### Hardware
- ESP32 DevKit (tested on ESP32-WROOM-32)
- 2× MFRC522 RFID readers
- 2× SG90 servo motors (for barriers)
- 2× IR obstacle sensors
- 1× I2C 16x2 LCD display
- RFID cards (ISO14443A compatible)
- Breadboard, jumper wires, 5V power supply

### Software
- **Firmware**: PlatformIO (Arduino framework)
- **Backend**: Python 3.9+
- **Database**: SQLite (included) or PostgreSQL
- **MQTT Broker**: HiveMQ Cloud (or local Mosquitto)

## 🔧 Quick Start

### 1. Hardware Setup

Connect components to ESP32 according to [src/Config.h](src/Config.h):

**Entrance Gate:**
- RFID: SS=27, RST=26
- Servo: GPIO 13
- IR Sensor: GPIO 14

**Exit Gate:**
- RFID: SS=5, RST=17
- Servo: GPIO 4
- IR Sensor: GPIO 16

**LCD Display:**
- SDA: GPIO 33
- SCL: GPIO 32

### 2. Configure WiFi & MQTT

Edit [src/Config.h](src/Config.h):

```cpp
#define WIFI_SSID           "YourWiFiName"
#define WIFI_PASSWORD       "YourPassword"

#define MQTT_SERVER         "your-cluster.s1.eu.hivemq.cloud"
#define MQTT_USERNAME       "your-username"
#define MQTT_PASSWORD       "your-password"
```

### 3. Flash Firmware

```bash
# Build
pio run

# Upload to ESP32
pio run -t upload

# Monitor serial output
pio device monitor
```

### 4. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run server
python -m app.main
```

Backend runs at: http://localhost:8000

### 5. Access Dashboard

Open http://localhost:8000 in your browser

**Default credentials:**
- Username: `admin`
- Password: `admin123`

⚠️ **Change default password in production!**

## 📡 MQTT Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `parking/events/entry` | ESP32 → Backend | Entry events (success/denied) |
| `parking/events/exit` | ESP32 → Backend | Exit events with duration |
| `parking/events/scan` | ESP32 → Backend | Card scanned in enrollment mode |
| `parking/system` | ESP32 → Backend | System status updates |
| `parking/commands` | Backend → ESP32 | Control commands |

### Command Examples

```json
// Open entrance barrier
{"command": "open_barrier", "gate": "entrance"}

// Enable scan mode for card enrollment
{"command": "scan_mode", "enable": true, "gate": "entrance"}

// Emergency mode (open all gates)
{"command": "emergency", "enable": true}

// Sync whitelist from backend
{"command": "sync_whitelist", "cards": [...]}
```

## 🎯 How to Use

### Add New Card (Scan-to-Add) 🆕

1. **Navigate** to Cards page in dashboard
2. **Click** "Add New Card" button
3. **Click** "Scan Card" button (blue button next to UID field)
4. **Place** RFID card on entrance reader within 30 seconds
5. **Wait** for UID to auto-populate
6. **Fill** in owner details
7. **Click** "Add Card"

Card is automatically synced to ESP32!

### Add Unknown Card

When an unauthorized card is scanned:
1. **Notification** appears: "Unknown card detected"
2. **Go to** Cards page → "Recently Denied Cards" section
3. **Click** "Add Card" button next to the UID
4. **Fill** in owner details
5. **Submit** - Card is now authorized

### Manual Barrier Control

- **Open Entrance/Exit**: Use buttons in Settings page
- **Emergency Mode**: Opens all barriers (fire/evacuation)

### View Reports

- **Revenue**: Daily earnings from parking fees
- **Peak Hours**: Busiest times (hourly breakdown)
- **Frequent Users**: Top 10 visitors by entry count

## 🐳 Docker Deployment

```bash
# Start all services
docker-compose up -d

# Services:
# - Backend: localhost:8000
# - PostgreSQL: localhost:5432
# - pgAdmin: localhost:5050
```

## 🔒 Security Features

- ✅ JWT token authentication
- ✅ Rate limiting (50 req/min for card operations)
- ✅ Password hashing with bcrypt
- ✅ TLS/SSL for MQTT (HiveMQ Cloud)
- ✅ CORS protection
- ✅ Input validation with Pydantic

## 📊 Database Schema

**Tables:**
- `rfid_cards` - Authorized cards with owner info
- `parking_slots` - Slot occupancy status
- `entry_exit_logs` - All entry/exit events with timestamps
- `system_events` - MQTT connection, errors, etc.
- `users` - Admin accounts for web dashboard

## 🛠️ Development

### Project Structure

```
Project_iot/
├── src/                    # ESP32 firmware
│   ├── main.ino           # Main orchestrator
│   ├── Config.h           # Hardware pins & credentials
│   ├── GateController/    # Barrier & IR sensor logic
│   ├── RFIDManager/       # Card reading & whitelist
│   ├── MQTTHandler/       # MQTT client with JSON
│   ├── NetworkManager/    # WiFi connection
│   ├── SlotManager/       # Parking slot allocation
│   ├── LCDDisplay/        # LCD wrapper
│   └── TimeSync/          # NTP time sync
├── backend/               # Python FastAPI server
│   └── app/
│       ├── api/           # REST endpoints
│       ├── core/          # Config, DB, security
│       ├── models/        # SQLAlchemy models
│       └── services/      # MQTT service
├── frontend/              # Web dashboard
│   ├── static/
│   │   ├── css/          # Tailwind CSS
│   │   └── js/           # Vanilla JavaScript
│   └── templates/
│       └── index.html     # SPA dashboard
├── docker-compose.yml     # Container orchestration
└── platformio.ini         # PlatformIO config
```

### API Endpoints

- `POST /api/auth/login` - Authenticate
- `GET /api/slots` - List parking slots
- `GET /api/cards` - List RFID cards
- `POST /api/cards` - Add new card
- `PUT /api/cards/{uid}` - Update card
- `DELETE /api/cards/{uid}` - Deactivate card
- `POST /api/cards/sync-to-esp32` - Force sync
- `GET /api/logs` - Entry/exit history
- `GET /api/stats` - Dashboard statistics
- `POST /api/commands/scan-mode` - Activate card scanning
- `POST /api/commands/open-barrier` - Manual barrier control
- `POST /api/commands/emergency` - Emergency mode
- `WS /ws/realtime` - WebSocket for live updates

Full API docs: http://localhost:8000/docs

## 🧪 Testing

```bash
# Test MQTT connection
mosquitto_sub -h your-cluster.s1.eu.hivemq.cloud -p 8883 \
  -t "parking/#" -u username -P password --capath /etc/ssl/certs/

# Test card sync
cd backend
python test_card_sync.py
```

## ⚙️ Configuration

### Parking Settings ([backend/app/core/config.py](backend/app/core/config.py))

```python
TOTAL_PARKING_SLOTS = 10      # Number of parking spaces
HOURLY_RATE = 5.0             # USD per hour
DAILY_MAX_RATE = 50.0         # Maximum daily charge
GRACE_PERIOD_MINUTES = 15     # Free exit window
```

### ESP32 Settings ([src/Config.h](src/Config.h))

```cpp
#define TOTAL_SLOTS 10                    // Must match backend
#define MAX_RFID_CARDS 50                 // Whitelist capacity
#define STATUS_UPDATE_INTERVAL 30000      // Status publish interval (ms)
#define GATE_CLOSE_DELAY 2000             // Barrier close delay (ms)
```

## 🐛 Troubleshooting

### ESP32 won't connect to WiFi
- Check SSID/password in Config.h
- Verify 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Check serial monitor for error messages

### MQTT connection fails
- Verify HiveMQ Cloud credentials
- Check firewall allows port 8883
- Test with `mosquitto_sub` command

### Backend won't start
- Install dependencies: `pip install -r requirements.txt`
- Check .env file exists and has correct values
- Verify Python 3.9+ is installed

### Card not syncing to ESP32
- Check MQTT connection status in dashboard
- Verify ESP32 serial monitor shows "Whitelist synced"
- Cards sync automatically on add/edit/delete

### WebSocket not receiving updates
- Hard refresh browser (Ctrl+F5)
- Check browser console for errors
- Verify backend logs show "WebSocket client connected"

## 📝 License

MIT License - See LICENSE file for details

## 👥 Credits

Developed for IoT Parking Management System project.

**Technologies:**
- ESP32 Arduino framework
- FastAPI (Python web framework)
- Paho MQTT client
- SQLAlchemy ORM
- Bootstrap 5 + Tailwind CSS
- Chart.js for analytics

---

**Version:** 2.0  
**Last Updated:** December 31, 2025  
**Status:** ✅ Production Ready
