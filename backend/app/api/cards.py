"""
RFID Cards API routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import RFIDCard
from app.models.schemas import RFIDCardCreate, RFIDCardUpdate, RFIDCardResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cards", tags=["RFID Cards"])
limiter = Limiter(key_func=get_remote_address)


def _sync_cards_to_esp32(db: Session):
    """Helper function to sync all active cards to ESP32 via MQTT"""
    from app.services.mqtt_service import mqtt_service
    
    try:
        # Get all active cards
        active_cards = db.query(RFIDCard).filter(RFIDCard.is_active == True).all()
        
        # Build cards array for ESP32
        cards_data = [
            {
                "card_uid": card.card_uid,
                "owner_name": card.owner_name or "Unknown",
                "access_level": card.access_level,
                "is_active": card.is_active
            }
            for card in active_cards
        ]
        
        # Send sync command via MQTT
        success = mqtt_service.send_command("sync_whitelist", {"cards": cards_data})
        
        if success:
            logger.info(f"✓ Synced {len(cards_data)} cards to ESP32")
        else:
            logger.warning("⚠ Failed to send sync command to ESP32")
        
        return success
    except Exception as e:
        logger.error(f"✗ Error syncing cards to ESP32: {e}")
        return False


@router.get("", response_model=List[RFIDCardResponse])
def get_all_cards(
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all RFID cards with optional filtering
    """
    query = db.query(RFIDCard)
    
    if is_active is not None:
        query = query.filter(RFIDCard.is_active == is_active)
    
    cards = query.offset(skip).limit(limit).all()
    return cards


@router.get("/recent-unknown", response_model=List[dict])
def get_recent_unknown_cards(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get recently scanned unauthorized cards (for easy adding)
    Returns cards that were denied but not in whitelist
    """
    from app.models.models import EntryExitLog
    from sqlalchemy import func, distinct
    
    # Get distinct card UIDs that were denied and aren't in the whitelist
    unknown_cards = db.query(
        EntryExitLog.card_uid,
        func.max(EntryExitLog.timestamp).label('last_seen'),
        func.count(EntryExitLog.log_id).label('attempt_count')
    ).filter(
        EntryExitLog.status.in_(['denied_unauthorized', 'denied_full'])
    ).group_by(
        EntryExitLog.card_uid
    ).order_by(
        func.max(EntryExitLog.timestamp).desc()
    ).limit(limit).all()
    
    # Filter out cards that are already in whitelist
    result = []
    for card_uid, last_seen, attempt_count in unknown_cards:
        existing = db.query(RFIDCard).filter(RFIDCard.card_uid == card_uid).first()
        if not existing:
            result.append({
                'card_uid': card_uid,
                'last_seen': last_seen,
                'attempt_count': attempt_count
            })
    
    return result


@router.get("/{card_uid}", response_model=RFIDCardResponse)
def get_card(card_uid: str, db: Session = Depends(get_db)):
    """
    Get specific RFID card information
    """
    card = db.query(RFIDCard).filter(RFIDCard.card_uid == card_uid).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.post("", response_model=RFIDCardResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
def create_card(
    request: Request,
    card: RFIDCardCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Register new RFID card (rate limited: 50/minute)
    """
    # Check if card already exists
    existing_card = db.query(RFIDCard).filter(RFIDCard.card_uid == card.card_uid).first()
    if existing_card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Card already registered"
        )
    
    # Create new card
    db_card = RFIDCard(**card.model_dump())
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    
    # Auto-sync to ESP32
    _sync_cards_to_esp32(db)
    
    return db_card


@router.put("/{card_uid}", response_model=RFIDCardResponse)
def update_card(
    card_uid: str,
    card_update: RFIDCardUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Update RFID card information
    """
    card = db.query(RFIDCard).filter(RFIDCard.card_uid == card_uid).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Update only provided fields
    update_data = card_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)
    
    from datetime import datetime
    card.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(card)
    
    # Auto-sync to ESP32
    _sync_cards_to_esp32(db)
    
    return card


@router.delete("/{card_uid}")
def deactivate_card(
    card_uid: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Deactivate (soft delete) RFID card
    """
    card = db.query(RFIDCard).filter(RFIDCard.card_uid == card_uid).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    card.is_active = False
    from datetime import datetime
    card.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Auto-sync to ESP32
    _sync_cards_to_esp32(db)
    
    return {"message": "Card deactivated successfully"}


@router.get("/{card_uid}/history")
def get_card_history(
    card_uid: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get entry/exit history for a specific card
    """
    from app.models.models import EntryExitLog
    
    card = db.query(RFIDCard).filter(RFIDCard.card_uid == card_uid).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    logs = db.query(EntryExitLog).filter(
        EntryExitLog.card_uid == card_uid
    ).order_by(EntryExitLog.timestamp.desc()).limit(limit).all()
    
    return {
        "card_uid": card_uid,
        "owner_name": card.owner_name,
        "history": logs
    }


@router.post("/sync-to-esp32")
def sync_cards_to_esp32(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger synchronization of all cards to ESP32
    """
    success = _sync_cards_to_esp32(db)
    
    if success:
        return {"message": "Cards synchronized to ESP32 successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync cards to ESP32"
        )
