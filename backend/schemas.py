from pydantic import BaseModel
from typing import List, Optional


class AuthRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    token: str
    username: str


class AssignmentCreate(BaseModel):
    title: str
    subject: str
    due_date: str

class AssignmentUpdate(BaseModel):
    done: bool

class AssignmentOut(BaseModel):
    id: int
    title: str
    subject: str
    due_date: str
    done: bool
    doc_name: Optional[str] = None
    doc_path: Optional[str] = None

    class Config:
        from_attributes = True


# ── Boards ─────────────────────────────────────────────

class BoardCreate(BaseModel):
    name: str

class BoardAssignmentCreate(BaseModel):
    title: str
    subject: str
    due_date: str

class BoardAssignmentOut(BaseModel):
    id: int
    title: str
    subject: str
    due_date: str
    doc_name: Optional[str] = None
    doc_path: Optional[str] = None

    class Config:
        from_attributes = True

class BoardOut(BaseModel):
    id: int
    board_id: str
    name: str
    owner_username: str
    assignments: List[BoardAssignmentOut] = []

    class Config:
        from_attributes = True
