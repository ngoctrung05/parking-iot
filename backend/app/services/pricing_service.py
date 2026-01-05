"""Pricing settings service.

Stores runtime-configurable pricing values in DB so they can be edited from UI.
"""

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import ParkingPricing
from app.models.schemas import PricingSettingsUpdate


def get_pricing(db: Session) -> ParkingPricing:
    pricing = db.query(ParkingPricing).order_by(ParkingPricing.id.asc()).first()
    if pricing:
        return pricing

    pricing = ParkingPricing(
        hourly_rate=settings.HOURLY_RATE,
        daily_max_rate=settings.DAILY_MAX_RATE,
        grace_period_minutes=settings.GRACE_PERIOD_MINUTES,
    )
    db.add(pricing)
    db.commit()
    db.refresh(pricing)
    return pricing


def update_pricing(db: Session, update: PricingSettingsUpdate) -> ParkingPricing:
    pricing = get_pricing(db)
    update_data = update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(pricing, field, value)

    db.commit()
    db.refresh(pricing)
    return pricing
