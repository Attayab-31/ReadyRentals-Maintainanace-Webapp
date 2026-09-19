from __future__ import annotations

import mimetypes
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from app.config import Settings, get_settings


class Storage(ABC):
    """File storage behind a single interface (local disk or S3-compatible)."""

    @abstractmethod
    def save(self, data: bytes, key: str, content_type: str | None = None) -> str:
        """Persist bytes and return a URL/key the API can store on the work order."""

    @abstractmethod
    def read_bytes(self, url_or_key: str) -> bytes:
        """Read file contents for PDF embedding."""

    @abstractmethod
    def exists(self, url_or_key: str) -> bool:
        ...

    @abstractmethod
    def delete(self, url_or_key: str) -> None:
        """Delete one stored object if it exists."""

    @abstractmethod
    def delete_prefix(self, prefix: str) -> None:
        """Delete all stored objects under a key prefix."""

    @abstractmethod
    def download_url(self, url_or_key: str) -> str:
        """Return a URL suitable for browser downloads and image sources."""


class LocalStorage(Storage):
    def __init__(self, root: str | Path, public_base_url: str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.public_base_url = public_base_url.rstrip("/")

    def save(self, data: bytes, key: str, content_type: str | None = None) -> str:  # noqa: ARG002
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{self.public_base_url}/files/{key}"

    def _path_from(self, url_or_key: str) -> Path:
        prefix = f"{self.public_base_url}/files/"
        key = url_or_key[len(prefix):] if url_or_key.startswith(
            prefix) else url_or_key
        parsed = urlparse(key)
        if parsed.scheme:
            key = parsed.path.lstrip("/")
            if key.startswith("files/"):
                key = key[len("files/"):]
        return self.root / key

    def read_bytes(self, url_or_key: str) -> bytes:
        path = self._path_from(url_or_key)
        return path.read_bytes()

    def exists(self, url_or_key: str) -> bool:
        return self._path_from(url_or_key).is_file()

    def delete(self, url_or_key: str) -> None:
        self._path_from(url_or_key).unlink(missing_ok=True)

    def delete_prefix(self, prefix: str) -> None:
        path = self._path_from(prefix.rstrip("/") + "/")
        if path.is_dir():
            shutil.rmtree(path)

    def download_url(self, url_or_key: str) -> str:
        return url_or_key


class S3Storage(Storage):
    def __init__(self, settings: Settings) -> None:
        import boto3

        self.bucket = settings.s3_bucket
        kwargs: dict = {"region_name": settings.s3_region}
        if settings.s3_endpoint_url:
            kwargs["endpoint_url"] = settings.s3_endpoint_url
        if settings.s3_access_key_id and settings.s3_secret_access_key:
            kwargs["aws_access_key_id"] = settings.s3_access_key_id
            kwargs["aws_secret_access_key"] = settings.s3_secret_access_key
        self.client = boto3.client("s3", **kwargs)
        self.public_base = (settings.s3_public_base_url or "").rstrip("/")
        self.api_base = settings.public_base_url.rstrip("/")

    def save(self, data: bytes, key: str, content_type: str | None = None) -> str:
        extra: dict = {}
        if content_type:
            extra["ContentType"] = content_type
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, **extra)
        if self.public_base:
            return f"{self.public_base}/{key}"
        return f"{self.api_base}/files/{key}"

    def _key(self, url_or_key: str) -> str:
        if url_or_key.startswith("s3://"):
            return url_or_key.split("/", 3)[-1]
        if self.public_base and url_or_key.startswith(self.public_base + "/"):
            return url_or_key[len(self.public_base) + 1:]
        api_prefix = self.api_base + "/files/"
        if url_or_key.startswith(api_prefix):
            return url_or_key[len(api_prefix):]
        return url_or_key.lstrip("/")

    def download_url(self, url_or_key: str) -> str:
        if self.public_base and url_or_key.startswith(self.public_base + "/"):
            return url_or_key
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": self._key(url_or_key)},
            ExpiresIn=900,
        )

    def read_bytes(self, url_or_key: str) -> bytes:
        obj = self.client.get_object(
            Bucket=self.bucket, Key=self._key(url_or_key))
        return obj["Body"].read()

    def exists(self, url_or_key: str) -> bool:
        try:
            self.client.head_object(
                Bucket=self.bucket, Key=self._key(url_or_key))
            return True
        except Exception:
            return False

    def delete(self, url_or_key: str) -> None:
        self.client.delete_object(
            Bucket=self.bucket, Key=self._key(url_or_key))

    def delete_prefix(self, prefix: str) -> None:
        key_prefix = self._key(prefix)
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=key_prefix):
            objects = [{"Key": item["Key"]}
                       for item in page.get("Contents", [])]
            if objects:
                self.client.delete_objects(
                    Bucket=self.bucket,
                    Delete={"Objects": objects, "Quiet": True},
                )


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        settings = get_settings()
        if settings.storage_backend == "s3":
            _storage = S3Storage(settings)
        else:
            _storage = LocalStorage(
                settings.storage_local_dir, settings.public_base_url)
    return _storage


def set_storage(storage: Storage | None) -> None:
    global _storage
    _storage = storage


def unique_key(prefix: str, filename: str) -> str:
    ext = Path(filename).suffix or mimetypes.guess_extension(
        mimetypes.guess_type(filename)[0] or ""
    ) or ".bin"
    return f"{prefix}/{uuid4().hex}{ext}"
