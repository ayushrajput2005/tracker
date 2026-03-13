# Assignment Tracker

A personal assignment tracker with shared Boards. Log in, add assignments, attach documents, and stay on top of deadlines. Create a Board, share its ID, and let classmates or teammates subscribe to the same set of tasks.

---

## Features

- **User accounts** — sign up / log in / log out. Passwords hashed with bcrypt, sessions via UUID token.
- **Personal assignments** — title, subject, due date. Mark done, undo, delete.
- **File attachments** — optionally attach a document to any assignment or board item.
- **Boards** — create a board, get a sharable Board ID. Share the ID; anyone can look it up.
  - Only the board owner can add or delete items on the board.
  - Any logged-in user can view a board and copy items to their own schedule with one click.
- **Overdue detection** — assignments past their due date are flagged.

---

## Project Structure

```
assignplanner/
├── frontend/
│   ├── index.html       — UI (tab-based: My Assignments + Boards)
│   ├── style.css        — Inter font, flat card design
│   └── script.js        — Auth, assignment logic, board logic; talks to the REST API
├── backend/
│   ├── main.py          — All API routes (FastAPI)
│   ├── database.py      — SQLAlchemy + SQLite setup
│   ├── models.py        — DB models: User, Session, Assignment, Board, BoardAssignment
│   ├── schemas.py       — Pydantic request/response schemas
│   ├── uploads/         — Uploaded attachments stored here
│   └── requirements.txt
├── api-schema.json      — Hand-written API reference
└── README.md
```

---

## Running Locally

```bash
# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Start the backend
cd backend
uvicorn main:app --reload
# API is now at http://localhost:8000
# Interactive docs: http://localhost:8000/docs

# 4. Open the frontend
# Open frontend/index.html in your browser directly,
# or serve it with any static server (e.g. VS Code Live Server).
```

---

## API Summary

All routes except `/signup`, `/login`, and `/uploads/*` require the `X-Session-Token` header (returned on login/signup).

> For full request/response shapes see [`api-schema.json`](./api-schema.json).

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/signup` | Create account, get session token |
| `POST` | `/login` | Log in, get session token |
| `POST` | `/logout` | Invalidate session |

### Personal Assignments

> `POST /assignments` uses `multipart/form-data` (to support optional file upload).
> `PATCH /assignments/{id}` uses `application/json`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/assignments` | List your assignments |
| `POST` | `/assignments` | Add assignment (+ optional file) |
| `PATCH` | `/assignments/{id}` | Toggle done/undo |
| `DELETE` | `/assignments/{id}` | Delete assignment + file |

### Boards

> `POST /boards/{board_id}/assignments` uses `multipart/form-data`.
> Owner-only routes return `403` if called by a non-owner.

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/boards` | Any user | Create board, receive Board ID |
| `GET` | `/boards` | Any user | List your owned boards |
| `GET` | `/boards/{board_id}` | Any user | Look up board by ID |
| `POST` | `/boards/{board_id}/assignments` | **Owner only** | Add assignment to board |
| `DELETE` | `/boards/{board_id}/assignments/{id}` | **Owner only** | Remove from board + delete file |
| `POST` | `/boards/{board_id}/assignments/{id}/add-to-schedule` | Any user | Copy to personal schedule |

### Static Files

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/uploads/{filename}` | Retrieve an uploaded attachment |

---

## Tech Stack

| Part | Tech |
|------|------|
| Frontend | HTML, CSS (Inter font), Vanilla JS |
| Backend | FastAPI (Python) |
| Database | SQLite via SQLAlchemy |
| Auth | Session tokens (UUID), bcrypt password hashing |
| File storage | Local filesystem (`backend/uploads/`) |
