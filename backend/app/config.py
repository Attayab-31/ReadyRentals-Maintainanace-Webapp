from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+pysqlite:///./work_orders.db"
    jwt_secret: str = "change-me-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    public_base_url: str = "http://localhost:8000"
    enable_test_ui: bool = False
    # Comma-separated frontend origins for the separately hosted React app.
    # Production must be explicit (not "*"). Example: https://app.example.com
    cors_origins: str = ""

    admin_email: str | None = None
    admin_password: str | None = None
    admin_name: str = "Property Manager"

    storage_backend: Literal["local", "s3"] = "local"
    storage_local_dir: str = "./storage_data"
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_public_base_url: str | None = None

    email_backend: Literal["smtp", "sendgrid", "log"] = "log"
    mail_from: str = "noreply@example.com"
    mail_from_name: str = "Maintenance Work Orders"
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    sendgrid_api_key: str = ""

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    max_upload_mb: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
