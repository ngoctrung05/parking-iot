"""
WebSocket endpoint for real-time updates
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"✓ WebSocket client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass
        logger.info(f"✗ WebSocket client disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        sent_count = 0
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            try:
                self.active_connections.remove(conn)
            except ValueError:
                pass
        
        if sent_count > 0:
            logger.info(f"✓ Sent message to {sent_count} client(s)")


manager = ConnectionManager()


@router.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time parking updates
    
    Clients receive messages about:
    - Entry/exit events
    - Slot status changes
    - System status updates
    """
    await manager.connect(websocket)
    
    try:
        while True:
            # Keep connection alive and receive messages
            data = await websocket.receive_text()
            
            # Echo back for testing (optional)
            if data == "ping":
                await websocket.send_json({"type": "pong", "timestamp": int(time.time())})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def broadcast_event(event_type: str, data: dict):
    """
    Broadcast event to all WebSocket clients
    
    Args:
        event_type: Type of event (entry, exit, status, error)
        data: Event data dictionary
    """
    message = {
        "type": event_type,
        "data": data,
        "timestamp": int(time.time())
    }
    logger.info(f"📤 Broadcasting to {len(manager.active_connections)} clients: {event_type}")
    await manager.broadcast(message)


# Import this function in other modules to broadcast events
import time
