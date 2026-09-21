from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_optional_current_user, get_user_profile_by_id
from app.core.database import get_db
from app.models.user_profile import UserProfile, VALID_ROLES
from app.services.cloud_storage import cloud_storage

router = APIRouter()


class AssignRoleRequest(BaseModel):
    role: str = Field(..., description="Role to assign: SUPERVISOR, PLANNER, or PROJECT_MANAGER")


@router.get("/status")
def auth_status() -> Dict[str, Any]:
    """
    Returns authentication service configuration status.
    """
    return {
        "status": "connected" if cloud_storage.is_configured() else "not_configured",
        "provider": "supabase_auth",
        "auth_method": "email_password"
    }


@router.get("/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Validates the caller's Supabase access token and returns user details.
    """
    return {
        "authenticated": True,
        "user": user
    }


@router.get("/profile")
def get_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieves the confirmed role profile for the authenticated user from PostgreSQL.
    """
    user_id = current_user.get("id")
    email = current_user.get("email", "")
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    return {
        "id": user_id,
        "email": email,
        "role": profile.role if profile else None,
        "profile": profile.to_dict() if profile else None
    }


@router.post("/role")
def assign_role(
    payload: AssignRoleRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Assigns or updates the role (SUPERVISOR, PLANNER, PROJECT_MANAGER) for the authenticated user.
    """
    user_id = current_user.get("id")
    email = current_user.get("email", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing user identity."
        )

    selected_role = payload.role.strip().upper()
    if selected_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}"
        )

    # Fetch or create user profile in PostgreSQL
    existing_profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()

    if existing_profile:
        existing_profile.role = selected_role
        existing_profile.email = email
    else:
        existing_profile = UserProfile(
            id=user_id,
            email=email,
            role=selected_role
        )
        db.add(existing_profile)

    db.commit()
    db.refresh(existing_profile)

    # Attempt to sync with Supabase user_metadata if admin client available
    try:
        if cloud_storage.is_configured():
            cloud_storage.client.auth.admin.update_user_by_id(
                user_id,
                {"user_metadata": {"role": selected_role}}
            )
    except Exception:
        # DB persistence is the primary source of truth; metadata sync failure is non-fatal
        pass

    return {
        "success": True,
        "message": f"Role '{selected_role}' confirmed successfully.",
        "profile": existing_profile.to_dict()
    }


@router.delete("/account")
def delete_account(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Permanently deletes the currently authenticated user's account from Supabase Auth
    and cleans up their local profile record.
    Strictly uses the user ID extracted from the validated Bearer token.
    Never accepts a user ID parameter from the client.
    Uses backend-only service-role credentials.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to determine user ID from authentication token."
        )

    # Remove local profile
    try:
        db.query(UserProfile).filter(UserProfile.id == user_id).delete()
        db.commit()
    except Exception:
        db.rollback()

    if not cloud_storage.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured."
        )

    try:
        # Administrative deletion via Supabase service-role client
        cloud_storage.client.auth.admin.delete_user(user_id)
        return {
            "success": True,
            "message": "Account permanently deleted.",
            "deleted_user_id": user_id
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to permanently delete account: {str(exc)}"
        )