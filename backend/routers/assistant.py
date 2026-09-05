"""
RecoverAI - Merchant Assistant Chat Router
"""

from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.assistant import merchant_assistant

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])


class AssistantChatRequest(BaseModel):
    message: str


@router.post("/chat")
def chat_with_assistant(req: AssistantChatRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    return merchant_assistant.answer_query(db, req.message)
