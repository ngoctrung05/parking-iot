# Quick Start Script for IoT Parking Management System

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   IoT Parking Management System - Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  [OK] Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Python not found! Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check PlatformIO (optional)
try {
    $pioVersion = pio --version 2>&1
    Write-Host "  [OK] PlatformIO found: $pioVersion" -ForegroundColor Green
} catch {
    Write-Host "  [WARNING] PlatformIO not found (optional - only needed for ESP32 development)" -ForegroundColor Yellow
}

Write-Host ""

# Setup Python backend
Write-Host "[2/5] Setting up Python backend..." -ForegroundColor Yellow

Set-Location backend

# Create virtual environment if it doesn't exist
if (-not (Test-Path "venv")) {
    Write-Host "  Creating virtual environment..." -ForegroundColor Gray
    python -m venv venv
}

# Activate virtual environment
Write-Host "  Activating virtual environment..." -ForegroundColor Gray
& .\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "  Installing Python packages..." -ForegroundColor Gray
pip install -r requirements.txt --quiet

Write-Host "  [OK] Backend setup complete" -ForegroundColor Green
Write-Host ""

# Setup .env file
Write-Host "[3/5] Configuring environment..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "  Creating .env file from template..." -ForegroundColor Gray
    Copy-Item ".env.example" ".env"
    
    # Generate secure secret key
    $secretKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    (Get-Content ".env") -replace 'your-secret-key-here-change-in-production-use-openssl-rand-hex-32', $secretKey | Set-Content ".env"
    
    Write-Host "  [OK] .env file created with secure SECRET_KEY" -ForegroundColor Green
} else {
    Write-Host "  [OK] .env file already exists" -ForegroundColor Green
}

Write-Host ""

# Setup database
Write-Host "[4/5] Initializing database..." -ForegroundColor Yellow

if (Test-Path "parking.db") {
    $response = Read-Host "  Database already exists. Recreate? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Remove-Item "parking.db"
        Write-Host "  Deleted existing database" -ForegroundColor Gray
    } else {
        Write-Host "  Keeping existing database" -ForegroundColor Gray
        Set-Location ..
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host "   Setup Complete!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To start the system:" -ForegroundColor Yellow
        Write-Host "  1. Ensure MQTT broker is running (Mosquitto)" -ForegroundColor White
        Write-Host "  2. cd backend" -ForegroundColor White
        Write-Host "  3. .\venv\Scripts\Activate.ps1" -ForegroundColor White
        Write-Host "  4. python -m app.main" -ForegroundColor White
        Write-Host ""
        Write-Host "Then access:" -ForegroundColor Yellow
        Write-Host "  - Dashboard: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "  - API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Default login:" -ForegroundColor Yellow
        Write-Host "  Username: admin" -ForegroundColor White
        Write-Host "  Password: admin123" -ForegroundColor White
        Write-Host ""
        exit 0
    }
}

Write-Host "  Database will be created automatically on first run" -ForegroundColor Gray
Write-Host "  [OK] Database configuration ready" -ForegroundColor Green
Write-Host ""

# Check MQTT broker
Write-Host "[5/5] Checking MQTT broker..." -ForegroundColor Yellow

$mqttHost = "192.168.42.175"
$mqttPort = 1883

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($mqttHost, $mqttPort)
    $tcpClient.Close()
    Write-Host "  [OK] MQTT broker accessible at ${mqttHost}:${mqttPort}" -ForegroundColor Green
} catch {
    Write-Host "  [WARNING] Cannot connect to MQTT broker at ${mqttHost}:${mqttPort}" -ForegroundColor Yellow
    Write-Host "    Make sure Mosquitto is running or update MQTT_BROKER_HOST in .env" -ForegroundColor Yellow
}

Write-Host ""

# Return to root directory
Set-Location ..

# Summary
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Configure ESP32 (if not done):" -ForegroundColor White
Write-Host "   - Open src/main.cpp" -ForegroundColor Gray
Write-Host "   - Update WiFi credentials (ssid, password)" -ForegroundColor Gray
Write-Host "   - Update MQTT broker IP (mqtt_server)" -ForegroundColor Gray
Write-Host "   - Upload to ESP32 via PlatformIO" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start Backend Server:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "   python -m app.main" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Access the System:" -ForegroundColor White
Write-Host "   - Dashboard: " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host "   - API Docs: " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "   - Login: admin / admin123" -ForegroundColor Gray
Write-Host ""
Write-Host "For Docker deployment:" -ForegroundColor White
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "Need help? Check README.md for troubleshooting" -ForegroundColor Yellow
Write-Host ""
