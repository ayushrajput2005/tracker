import uuid
import os
import shutil
import bcrypt
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional

import models
import schemas
from database import engine, get_db

# Auto-create new columns on existing DB by running create_all (adds new tables; for columns
# on existing tables in dev sqlite we drop and recreate if needed)
models.Base.metadata.create_all(bind=engine)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Assignment Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files at /uploads/<filename>
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ── Helpers ───────────────────────────────────────────────────────────────────

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

def save_upload(file: UploadFile) -> tuple[str, str]:
    """Save an uploaded file to disk; returns (original_name, stored_filename)."""
    ext = os.path.splitext(file.filename)[1]
    stored_name = f"{uuid.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, stored_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return file.filename, stored_name

def delete_upload(doc_path: Optional[str]):
    if doc_path:
        target = os.path.join(UPLOAD_DIR, doc_path)
        if os.path.exists(target):
            os.remove(target)


# ── Auth ──────────────────────────────────────────────────────────────────────

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


# ── Personal Assignments ───────────────────────────────────────────────────────

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
    title: str = Form(...),
    subject: str = Form(...),
    due_date: str = Form(...),
    document: Optional[UploadFile] = File(default=None),
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    doc_name, doc_path = (None, None)
    if document and document.filename:
        doc_name, doc_path = save_upload(document)

    new_assignment = models.Assignment(
        title=title,
        subject=subject,
        due_date=due_date,
        done=False,
        user_id=current_user.id,
        doc_name=doc_name,
        doc_path=doc_path,
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
    delete_upload(assignment.doc_path)
    db.delete(assignment)
    db.commit()


# ── Boards ─────────────────────────────────────────────────────────────────────

def _board_out(board: models.Board) -> dict:
    return {
        "id": board.id,
        "board_id": board.board_id,
        "name": board.name,
        "owner_username": board.owner.username,
        "assignments": [
            {
                "id": a.id,
                "title": a.title,
                "subject": a.subject,
                "due_date": a.due_date,
                "doc_name": a.doc_name,
                "doc_path": a.doc_path,
            }
            for a in board.assignments
        ],
    }


@app.get("/boards", response_model=List[schemas.BoardOut])
def list_my_boards(
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    boards = db.query(models.Board).filter(
        models.Board.owner_id == current_user.id
    ).all()
    return [_board_out(b) for b in boards]


@app.post("/boards", response_model=schemas.BoardOut, status_code=201)
def create_board(
    data: schemas.BoardCreate,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    board = models.Board(
        board_id=str(uuid.uuid4()),
        name=data.name,
        owner_id=current_user.id
    )
    db.add(board)
    db.commit()
    db.refresh(board)
    return _board_out(board)


@app.get("/boards/{board_id}", response_model=schemas.BoardOut)
def get_board(
    board_id: str,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    board = db.query(models.Board).filter(
        models.Board.board_id == board_id
    ).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found.")
    return _board_out(board)


@app.post("/boards/{board_id}/assignments", response_model=schemas.BoardAssignmentOut, status_code=201)
def add_board_assignment(
    board_id: str,
    title: str = Form(...),
    subject: str = Form(...),
    due_date: str = Form(...),
    document: Optional[UploadFile] = File(default=None),
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    board = db.query(models.Board).filter(
        models.Board.board_id == board_id
    ).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found.")
    if board.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the board owner can add assignments.")

    doc_name, doc_path = (None, None)
    if document and document.filename:
        doc_name, doc_path = save_upload(document)

    item = models.BoardAssignment(
        title=title,
        subject=subject,
        due_date=due_date,
        board_id=board.id,
        doc_name=doc_name,
        doc_path=doc_path,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/boards/{board_id}/assignments/{assignment_id}", status_code=204)
def delete_board_assignment(
    board_id: str,
    assignment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    board = db.query(models.Board).filter(
        models.Board.board_id == board_id
    ).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found.")
    if board.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the board owner can delete assignments.")

    item = db.query(models.BoardAssignment).filter(
        models.BoardAssignment.id == assignment_id,
        models.BoardAssignment.board_id == board.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Assignment not found on this board.")

    delete_upload(item.doc_path)
    db.delete(item)
    db.commit()


@app.post(
    "/boards/{board_id}/assignments/{assignment_id}/add-to-schedule",
    response_model=schemas.AssignmentOut,
    status_code=201
)
def add_board_assignment_to_schedule(
    board_id: str,
    assignment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    board = db.query(models.Board).filter(
        models.Board.board_id == board_id
    ).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found.")

    item = db.query(models.BoardAssignment).filter(
        models.BoardAssignment.id == assignment_id,
        models.BoardAssignment.board_id == board.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Board assignment not found.")

    personal = models.Assignment(
        title=item.title,
        subject=item.subject,
        due_date=item.due_date,
        done=False,
        user_id=current_user.id,
        # share the same file reference (no copy)
        doc_name=item.doc_name,
        doc_path=item.doc_path,
    )
    db.add(personal)
    db.commit()
    db.refresh(personal)
    return personal
