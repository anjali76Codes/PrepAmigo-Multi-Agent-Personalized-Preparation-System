from pydantic import BaseModel, Field
from typing import Optional, Literal, List

class AssessmentQuestion(BaseModel):
    id: str = Field(description="Unique question ID")
    sprint: int
    day: int
    topic_title: str
    type: str = Field(default="mcq", description="Extensible question type")
    question: str
    options: Optional[List[str]] = Field(default=None, description="Options for MCQ")
    correct_answer: str = Field(description="Letter of the correct option: A, B, C or D")
    explanation: str
    difficulty: str = Field(default="medium", description="easy, medium or hard")
    concept: Optional[str] = Field(default=None, description="The concept the question tests")

class Assessment(BaseModel):
    version: str = "1.0"
    questions: List[AssessmentQuestion]
