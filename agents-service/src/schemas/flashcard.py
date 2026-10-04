from pydantic import BaseModel, Field
from typing import Optional, List

class Flashcard(BaseModel):
    id: str = Field(description="Unique card ID")
    sprint: int
    day: int
    topic_title: str
    front: str
    back: str
    difficulty: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class Flashcards(BaseModel):
    version: str = "1.0"
    cards: List[Flashcard]
