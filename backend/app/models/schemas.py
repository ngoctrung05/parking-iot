"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re
class ActionType(str, Enum):
    ENTRY = "entry"
    EXIT = "exit"


class AccessLevel(str, Enum):
    REGULAR = "regular"
    ADMIN = "admin"
    TEMPORARY = "temporary"


class SlotStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"


# Authentication Schemas
class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# RFID Card Schemas
class RFIDCardBase(BaseModel):
    card_uid: str = Field(..., min_length=4, max_length=20)
    owner_name: str = Field(..., min_length=1, max_length=100)
    owner_email: Optional[str] = Field(None, max_length=100)  # Changed from EmailStr to allow .local domains
    phone: Optional[str] = Field(None, max_length=20)
    vehicle_plate: Optional[str] = Field(None, max_length=20)
    is_active: bool = True
    access_level: AccessLevel = AccessLevel.REGULAR


class RFIDCardCreate(RFIDCardBase):
    @field_validator('card_uid')
    @classmethod
    def validate_card_uid(cls, v: str) -> str:
        # Must be alphanumeric (hex format)
        if not re.match(r'^[A-Fa-f0-9]{8,20}$', v):
            raise ValueError('Card UID must be 8-20 hex characters (0-9, A-F)')
        return v.upper()
    
    @field_validator('owner_email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        # Basic email format check (allow .local domains)
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        return v.lower()
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Remove common separators
        cleaned = re.sub(r'[\s\-\(\)\.]', '', v)
        # Must be 10-15 digits
        if not re.match(r'^\+?[0-9]{10,15}$', cleaned):
            raise ValueError('Phone must be 10-15 digits (optional + prefix)')
        return cleaned
    
    @field_validator('vehicle_plate')
    @classmethod
    def validate_vehicle_plate(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Remove extra spaces, convert to uppercase
        cleaned = ' '.join(v.split()).upper()
        # Must be 2-20 alphanumeric characters (with optional spaces/dashes)
        if not re.match(r'^[A-Z0-9\s\-]{2,20}$', cleaned):
            raise ValueError('Vehicle plate must be 2-20 alphanumeric characters')
        return cleaned


class RFIDCardUpdate(BaseModel):
    owner_name: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    vehicle_plate: Optional[str] = None
    is_active: Optional[bool] = None
    access_level: Optional[AccessLevel] = None


class RFIDCardResponse(RFIDCardBase):
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Parking Slot Schemas
class ParkingSlotResponse(BaseModel):
    slot_id: int
    status: str
    current_card_uid: Optional[str] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Entry/Exit Log Schemas
class EntryExitLogResponse(BaseModel):
    log_id: int
    card_uid: str
    slot_id: Optional[int] = None
    action: ActionType
    gate: str
    status: str
    timestamp: datetime
    duration_minutes: Optional[int] = None
    fee_amount: Optional[float] = None
    
    class Config:
        from_attributes = True


# Statistics Schemas
class OccupancyStats(BaseModel):
    total_slots: int
    occupied_slots: int
    available_slots: int
    occupancy_rate: float


class RevenueStats(BaseModel):
    today: float
    this_week: float
    this_month: float
    total: float


class SystemStats(BaseModel):
    occupancy: OccupancyStats
    revenue: RevenueStats
    total_cards: int
    active_cards: int
    total_entries_today: int
    total_exits_today: int


# Command Schemas
class BarrierCommand(BaseModel):
    gate: str = Field(..., pattern="^(entrance|exit)$")


class EmergencyCommand(BaseModel):
    enable: bool


# System Status Schema
class SystemStatus(BaseModel):
    type: str = "status"
    timestamp: int
    total_slots: int
    available_slots: int
    occupied_slots: int
    authorized_cards: int
    emergency_mode: bool
    wifi_rssi: int
    uptime: int
    occupied_slot_details: List[dict]


# MQTT Event Schema (from ESP32)
class MQTTEvent(BaseModel):
    action: str
    card_uid: str
    slot_id: int
    gate: str
    status: str
    timestamp: int
    available_slots: int
