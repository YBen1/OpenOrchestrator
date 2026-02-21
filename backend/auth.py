"""Simple session-based auth with master password."""
import hashlib, secrets, time
from fastapi import Request, HTTPException
from sqlalchemy.orm import Session

_sessions = {}  # token -> {created_at, last_seen}
SESSION_TTL = 86400 * 7  # 7 days


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def create_session() -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = {"created_at": time.time(), "last_seen": time.time()}
    return token


def validate_session(token: str) -> bool:
    session = _sessions.get(token)
    if not session:
        return False
    if time.time() - session["created_at"] > SESSION_TTL:
        del _sessions[token]
        return False
    session["last_seen"] = time.time()
    return True


def invalidate_session(token: str):
    _sessions.pop(token, None)


async def require_auth(request: Request):
    """FastAPI dependency — checks session cookie or header."""
    token = request.cookies.get("session") or request.headers.get("X-Session-Token")
    if not token or not validate_session(token):
        raise HTTPException(status_code=401, detail="Not authenticated")


def get_master_hash(db: Session) -> str | None:
    """Get stored master password hash from DB."""
    from models import Setting
    s = db.query(Setting).get("_master_password_hash")
    return s.value if s else None


def set_master_hash(db: Session, password: str):
    """Store master password hash in DB."""
    from models import Setting, utcnow
    h = hash_password(password)
    existing = db.query(Setting).get("_master_password_hash")
    if existing:
        existing.value = h
        existing.updated_at = utcnow()
    else:
        db.add(Setting(key="_master_password_hash", value=h))
    db.commit()
