import logging
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.services.cloud_storage import cloud_storage

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


class SupabaseAuthService:
    """
    Validates Supabase access tokens against Supabase Auth.
    Does not require storing passwords in local DB or custom password hashing.
    """
    def __init__(self):
        pass

    def get_user_from_token(self, token: str) -> Dict[str, Any]:
        """
        Validates the provided Bearer access token with Supabase Auth.
        Returns the user payload or raises HTTPException.
        """
        if not cloud_storage.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service is not configured."
            )

        try:
            # Validate token using Supabase client
            response = cloud_storage.client.auth.get_user(token)
            if not response or not response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            user = response.user
            return {
                "id": str(user.id),
                "email": user.email,
                "role": getattr(user, "role", "authenticated"),
                "app_metadata": getattr(user, "app_metadata", {}),
                "user_metadata": getattr(user, "user_metadata", {}),
                "created_at": str(getattr(user, "created_at", "")),
            }
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning(f"Failed to validate Supabase token: {exc}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication token validation failed: {str(exc)}",
                headers={"WWW-Authenticate": "Bearer"},
            )


auth_service = SupabaseAuthService()


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    FastAPI dependency requiring a valid Supabase Bearer token.
    Raises HTTP 401 if missing or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth_service.get_user_from_token(credentials.credentials)


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency that returns user dict if valid Bearer token provided,
    or None if unauthenticated / no token passed.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return auth_service.get_user_from_token(credentials.credentials)
    except HTTPException:
        return None


def get_user_profile_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Queries PostgreSQL profiles table by Supabase user UUID.
    Returns dictionary representation of the profile or None.
    """
    from app.core.database import SessionLocal
    from app.models.user_profile import UserProfile
    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
        if profile:
            return profile.to_dict()
        return None
    except Exception as exc:
        logger.warning(f"Error querying user profile for {user_id}: {exc}")
        return None
    finally:
        db.close()


def get_current_user_role(user: Dict[str, Any] = Depends(get_current_user)) -> Optional[str]:
    """
    FastAPI dependency that resolves the authenticated user's confirmed role from PostgreSQL.
    Returns the role string ('SUPERVISOR', 'PLANNER', 'PROJECT_MANAGER') or None.
    """
    user_id = user.get("id")
    if not user_id:
        return None
    profile = get_user_profile_by_id(user_id)
    return profile.get("role") if profile else None


def require_roles(*allowed_roles: str):
    """
    FastAPI dependency factory enforcing Role-Based Access Control (RBAC).
    Validates Supabase Bearer token, extracts user ID, queries PostgreSQL profiles table,
    and ensures user's confirmed role is in allowed_roles.
    Raises HTTP 403 Forbidden if not authorized.
    """
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Invalid user context."
            )

        profile = get_user_profile_by_id(user_id)
        if not profile or not profile.get("role"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: User role not assigned."
            )

        user_role = profile["role"]
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Insufficient role permissions. Required one of: {', '.join(allowed_roles)}"
            )

        user["role"] = user_role
        user["profile"] = profile
        return user

    return role_checker