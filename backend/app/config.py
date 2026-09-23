from functools import lru_cache
from typing import Any, Literal
import urllib.parse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str | None) -> str:
    default_url = "sqlite+pysqlite:///./work_orders.db"
    if not url or not str(url).strip():
        return default_url
    url = str(url).strip()

    # Handle passwords containing special characters (such as unencoded '@')
    scheme_part, sep, rest = url.partition("://")
    if sep:
        authority, slash, path = rest.partition("/")
        if authority.count("@") > 1:
            user_info, host_port = authority.rsplit("@", 1)
            user, colon, passwd = user_info.partition(":")
            if colon:
                encoded_passwd = urllib.parse.quote(urllib.parse.unquote(passwd), safe="")
                authority = f"{user}:{encoded_passwd}@{host_port}"
            url = f"{scheme_part}://{authority}{slash}{path}"

    # psycopg v3 is installed (not psycopg2). Map postgres:// and postgresql:// to postgresql+psycopg://
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]

    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+pysqlite:///./work_orders.db"

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_database_url(cls, v: Any) -> str:
        if v is None:
            return "sqlite+pysqlite:///./work_orders.db"
        return normalize_database_url(str(v))

    jwt_secret: str = "change-me-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    public_base_url: str = "http://localhost:8000"
    # Frontend web app URL (e.g. https://readyrentalsonline.com).
    # Used to generate worker links (/wo/:token). If not set, falls back to public_base_url.
    frontend_base_url: str | None = None
    enable_test_ui: bool = False
    # Comma-separated frontend origins for the separately hosted React app.
    # Production must be explicit (not "*"). Example: https://app.example.com
    cors_origins: str = ""

    owner_code: str = "READY-RENTALS-OWNER-2026"
    owner_email: str | None = None
    owner_password: str | None = None
    owner_name: str = "John USA"

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
    mail_from_name: str = "Ready Rentals Online"
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    smtp_ssl: bool = False
    sendgrid_api_key: str = ""

    company_name: str = "Ready Rentals Online"
    company_phone: str = "(800) 555-0199"
    company_email: str = "support@readyrentalsonline.com"
    company_website: str = "https://readyrentalsonline.com"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    max_upload_mb: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
