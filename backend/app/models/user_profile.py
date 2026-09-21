from sqlalchemy import Column, String, DateTime, func
from app.core.database import Base

VALID_ROLES = {"SUPERVISOR", "PLANNER", "PROJECT_MANAGER"}

class UserProfile(Base):
    """
    User profile table mapped to Supabase Auth user identity.
    Stores the confirmed role for role-based access control.
    """
    __tablename__ = "profiles"

    id = Column(String(64), primary_key=True)  # Supabase Auth user UUID
    email = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False)   # SUPERVISOR, PLANNER, or PROJECT_MANAGER
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
