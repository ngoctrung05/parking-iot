"""
Main FastAPI application
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models.models import User, RFIDCard, ParkingSlot
from app.services.mqtt_service import mqtt_service
from app.api import auth, slots, cards, logs, stats, commands, websocket

# Configure logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info("🚀 Starting IoT Parking Management System...")
    
    # Initialize database
    init_db()
    logger.info("✓ Database initialized")
    
    # Create initial data
    create_initial_data()
    
    # Start MQTT service
    try:
        mqtt_service.start()
        logger.info("✓ MQTT service started")
        
        # Store reference to main event loop for MQTT callbacks
        import asyncio
        main_loop = asyncio.get_running_loop()
        
        # Register callback for broadcasting MQTT messages via WebSocket
        def mqtt_callback(topic: str, data: dict):
            try:
                # Schedule the coroutine in a thread-safe manner using the stored loop reference
                asyncio.run_coroutine_threadsafe(
                    websocket.broadcast_event("mqtt_message", {
                        "topic": topic,
                        "data": data
                    }),
                    main_loop
                )
            except Exception as e:
                logger.error(f"Error broadcasting MQTT message: {e}")
        
        mqtt_service.register_callback(mqtt_callback)
        
    except Exception as e:
        logger.error(f"✗ Failed to start MQTT service: {e}")
    
    logger.info("✓ System ready!")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    mqtt_service.stop()
    logger.info("✓ MQTT service stopped")


def create_initial_data():
    """Create initial database records if they don't exist"""
    db = SessionLocal()
    try:
        # Create admin user if not exists
        admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                role="admin"
            )
            db.add(admin)
            logger.info(f"✓ Admin user created: {settings.ADMIN_USERNAME}")
        
        # Create parking slots if they don't exist
        slot_count = db.query(ParkingSlot).count()
        if slot_count == 0:
            for i in range(1, settings.TOTAL_PARKING_SLOTS + 1):
                slot = ParkingSlot(slot_id=i, status="available")
                db.add(slot)
            logger.info(f"✓ Created {settings.TOTAL_PARKING_SLOTS} parking slots")
        
        # Create default RFID cards for testing
        card_count = db.query(RFIDCard).count()
        if card_count == 0:
            default_cards = [
                RFIDCard(
                    card_uid="0A1B2C3D",
                    owner_name="Admin",
                    owner_email="admin@parking.local",
                    vehicle_plate="ABC-123",
                    is_active=True,
                    access_level="admin"
                ),
                RFIDCard(
                    card_uid="1A2B3C4D",
                    owner_name="John Doe",
                    owner_email="john@example.com",
                    vehicle_plate="XYZ-789",
                    is_active=True,
                    access_level="regular"
                ),
                RFIDCard(
                    card_uid="2A3B4C5D",
                    owner_name="Jane Smith",
                    owner_email="jane@example.com",
                    vehicle_plate="DEF-456",
                    is_active=True,
                    access_level="regular"
                )
            ]
            for card in default_cards:
                db.add(card)
            logger.info("✓ Created 3 default RFID cards")
        
        db.commit()
        
    except Exception as e:
        logger.error(f"✗ Error creating initial data: {e}")
        db.rollback()
    finally:
        db.close()


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="IoT Parking Management System with ESP32 Integration",
    lifespan=lifespan
)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(slots.router)
app.include_router(cards.router)
app.include_router(logs.router)
app.include_router(stats.router)
app.include_router(commands.router)
app.include_router(websocket.router)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="../frontend/static"), name="static")
templates = Jinja2Templates(directory="../frontend/templates")

# Root endpoint - serve the web dashboard
@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# API info endpoint
@app.get("/api")
def api_info():
    return {
        "message": "IoT Parking Management System API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "mqtt_connected": mqtt_service.connected
    }

# Health check endpoints
@app.get("/health")
@app.get("/api/health")
def health_check():
    """Health check endpoint for monitoring and Docker healthcheck"""
    return {
        "status": "healthy",
        "mqtt_connected": mqtt_service.connected,
        "version": settings.APP_VERSION,
        "app_name": settings.APP_NAME
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )
