"""
Parking business logic and calculations
"""
from datetime import datetime, timedelta
from typing import Optional
from app.core.config import settings


def calculate_parking_fee(
    duration_minutes: int,
    hourly_rate: Optional[float] = None,
    daily_max_rate: Optional[float] = None,
    grace_period_minutes: Optional[int] = None,
) -> float:
    """
    Calculate parking fee based on duration
    
    Args:
        duration_minutes: Parking duration in minutes
    
    Returns:
        Fee amount in dollars
    """
    hourly_rate = settings.HOURLY_RATE if hourly_rate is None else hourly_rate
    daily_max_rate = settings.DAILY_MAX_RATE if daily_max_rate is None else daily_max_rate
    grace_period_minutes = settings.GRACE_PERIOD_MINUTES if grace_period_minutes is None else grace_period_minutes

    # Apply grace period (free)
    if duration_minutes <= grace_period_minutes:
        return 0.0
    
    # Calculate hours (round up)
    hours = (duration_minutes + 59) // 60  # Ceiling division
    
    # Calculate fee
    fee = hours * hourly_rate
    
    # Apply daily maximum cap
    if fee > daily_max_rate:
        fee = daily_max_rate
    
    return round(fee, 2)


def format_duration(minutes: int) -> str:
    """
    Format duration in human-readable format
    
    Args:
        minutes: Duration in minutes
    
    Returns:
        Formatted string like "2h 30m"
    """
    if minutes < 60:
        return f"{minutes}m"
    
    hours = minutes // 60
    mins = minutes % 60
    
    if mins == 0:
        return f"{hours}h"
    
    return f"{hours}h {mins}m"


def get_peak_hours_analysis(logs: list) -> dict:
    """
    Analyze peak hours from entry logs
    
    Args:
        logs: List of entry/exit log objects
    
    Returns:
        Dictionary with hourly distribution
    """
    hourly_counts = {i: 0 for i in range(24)}
    
    for log in logs:
        if log.action == "entry" and log.status == "success":
            hour = log.timestamp.hour
            hourly_counts[hour] += 1
    
    # Find peak hour
    peak_hour = max(hourly_counts, key=hourly_counts.get)
    peak_count = hourly_counts[peak_hour]
    
    return {
        "hourly_distribution": hourly_counts,
        "peak_hour": peak_hour,
        "peak_count": peak_count
    }


def get_occupancy_trend(logs: list, days: int = 7) -> dict:
    """
    Calculate occupancy trend for past N days
    
    Args:
        logs: List of entry/exit log objects
        days: Number of days to analyze
    
    Returns:
        Dictionary with daily occupancy rates
    """
    today = datetime.now().date()
    trend = {}
    
    for i in range(days):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        
        # Count entries and exits for this day
        entries = sum(1 for log in logs if log.timestamp.date() == date and log.action == "entry" and log.status == "success")
        
        trend[date_str] = entries
    
    return trend
