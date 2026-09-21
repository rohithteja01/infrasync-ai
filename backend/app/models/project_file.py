from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, BigInteger, DateTime, Boolean, Text
from app.core.database import Base


class ProjectFile(Base):
    __tablename__ = "project_files"

    id = Column(String(64), primary_key=True, index=True)
    project_id = Column(String(64), default="default_project", index=True, nullable=False)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False, default="project_file")
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=False, default=0)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    processing_status = Column(String(50), nullable=False, default="completed")
    is_active = Column(Boolean, nullable=False, default=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self, include_context: bool = False):
        data = {
            "id": self.id,
            "project_id": self.project_id,
            "original_filename": self.original_filename,
            "storage_path": self.storage_path,
            "file_type": self.file_type,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "processing_status": self.processing_status,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_context:
            try:
                data["project_context"] = json.loads(self.metadata_json) if self.metadata_json else None
            except Exception:
                data["project_context"] = None
        return data
