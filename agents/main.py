import os
import time
from datetime import datetime, timezone
from fastapi import FastAPI

app = FastAPI()

# Track the application start time for uptime calculation
START_TIME = time.time()

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": time.time() - START_TIME,
        "environment": os.getenv("ENVIRONMENT", "development"),
    }