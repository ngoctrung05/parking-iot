"""
Database models for parking system
"""
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.core.database import Base


class ActionType(str, enum.Enum):
    ENTRY = "entry"
    EXIT = "exit"


class AccessLevel(str, enum.Enum):
    REGULAR = "regular"
    ADMIN = "admin"
    TEMPORARY = "temporary"


class EventSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    
    slot_id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="available")  # available, occupied
    current_card_uid = Column(String, nullable=True)
    entry_time = Column(DateTime, nullable=True)
    exit_time = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    logs = relationship("EntryExitLog", back_populates="slot", foreign_keys="EntryExitLog.slot_id")


class RFIDCard(Base):
    __tablename__ = "rfid_cards"
    
    card_uid = Column(String, primary_key=True, index=True)
    owner_name = Column(String, nullable=False)
    owner_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    vehicle_plate = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    access_level = Column(SQLEnum(AccessLevel), default=AccessLevel.REGULAR)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    logs = relationship("EntryExitLog", back_populates="card")


class EntryExitLog(Base):
    __tablename__ = "entry_exit_logs"
    
    log_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    card_uid = Column(String, ForeignKey("rfid_cards.card_uid"), nullable=False)
    slot_id = Column(Integer, ForeignKey("parking_slots.slot_id"), nullable=True)
    action = Column(SQLEnum(ActionType), nullable=False)
    gate = Column(String, nullable=False)  # entrance, exit
    status = Column(String, nullable=False)  # success, denied_unauthorized, denied_full, etc.
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    duration_minutes = Column(Integer, nullable=True)  # Only for exit events
    fee_amount = Column(Float, nullable=True)  # Only for exit events
    
    # Relationships
    card = relationship("RFIDCard", back_populates="logs")
    slot = relationship("ParkingSlot", back_populates="logs", foreign_keys=[slot_id])


class SystemEvent(Base):
    __tablename__ = "system_events"
    
    event_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_type = Column(String, nullable=False)  # mqtt_connected, mqtt_disconnected, error, etc.
    severity = Column(SQLEnum(EventSeverity), default=EventSeverity.INFO)
    description = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    event_metadata = Column(String, nullable=True)  # JSON string for additional data (renamed from metadata to avoid SQLAlchemy conflict)


class User(Base):
    """Admin users for web interface"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin")  # admin, operator, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
