from fastapi import Header, HTTPException, Depends
from typing import Optional

import os
import jwt
from dotenv import load_dotenv

load_dotenv()

# Set this flag to True to require authentication for all agents, 
# or False to bypass authentication (useful for development/testing)
ENABLE_AUTH = False

# This should match the JWT_SECRET in your backend/.env
JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    print("WARNING: JWT_SECRET environment variable is not set!")

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
