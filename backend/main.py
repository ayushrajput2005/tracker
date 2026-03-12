import uuid
import bcrypt
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional

import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Assignment Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_session(user_id: int, db: DBSession) -> str:
    token = str(uuid.uuid4())
    session = models.Session(token=token, user_id=user_id)
    db.add(session)
    db.commit()
    return token

def get_current_user(
    x_session_token: Optional[str] = Header(default=None),
    db: DBSession = Depends(get_db)
) -> models.User:
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Not logged in.")

    session = db.query(models.Session).filter(
        models.Session.token == x_session_token
    ).first()

    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    return session.owner


@app.post("/signup", response_model=schemas.AuthResponse, status_code=201)
def signup(data: schemas.AuthRequest, db: DBSession = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken.")

    user = models.User(username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_session(user.id, db)
    return {"token": token, "username": user.username}


@app.post("/login", response_model=schemas.AuthResponse)
def login(data: schemas.AuthRequest, db: DBSession = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_session(user.id, db)
    return {"token": token, "username": user.username}


@app.post("/logout", status_code=204)
def logout(
    current_user: models.User = Depends(get_current_user),
    x_session_token: Optional[str] = Header(default=None),
    db: DBSession = Depends(get_db)
):
    session = db.query(models.Session).filter(
        models.Session.token == x_session_token
    ).first()
    if session:
        db.delete(session)
        db.commit()


@app.get("/assignments", response_model=List[schemas.AssignmentOut])
def get_assignments(
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    return db.query(models.Assignment).filter(
        models.Assignment.user_id == current_user.id
    ).all()


@app.post("/assignments", response_model=schemas.AssignmentOut, status_code=201)
def create_assignment(
    data: schemas.AssignmentCreate,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    new_assignment = models.Assignment(
        title=data.title,
        subject=data.subject,
        due_date=data.due_date,
        done=False,
        user_id=current_user.id
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    return new_assignment


@app.patch("/assignments/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(
    assignment_id: int,
    data: schemas.AssignmentUpdate,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id,
        models.Assignment.user_id == current_user.id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    assignment.done = data.done
    db.commit()
    db.refresh(assignment)
    return assignment


@app.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id,
        models.Assignment.user_id == current_user.id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    db.delete(assignment)
    db.commit()
