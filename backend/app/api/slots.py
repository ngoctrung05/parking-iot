"""
Parking slots API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import ParkingSlot
from app.models.schemas import ParkingSlotResponse

router = APIRouter(prefix="/api/slots", tags=["Parking Slots"])


@router.get("", response_model=List[ParkingSlotResponse])
def get_all_slots(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all parking slot statuses (requires authentication)
    """
    slots = db.query(ParkingSlot).order_by(ParkingSlot.slot_id).all()
    return slots


@router.get("/{slot_id}", response_model=ParkingSlotResponse)
def get_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get specific slot information (requires authentication)
    """
    slot = db.query(ParkingSlot).filter(ParkingSlot.slot_id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    return slot


@router.get("/{slot_id}/history")
def get_slot_history(
    slot_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get history of a specific parking slot (requires authentication)
    """
    from app.models.models import EntryExitLog
    
    slot = db.query(ParkingSlot).filter(ParkingSlot.slot_id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    logs = db.query(EntryExitLog).filter(
        EntryExitLog.slot_id == slot_id
    ).order_by(EntryExitLog.timestamp.desc()).limit(limit).all()
    
    return {
        "slot_id": slot_id,
        "current_status": slot.status,
        "history": logs
    }
