from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import os
from pathlib import Path

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✓ Loaded environment variables from: {env_path}")
else:
    print(f"⚠️  No .env file found at: {env_path}")

from app.core.config import settings
from app.api.v1.router import api_router

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

app = FastAPI(
    title="UI Capture System API",
    description="Production-ready API for browser automation and workflow management",
    version="1.0.0",
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - Environment-aware configuration
origins = ["*"] if settings.ENVIRONMENT == "development" else settings.ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=(settings.ENVIRONMENT != "development"),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

# Include WebSocket at root level (not under /api prefix)
from app.api.v1.endpoints.websocket import router as ws_router
app.include_router(ws_router)

@app.get("/")
async def root():
    return {
        "message": "UI Capture System API",
        "version": "1.0.0",
        "status": "RUNNING",
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
