"""
System commands API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.services.mqtt_service import mqtt_service
from app.models.schemas import BarrierCommand, EmergencyCommand

router = APIRouter(prefix="/api/commands", tags=["System Commands"])


@router.post("/open-barrier")
def open_barrier(
    command: BarrierCommand,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually open specific barrier (entrance or exit)
    """
    if command.gate not in ["entrance", "exit"]:
        raise HTTPException(status_code=400, detail="Invalid gate. Use 'entrance' or 'exit'")
    
    success = mqtt_service.open_barrier(command.gate)
    
    if success:
        return {
            "message": f"Command sent to open {command.gate} barrier",
            "gate": command.gate,
            "status": "sent"
        }
    else:
        raise HTTPException(
            status_code=503,
            detail="Failed to send command. MQTT connection might be down."
        )


@router.post("/emergency")
def set_emergency_mode(
    command: EmergencyCommand,
    current_user: dict = Depends(get_current_user)
):
    """
    Enable/disable emergency mode (opens all barriers)
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admin users can control emergency mode"
        )
    
    success = mqtt_service.set_emergency_mode(command.enable)
    
    if success:
        return {
            "message": f"Emergency mode {'enabled' if command.enable else 'disabled'}",
            "emergency_mode": command.enable,
            "status": "sent"
        }
    else:
        raise HTTPException(
            status_code=503,
            detail="Failed to send command. MQTT connection might be down."
        )


@router.post("/refresh-status")
def refresh_status(current_user: dict = Depends(get_current_user)):
    """
    Request ESP32 to send current status update
    """
    success = mqtt_service.request_status()
    
    if success:
        return {
            "message": "Status refresh requested",
            "status": "sent"
        }
    else:
        raise HTTPException(
            status_code=503,
            detail="Failed to send command. MQTT connection might be down."
        )


@router.post("/scan-mode")
def activate_scan_mode(
    command: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Activate/deactivate card scan mode on ESP32
    Allows scanning a card to get its UID without authorization check
    """
    enable = command.get("enable", True)
    gate = command.get("gate", "entrance")
    
    if gate not in ["entrance", "exit"]:
        raise HTTPException(status_code=400, detail="Invalid gate. Use 'entrance' or 'exit'")
    
    success = mqtt_service.send_command("scan_mode", {
        "enable": enable,
        "gate": gate
    })
    
    if success:
        return {
            "message": f"Scan mode {'activated' if enable else 'deactivated'} on {gate} gate",
            "scan_mode": enable,
            "gate": gate,
            "status": "sent"
        }
    else:
        raise HTTPException(
            status_code=503,
            detail="Failed to send command. MQTT connection might be down."
        )


@router.get("/mqtt-status")
def get_mqtt_status():
    """
    Get current MQTT connection status
    """
    return {
        "connected": mqtt_service.connected,
        "broker": f"{mqtt_service.client._host if mqtt_service.client else 'N/A'}",
        "status": "online" if mqtt_service.connected else "offline"
    }
