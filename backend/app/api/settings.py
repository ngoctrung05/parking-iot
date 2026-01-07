"""Settings API routes (pricing etc.)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.schemas import PricingSettings, PricingSettingsUpdate
from app.services.pricing_service import get_pricing, update_pricing

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/pricing", response_model=PricingSettings)
def get_pricing_settings(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    pricing = get_pricing(db)
    return PricingSettings(
        hourly_rate=pricing.hourly_rate,
        daily_max_rate=pricing.daily_max_rate,
        grace_period_minutes=pricing.grace_period_minutes,
    )


@router.put("/pricing", response_model=PricingSettings)
def update_pricing_settings(
    payload: PricingSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admin users can update pricing settings")

    pricing = update_pricing(db, payload)
    return PricingSettings(
        hourly_rate=pricing.hourly_rate,
        daily_max_rate=pricing.daily_max_rate,
        grace_period_minutes=pricing.grace_period_minutes,
    )
