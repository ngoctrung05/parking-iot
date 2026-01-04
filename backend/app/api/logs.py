"""
Entry/Exit logs API routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import io
import csv
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import EntryExitLog
from app.models.schemas import EntryExitLogResponse, ActionType

router = APIRouter(prefix="/api/logs", tags=["Entry/Exit Logs"])


@router.get("", response_model=List[EntryExitLogResponse])
def get_logs(
    card_uid: Optional[str] = None,
    slot_id: Optional[int] = None,
    action: Optional[ActionType] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get entry/exit logs with filtering options
    """
    query = db.query(EntryExitLog)
    
    # Apply filters
    if card_uid:
        query = query.filter(EntryExitLog.card_uid == card_uid)
    
    if slot_id is not None:
        query = query.filter(EntryExitLog.slot_id == slot_id)
    
    if action:
        query = query.filter(EntryExitLog.action == action)
    
    if status:
        query = query.filter(EntryExitLog.status == status)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(EntryExitLog.timestamp >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(EntryExitLog.timestamp < end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    # Order by most recent first
    logs = query.order_by(EntryExitLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    return logs


@router.get("/recent", response_model=List[EntryExitLogResponse])
def get_recent_logs(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get most recent logs (for activity feed, requires authentication)
    """
    logs = db.query(EntryExitLog).order_by(
        EntryExitLog.timestamp.desc()
    ).limit(limit).all()
    
    return logs


@router.get("/export")
def export_logs(
    start_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Export logs to CSV format (requires authentication)
    """
    import io
    import csv
    from fastapi.responses import StreamingResponse
    
    query = db.query(EntryExitLog)
    
    # Apply date filters
    if start_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(EntryExitLog.timestamp >= start_dt)
    
    if end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(EntryExitLog.timestamp < end_dt)
    
    logs = query.order_by(EntryExitLog.timestamp.desc()).all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Log ID", "Card UID", "Slot ID", "Action", "Gate", "Status",
        "Timestamp", "Duration (min)", "Fee Amount"
    ])
    
    # Write data
    for log in logs:
        writer.writerow([
            log.log_id,
            log.card_uid,
            log.slot_id or "",
            log.action,
            log.gate,
            log.status,
            log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            log.duration_minutes or "",
            f"${log.fee_amount:.2f}" if log.fee_amount else ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=parking_logs_{datetime.now().strftime('%Y%m%d')}.csv"}
    )
