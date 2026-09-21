import logging
import os
from typing import Optional, Dict, Any
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

# Standard error message required when cloud upload fails
CLOUD_UPLOAD_ERROR_MESSAGE = "Cloud upload failed. The file was not processed as a persistent project file."


class CloudStorageService:
    def __init__(self):
        self.bucket_name = settings.SUPABASE_STORAGE_BUCKET or "infrasync-project-files"
        self.client: Optional[Client] = None
        self._initialize_client()

    def _initialize_client(self):
        url = settings.SUPABASE_URL
        key = settings.SUPABASE_SERVICE_ROLE_KEY
        if url and key and not key.startswith("your-"):
            try:
                self.client = create_client(url, key)
                logger.info(f"Supabase client initialized for project {url}")
            except Exception as exc:
                logger.error(f"Failed to initialize Supabase client: {exc}")
                self.client = None
        else:
            self.client = None

    def is_configured(self) -> bool:
        """Returns True if Supabase credentials are configured and client is ready."""
        return self.client is not None

    def ensure_bucket_exists(self) -> bool:
        """Ensures the private storage bucket exists in Supabase."""
        if not self.is_configured():
            return False
        try:
            buckets = self.client.storage.list_buckets()
            if not any(b.name == self.bucket_name for b in buckets):
                logger.info(f"Creating private Supabase bucket '{self.bucket_name}'...")
                self.client.storage.create_bucket(self.bucket_name, options={"public": False})
            return True
        except Exception as exc:
            logger.warning(f"Could not verify/create bucket '{self.bucket_name}': {exc}")
            # Try continuing in case bucket already exists but listing was restricted
            return True

    def upload_file(
        self,
        file_bytes: bytes,
        storage_path: str,
        content_type: str = "application/octet-stream"
    ) -> Dict[str, Any]:
        """
        Uploads physical file bytes to Supabase Storage in the private bucket.
        Path structure: projects/{project_id}/{file_id}/{original_filename}
        Raises RuntimeError with CLOUD_UPLOAD_ERROR_MESSAGE on failure.
        """
        if not self.is_configured():
            logger.error("Supabase Storage is not configured. Upload rejected.")
            raise RuntimeError(CLOUD_UPLOAD_ERROR_MESSAGE)

        try:
            self.ensure_bucket_exists()
            response = self.client.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": content_type, "upsert": "true"}
            )
            logger.info(f"Uploaded file to Supabase: {self.bucket_name}/{storage_path}")
            return {
                "bucket": self.bucket_name,
                "storage_path": storage_path,
                "file_size": len(file_bytes),
                "response": str(response)
            }
        except Exception as exc:
            logger.error(f"Supabase upload error for '{storage_path}': {exc}")
            raise RuntimeError(CLOUD_UPLOAD_ERROR_MESSAGE) from exc

    def download_file(self, storage_path: str) -> bytes:
        """
        Downloads file bytes from private Supabase Storage bucket.
        """
        if not self.is_configured():
            raise RuntimeError("Cloud storage is not configured.")
        try:
            file_bytes = self.client.storage.from_(self.bucket_name).download(storage_path)
            return file_bytes
        except Exception as exc:
            logger.error(f"Supabase download error for '{storage_path}': {exc}")
            raise RuntimeError(f"Failed to download file from cloud storage: {str(exc)}") from exc

    def create_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """
        Generates a short-lived signed URL for authenticated private file download.
        """
        if not self.is_configured():
            raise RuntimeError("Cloud storage is not configured.")
        try:
            res = self.client.storage.from_(self.bucket_name).create_signed_url(
                path=storage_path,
                expires_in=expires_in
            )
            if isinstance(res, dict) and "signedURL" in res:
                return res["signedURL"]
            return str(res)
        except Exception as exc:
            logger.error(f"Supabase signed URL error for '{storage_path}': {exc}")
            raise RuntimeError(f"Failed to create signed download URL: {str(exc)}") from exc

    def delete_file(self, storage_path: str) -> bool:
        """
        Deletes a file from the private Supabase Storage bucket.
        """
        if not self.is_configured():
            return False
        try:
            self.client.storage.from_(self.bucket_name).remove([storage_path])
            logger.info(f"Deleted file from Supabase: {self.bucket_name}/{storage_path}")
            return True
        except Exception as exc:
            logger.warning(f"Failed to delete file '{storage_path}' from Supabase: {exc}")
            return False

    def get_storage_status(self) -> Dict[str, Any]:
        """
        Returns health status of Supabase cloud storage.
        """
        if not self.is_configured():
            return {
                "status": "not_configured",
                "message": "Supabase Storage credentials not configured.",
                "bucket": self.bucket_name
            }
        try:
            buckets = self.client.storage.list_buckets()
            bucket_names = [b.name for b in buckets]
            return {
                "status": "connected",
                "message": "Supabase Storage connected successfully.",
                "bucket": self.bucket_name,
                "bucket_exists": self.bucket_name in bucket_names,
                "available_buckets": bucket_names
            }
        except Exception as exc:
            return {
                "status": "error",
                "message": f"Supabase Storage error: {str(exc)}",
                "bucket": self.bucket_name
            }


# Global singleton instance
cloud_storage = CloudStorageService()
