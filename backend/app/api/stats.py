"""
Statistics and reports API routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import ParkingSlot, RFIDCard, EntryExitLog
from app.models.schemas import SystemStats, OccupancyStats, RevenueStats
from app.services.parking_service import get_peak_hours_analysis, get_occupancy_trend

router = APIRouter(prefix="/api/stats", tags=["Statistics"])


@router.get("", response_model=SystemStats)
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive system statistics (requires authentication)
    """
    # Occupancy stats
    total_slots = db.query(ParkingSlot).count()
    occupied_slots = db.query(ParkingSlot).filter(ParkingSlot.status == "occupied").count()
    available_slots = total_slots - occupied_slots
    occupancy_rate = (occupied_slots / total_slots * 100) if total_slots > 0 else 0
    
    occupancy = OccupancyStats(
        total_slots=total_slots,
        occupied_slots=occupied_slots,
        available_slots=available_slots,
        occupancy_rate=round(occupancy_rate, 2)
    )
    
    # Revenue stats
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    revenue_today = db.query(func.sum(EntryExitLog.fee_amount)).filter(
        EntryExitLog.timestamp >= datetime.combine(today, datetime.min.time()),
        EntryExitLog.fee_amount.isnot(None)
    ).scalar() or 0.0
    
    revenue_week = db.query(func.sum(EntryExitLog.fee_amount)).filter(
        EntryExitLog.timestamp >= datetime.combine(week_ago, datetime.min.time()),
        EntryExitLog.fee_amount.isnot(None)
    ).scalar() or 0.0
    
    revenue_month = db.query(func.sum(EntryExitLog.fee_amount)).filter(
        EntryExitLog.timestamp >= datetime.combine(month_ago, datetime.min.time()),
        EntryExitLog.fee_amount.isnot(None)
    ).scalar() or 0.0
    
    revenue_total = db.query(func.sum(EntryExitLog.fee_amount)).filter(
        EntryExitLog.fee_amount.isnot(None)
    ).scalar() or 0.0
    
    revenue = RevenueStats(
        today=round(revenue_today, 2),
        this_week=round(revenue_week, 2),
        this_month=round(revenue_month, 2),
        total=round(revenue_total, 2)
    )
    
    # Card stats
    total_cards = db.query(RFIDCard).count()
    active_cards = db.query(RFIDCard).filter(RFIDCard.is_active == True).count()
    
    # Today's activity
    total_entries_today = db.query(EntryExitLog).filter(
        EntryExitLog.timestamp >= datetime.combine(today, datetime.min.time()),
        EntryExitLog.action == "entry",
        EntryExitLog.status == "success"
    ).count()
    
    total_exits_today = db.query(EntryExitLog).filter(
        EntryExitLog.timestamp >= datetime.combine(today, datetime.min.time()),
        EntryExitLog.action == "exit",
        EntryExitLog.status == "success"
    ).count()
    
    return SystemStats(
        occupancy=occupancy,
        revenue=revenue,
        total_cards=total_cards,
        active_cards=active_cards,
        total_entries_today=total_entries_today,
        total_exits_today=total_exits_today
    )


@router.get("/peak-hours")
def get_peak_hours(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get peak hours analysis for last N days (requires authentication)
    """
    start_date = datetime.now() - timedelta(days=days)
    
    logs = db.query(EntryExitLog).filter(
        EntryExitLog.timestamp >= start_date,
        EntryExitLog.action == "entry"
    ).all()
    
    return get_peak_hours_analysis(logs)


@router.get("/occupancy-trend")
def get_occupancy_stats(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get occupancy trend for last N days (requires authentication)
    """
    start_date = datetime.now() - timedelta(days=days)
    
    logs = db.query(EntryExitLog).filter(
        EntryExitLog.timestamp >= start_date
    ).all()
    
    return get_occupancy_trend(logs, days)


@router.get("/revenue-by-day")
def get_revenue_by_day(days: int = 30, db: Session = Depends(get_db)):
    """
    Get daily revenue for last N days
    """
    today = datetime.now().date()
    revenue_data = {}
    
    for i in range(days):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        
        daily_revenue = db.query(func.sum(EntryExitLog.fee_amount)).filter(
            func.date(EntryExitLog.timestamp) == date,
            EntryExitLog.fee_amount.isnot(None)
        ).scalar() or 0.0
        
        revenue_data[date_str] = round(daily_revenue, 2)
    
    return revenue_data


@router.get("/frequent-users")
def get_frequent_users(limit: int = 10, db: Session = Depends(get_db)):
    """
    Get most frequent users (by number of entries)
    """
    results = db.query(
        RFIDCard.card_uid,
        RFIDCard.owner_name,
        RFIDCard.vehicle_plate,
        func.count(EntryExitLog.log_id).label("visit_count")
    ).join(
        EntryExitLog, RFIDCard.card_uid == EntryExitLog.card_uid
    ).filter(
        EntryExitLog.action == "entry",
        EntryExitLog.status == "success"
    ).group_by(
        RFIDCard.card_uid
    ).order_by(
        func.count(EntryExitLog.log_id).desc()
    ).limit(limit).all()
    
    return [
        {
            "card_uid": r.card_uid,
            "owner_name": r.owner_name,
            "vehicle_plate": r.vehicle_plate,
            "visit_count": r.visit_count
        }
        for r in results
    ]
