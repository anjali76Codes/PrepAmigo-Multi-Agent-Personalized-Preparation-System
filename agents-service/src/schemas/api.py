"""
Standard API response envelopes for PrepAmigo agent services.
"""
from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response envelope for agent endpoints."""
    success: bool = True
    data: T = Field(description="Response data payload")


class ErrorResponse(BaseModel):
    """Standard error response envelope for agent endpoints."""
    success: bool = False
    error: str = Field(description="Short error identifier or description")
    detail: Optional[str] = Field(default=None, description="Detailed user-friendly error message")
