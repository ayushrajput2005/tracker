from pydantic import BaseModel


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

    class Config:
        from_attributes = True
