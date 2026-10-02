from fastapi import Header, HTTPException, Depends
from typing import Optional

import os
import jwt
from dotenv import load_dotenv

load_dotenv()

# Set ENABLE_AUTH=true in .env to require JWT auth in development.
# Production always requires authentication even if the flag is omitted or false.
ENABLE_AUTH = os.getenv("ENABLE_AUTH", "false").strip().lower() in {"1", "true", "yes", "on"}
if os.getenv("ENVIRONMENT", "development").strip().lower() == "production":
    ENABLE_AUTH = True

# This should match the JWT_SECRET in your backend/.env
JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    print("WARNING: JWT_SECRET environment variable is not set!")
    if ENABLE_AUTH:
        raise RuntimeError("JWT_SECRET must be configured when ENABLE_AUTH is enabled")

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
