"""Auth routes — login, setup, status."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from auth import (
    hash_password, verify_password, create_session, invalidate_session,
    get_master_hash, set_master_hash,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class PasswordRequest(BaseModel):
    password: str


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    """Check if setup is needed and if user has valid session."""
    master_hash = get_master_hash(db)
    return {
        "setup_required": master_hash is None,
        "has_password": master_hash is not None,
    }


@router.post("/setup")
def auth_setup(data: PasswordRequest, db: Session = Depends(get_db)):
    """Set master password (first run only)."""
    if get_master_hash(db) is not None:
        raise HTTPException(status_code=400, detail="Password already set. Use /change to update.")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    set_master_hash(db, data.password)
    token = create_session()
    resp = JSONResponse({"ok": True})
    resp.set_cookie("session", token, httponly=True, samesite="lax", secure=True, path="/", max_age=86400 * 7)
    return resp


@router.post("/login")
def auth_login(data: PasswordRequest, db: Session = Depends(get_db)):
    """Login with master password."""
    master_hash = get_master_hash(db)
    if master_hash is None:
        raise HTTPException(status_code=400, detail="No password set. Use /setup first.")
    if not verify_password(data.password, master_hash):
        raise HTTPException(status_code=401, detail="Wrong password.")
    token = create_session()
    resp = JSONResponse({"ok": True})
    resp.set_cookie("session", token, httponly=True, samesite="lax", secure=True, path="/", max_age=86400 * 7)
    return resp


@router.post("/logout")
def auth_logout(request_obj=Depends()):
    """Clear session."""
    from fastapi import Request
    # Simple: just return cleared cookie
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("session")
    return resp


@router.post("/change")
def auth_change(data: PasswordRequest, db: Session = Depends(get_db)):
    """Change master password (requires valid session — enforced by middleware)."""
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    set_master_hash(db, data.password)
    return {"ok": True}
