# Assignment Tracker

A personal assignment tracker built to stop missing deadlines. Log in, add assignments with a subject and due date, and keep track of what's done and what isn't. Nothing overcomplicated — just something that actually works.

Each user has their own isolated list, so multiple people can use the same instance without mixing up their stuff.

---

## What it does

- **User accounts** — sign up, log in, log out. Passwords are hashed, sessions are token-based.
- **Add assignments** — give it a title, subject, and due date.
- **Mark done / undo** — toggle completion status anytime.
- **Delete** — remove assignments you no longer need.
- **Per-user data** — your assignments are yours only.

---

## Project Structure

```
assignplanner/
├── frontend/
│   ├── index.html       ← The whole UI lives here
│   ├── style.css
│   └── script.js        ← Handles auth + assignment logic, talks to the API
└── backend/
    ├── main.py          ← All API routes (FastAPI)
    ├── database.py      ← SQLAlchemy + SQLite setup
    ├── models.py        ← DB table definitions
    ├── schemas.py       ← Request/response shapes
    └── requirements.txt
```

---

## API

All assignment routes require a `X-Session-Token` header (returned on login/signup).

| Method   | URL                  | What it does                |
|----------|----------------------|-----------------------------|
| `POST`   | `/signup`            | Create a new account        |
| `POST`   | `/login`             | Log in, get a session token |
| `POST`   | `/logout`            | Invalidate session          |
| `GET`    | `/assignments`       | Get your assignments        |
| `POST`   | `/assignments`       | Add a new assignment        |
| `PATCH`  | `/assignments/{id}`  | Mark done / undo            |
| `DELETE` | `/assignments/{id}`  | Delete an assignment        |

---

## Tech Stack

| Part      | Tech                                    |
|-----------|-----------------------------------------|
| Frontend  | HTML, CSS, Vanilla JavaScript           |
| Backend   | FastAPI (Python)                        |
| Database  | SQLite via SQLAlchemy                   |
| Auth      | Session tokens (UUID), bcrypt passwords |

---

## TODO

- **Board system**
  - Coaches create a board with a unique board ID
  - Students join by entering the board ID — no invite needed
  - Assignments posted to a board show up for all subscribed students
  - AI-assisted planning: suggest deadlines, flag overloaded weeks, help break big tasks into smaller ones
