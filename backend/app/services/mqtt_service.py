"""
MQTT Client Service for communicating with ESP32 parking system
"""
import paho.mqtt.client as mqtt
import json
import logging
from typing import Callable, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import EntryExitLog, ParkingSlot, SystemEvent, EventSeverity
from app.services.parking_service import calculate_parking_fee

logger = logging.getLogger(__name__)


class MQTTService:
    def __init__(self):
        self.client: Optional[mqtt.Client] = None
        self.connected = False
        self.message_callbacks = []
        
    def on_connect(self, client, userdata, flags, rc):
        """Callback when connected to MQTT broker"""
        if rc == 0:
            self.connected = True
            logger.info("✓ Connected to MQTT Broker")
            
            # Subscribe to all parking topics
            client.subscribe("parking/events/entry")
            client.subscribe("parking/events/exit")
            client.subscribe("parking/events/scan")
            client.subscribe("parking/system")
            
            logger.info("✓ Subscribed to parking topics")
            
            # Log system event
            db = SessionLocal()
            try:
                event = SystemEvent(
                    event_type="mqtt_connected",
                    severity=EventSeverity.INFO,
                    description="MQTT broker connected successfully"
                )
                db.add(event)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to log system event: {e}")
            finally:
                db.close()
        else:
            logger.error(f"✗ Failed to connect to MQTT Broker, code: {rc}")
            self.connected = False
    
    def on_disconnect(self, client, userdata, rc):
        """Callback when disconnected from MQTT broker"""
        self.connected = False
        logger.warning(f"⚠ Disconnected from MQTT Broker, code: {rc}")
        
        # Log system event
        db = SessionLocal()
        try:
            event = SystemEvent(
                event_type="mqtt_disconnected",
                severity=EventSeverity.WARNING,
                description=f"MQTT broker disconnected, code: {rc}"
            )
            db.add(event)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log system event: {e}")
        finally:
            db.close()
    
    def on_message(self, client, userdata, msg):
        """Callback when message received from MQTT broker"""
        try:
            topic = msg.topic
            payload = msg.payload.decode()
            logger.info(f"📨 MQTT Message on {topic}: {payload}")
            
            # Parse JSON payload
            data = json.loads(payload)
            
            # Process based on topic
            if topic == "parking/events/entry":
                self.handle_entry_event(data)
            elif topic == "parking/events/exit":
                self.handle_exit_event(data)
            elif topic == "parking/events/scan":
                self.handle_scan_event(data)
            elif topic == "parking/system":
                self.handle_system_status(data)
            
            # Notify all registered callbacks
            for callback in self.message_callbacks:
                try:
                    callback(topic, data)
                except Exception as callback_error:
                    logger.error(f"Error in message callback: {callback_error}")
                
        except json.JSONDecodeError:
            logger.error(f"✗ Invalid JSON in MQTT message: {payload}")
        except Exception as e:
            logger.error(f"✗ Error processing MQTT message: {e}")
    
    def handle_entry_event(self, data: dict):
        """Handle vehicle entry event from ESP32"""
        db = SessionLocal()
        try:
            # Create entry log
            log = EntryExitLog(
                card_uid=data.get("card_uid"),
                slot_id=data.get("slot_id") if data.get("slot_id", 0) > 0 else None,
                action="entry",
                gate=data.get("gate", "entrance"),
                status=data.get("status", "success"),
                timestamp=datetime.fromtimestamp(data.get("timestamp", datetime.utcnow().timestamp()))
            )
            db.add(log)
            
            # Update parking slot if entry was successful
            if data.get("status") == "success" and data.get("slot_id"):
                slot = db.query(ParkingSlot).filter(ParkingSlot.slot_id == data["slot_id"]).first()
                if slot:
                    slot.status = "occupied"
                    slot.current_card_uid = data.get("card_uid")
                    slot.entry_time = datetime.fromtimestamp(data.get("timestamp", datetime.utcnow().timestamp()))
            
            db.commit()
            logger.info(f"✓ Entry event logged: {data.get('card_uid')} -> Slot {data.get('slot_id')}")
            
        except Exception as e:
            logger.error(f"✗ Failed to handle entry event: {e}")
            db.rollback()
        finally:
            db.close()
    
    def handle_exit_event(self, data: dict):
        """Handle vehicle exit event from ESP32"""
        db = SessionLocal()
        try:
            # Calculate parking fee
            slot_id = data.get("slot_id")
            duration_minutes = 0
            fee_amount = 0.0
            
            if slot_id and data.get("status") == "success":
                slot = db.query(ParkingSlot).filter(ParkingSlot.slot_id == slot_id).first()
                if slot and slot.entry_time:
                    exit_time = datetime.fromtimestamp(data.get("timestamp", datetime.utcnow().timestamp()))
                    duration_minutes = int((exit_time - slot.entry_time).total_seconds() / 60)
                    fee_amount = calculate_parking_fee(duration_minutes)
                    
                    # Update slot
                    slot.status = "available"
                    slot.current_card_uid = None
                    slot.exit_time = exit_time
            
            # Create exit log
            log = EntryExitLog(
                card_uid=data.get("card_uid"),
                slot_id=slot_id if slot_id and slot_id > 0 else None,
                action="exit",
                gate=data.get("gate", "exit"),
                status=data.get("status", "success"),
                timestamp=datetime.fromtimestamp(data.get("timestamp", datetime.utcnow().timestamp())),
                duration_minutes=duration_minutes if duration_minutes > 0 else None,
                fee_amount=fee_amount if fee_amount > 0 else None
            )
            db.add(log)
            
            db.commit()
            logger.info(f"✓ Exit event logged: {data.get('card_uid')} from Slot {slot_id}, Fee: ${fee_amount:.2f}")
            
        except Exception as e:
            logger.error(f"✗ Failed to handle exit event: {e}")
            db.rollback()
        finally:
            db.close()
    
    def handle_scan_event(self, data: dict):
        """Handle card scan event from ESP32 scan mode"""
        card_uid = data.get("card_uid")
        logger.info(f"🔍 Card scanned in scan mode: {card_uid}")
        
        # Event is automatically forwarded to WebSocket clients via message_callbacks
        # Frontend will handle duplicate detection and form population
    
    def handle_system_status(self, data: dict):
        """Handle system status update from ESP32"""
        logger.info(f"📊 System Status: {data.get('occupied_slots')}/{data.get('total_slots')} occupied")
        
        # You can add logic here to sync slot status if needed
        # This is useful if ESP32 restarts and we need to sync state
    
    def start(self):
        """Start MQTT client and connect to broker"""
        try:
            self.client = mqtt.Client(client_id="ParkingBackend")
            
            # Set callbacks
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message
            
            # Set username/password (REQUIRED for HiveMQ Cloud)
            if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
                self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
                logger.info(f"✓ MQTT authentication configured for user: {settings.MQTT_USERNAME}")
            else:
                logger.warning("⚠ MQTT username/password not set - connection may fail on HiveMQ Cloud")
            
            # Configure TLS/SSL for HiveMQ Cloud
            if settings.MQTT_USE_TLS:
                import ssl
                logger.info("Configuring TLS/SSL for MQTT connection...")
                
                # Determine certificate verification mode
                if settings.MQTT_TLS_INSECURE:
                    cert_reqs = ssl.CERT_NONE
                    logger.warning("⚠ TLS certificate verification DISABLED - NOT recommended for production!")
                else:
                    cert_reqs = ssl.CERT_REQUIRED
                    logger.info("✓ TLS certificate verification ENABLED")
                
                # Configure TLS
                self.client.tls_set(
                    ca_certs=settings.MQTT_CA_CERTS if settings.MQTT_CA_CERTS else None,
                    cert_reqs=cert_reqs,
                    tls_version=ssl.PROTOCOL_TLS
                )
                
                # For HiveMQ Cloud, we can skip hostname verification if needed
                if settings.MQTT_TLS_INSECURE:
                    self.client.tls_insecure_set(True)
                
                logger.info("✓ TLS/SSL configuration complete")
            
            # Connect to broker
            logger.info(f"Connecting to MQTT Broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}")
            self.client.connect(
                settings.MQTT_BROKER_HOST,
                settings.MQTT_BROKER_PORT,
                settings.MQTT_KEEPALIVE
            )
            
            # Start network loop in background thread
            self.client.loop_start()
            logger.info("✓ MQTT client started")
            
        except Exception as e:
            logger.error(f"✗ Failed to start MQTT client: {e}")
            raise
    
    def stop(self):
        """Stop MQTT client"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("✓ MQTT client stopped")
    
    def publish(self, topic: str, message: dict):
        """Publish message to MQTT broker"""
        if not self.connected:
            logger.warning("⚠ MQTT not connected, cannot publish")
            return False
        
        try:
            payload = json.dumps(message)
            result = self.client.publish(topic, payload, qos=1)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"✓ Published to {topic}: {payload}")
                return True
            else:
                logger.error(f"✗ Failed to publish to {topic}")
                return False
        except Exception as e:
            logger.error(f"✗ Error publishing to MQTT: {e}")
            return False
    
    def send_command(self, command: str, data: dict = None):
        """Send command to ESP32"""
        message = {"command": command}
        if data:
            message.update(data)
        return self.publish("parking/commands", message)
    
    def open_barrier(self, gate: str):
        """Send command to open specific barrier"""
        return self.send_command("open_barrier", {"gate": gate})
    
    def set_emergency_mode(self, enable: bool):
        """Enable/disable emergency mode"""
        return self.send_command("emergency", {"enable": enable})
    
    def request_status(self):
        """Request status update from ESP32"""
        return self.send_command("get_status")
    
    def register_callback(self, callback: Callable):
        """Register callback for MQTT messages"""
        self.message_callbacks.append(callback)


# Global MQTT service instance
mqtt_service = MQTTService()
