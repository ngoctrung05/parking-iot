"""
Application configuration using Pydantic Settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "IoT Parking Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite:///./parking.db"
    
    # MQTT (HiveMQ Cloud Configuration)
    MQTT_BROKER_HOST: str = "your-cluster.s1.eu.hivemq.cloud"  # Replace with your HiveMQ Cloud cluster URL
    MQTT_BROKER_PORT: int = 8883  # TLS/SSL port
    MQTT_USERNAME: str = ""  # Required: Set in .env file
    MQTT_PASSWORD: str = ""  # Required: Set in .env file
    MQTT_KEEPALIVE: int = 60
    MQTT_USE_TLS: bool = True  # Enable TLS/SSL for HiveMQ Cloud
    MQTT_CA_CERTS: str = ""  # Optional: Path to CA certificate (empty = use system certs)
    MQTT_TLS_INSECURE: bool = False  # Set True to skip cert verification (NOT for production)
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Admin
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_EMAIL: str = "admin@parking.local"
    
    # Parking
    TOTAL_PARKING_SLOTS: int = 10
    HOURLY_RATE: float = 5.0
    DAILY_MAX_RATE: float = 50.0
    GRACE_PERIOD_MINUTES: int = 15
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:8000,http://127.0.0.1:8000"
    
    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # SMTP Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_FROM_EMAIL: str = "noreply@parking.local"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )
    
    def validate_production_config(self):
        """Validate critical settings for production deployment"""
        import secrets
        
        if not self.DEBUG:
            # Production mode checks
            if self.SECRET_KEY == "your-secret-key-change-this-in-production":
                raise ValueError(
                    "❌ CRITICAL: Using default SECRET_KEY in production! "
                    "Set SECRET_KEY in .env file. Generate with: openssl rand -hex 32"
                )
            
            if self.ADMIN_PASSWORD == "admin123":
                import logging
                logging.warning(
                    "⚠️  WARNING: Using default admin password 'admin123' in production! "
                    "Change ADMIN_PASSWORD in .env immediately."
                )
        else:
            # Development mode warnings
            if self.SECRET_KEY == "your-secret-key-change-this-in-production":
                import logging
                logging.warning(
                    "⚠️  Using default SECRET_KEY in development. "
                    "For production, set SECRET_KEY in .env"
                )


settings = Settings()
settings.validate_production_config()
