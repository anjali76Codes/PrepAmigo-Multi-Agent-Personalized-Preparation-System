from fastapi import Header, HTTPException, Depends
from typing import Optional

def verify_token(authorization: Optional[str] = Header(None)):
    """
    Central authentication dependency for agent endpoints.
    Currently commented out to allow testing without tokens.
    Uncomment the logic below and replace 'YOUR_SECRET_TOKEN' with actual validation
    when you are ready to enable token protection for all agents.
    """
    # if not authorization or not authorization.startswith("Bearer "):
    #     raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid token")
    # token = authorization.split(" ")[1]
    # if token != "YOUR_SECRET_TOKEN":  # Replace with your actual token validation logic
    #     raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
    
    return True
