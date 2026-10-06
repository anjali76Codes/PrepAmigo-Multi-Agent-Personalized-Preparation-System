from fastapi import Header, HTTPException, Depends
from typing import Any, Optional

import os
import jwt
from dotenv import load_dotenv

load_dotenv()

from core.config import settings

# Authentication is required if ENABLE_AUTH=true, or unconditionally in production
ENABLE_AUTH = settings.enable_auth or (settings.environment == "production")
JWT_SECRET = settings.jwt_secret

if not JWT_SECRET:
    if ENABLE_AUTH:
        raise RuntimeError("JWT_SECRET must be configured when ENABLE_AUTH is enabled or ENVIRONMENT=production")

ALGORITHM = "HS256"

def verify_token(authorization: Optional[str] = Header(None)):
    """
    Central authentication dependency for agent endpoints.
    """
    if not ENABLE_AUTH:
        return True
        
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid token format")
    
    token = authorization.split(" ")[1]
    
    try:
        # Decode and verify the JWT token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        # You can access user data here if needed, e.g., payload.get("userId")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Unauthorized: Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")



def resolve_user_id(auth_payload: Any, requested_user_id: str | None) -> str | None:
    """Whose request this is: the verified token's user, or (with auth off)
    the user id the caller named."""
    if auth_payload is True:
        return requested_user_id
    if isinstance(auth_payload, dict):
        value = auth_payload.get("sub") or auth_payload.get("id") or auth_payload.get("userId")
        return str(value) if value else None
    return None
