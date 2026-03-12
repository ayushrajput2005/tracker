# Assignment Tracker

A simple student assignment tracker built with plain HTML/CSS/JS frontend and a FastAPI + SQLite backend.

---

## Project Structure

```
assignplanner/
├── index.html          ← Frontend (open this in a browser)
├── style.css
├── script.js
└── backend/
    ├── main.py         ← FastAPI app (all API routes)
    ├── database.py     ← SQLite + SQLAlchemy setup
    ├── models.py       ← Database table definition
    ├── schemas.py      ← Request/response data shapes
    └── requirements.txt
```

---

## Running Locally

### 1. Set up Python environment

Open a terminal in the project folder:

```bash
# Create a virtual environment (keep dependencies isolated)
python3 -m venv venv

# Activate it
source venv/bin/activate        # Linux / Mac
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. Start the backend server

```bash
cd backend
uvicorn main:app --reload
```

The API will be running at: **http://localhost:8000**

Auto-generated API docs (very useful!): **http://localhost:8000/docs**

### 3. Open the frontend

Just open `index.html` in your browser directly (double-click or right-click → Open with browser).

The frontend will connect to the backend at `http://localhost:8000/assignments`.

---

## API Endpoints

| Method   | URL                        | What it does           |
|----------|----------------------------|------------------------|
| `GET`    | `/assignments`             | Get all assignments    |
| `POST`   | `/assignments`             | Add a new assignment   |
| `PATCH`  | `/assignments/{id}`        | Mark done / undo       |
| `DELETE` | `/assignments/{id}`        | Delete assignment      |

### Quick test with curl

```bash
# Add an assignment
curl -X POST http://localhost:8000/assignments \
  -H "Content-Type: application/json" \
  -d '{"title":"Lab Report","subject":"Physics","due_date":"2026-03-20"}'

# List all
curl http://localhost:8000/assignments

# Mark done (replace 1 with the actual id)
curl -X PATCH http://localhost:8000/assignments/1 \
  -H "Content-Type: application/json" \
  -d '{"done": true}'

# Delete
curl -X DELETE http://localhost:8000/assignments/1
```

---

## Deploying the Project

### Backend → Deploy on Render (free)

[Render](https://render.com) can host your FastAPI app for free.

**Steps:**

1. Push your project to a GitHub repo

2. Go to [render.com](https://render.com) → **New → Web Service**

3. Connect your GitHub repo

4. Fill in these settings:

   | Setting          | Value                              |
   |------------------|------------------------------------|
   | Root Directory   | `backend`                          |
   | Build Command    | `pip install -r requirements.txt`  |
   | Start Command    | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
   | Instance Type    | Free                               |

5. Click **Create Web Service**

6. Render gives you a URL like: `https://assignplanner.onrender.com`

> **Note:** Free Render instances spin down after 15 minutes of inactivity. The first request after that takes ~30 seconds to wake up.

> **Database note:** Render's free tier uses an ephemeral file system — the SQLite file resets on redeploy. For persistent data, use [Render's free PostgreSQL](https://render.com/docs/databases) and change `DATABASE_URL` in `database.py`.

---

### Frontend → Deploy on Netlify Drop (free, instant)

Your frontend is just three static files — no build step needed.

**Steps:**

1. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)**

2. Drag and drop the three files (`index.html`, `style.css`, `script.js`) onto the page

3. Netlify gives you a public URL immediately (e.g. `https://cheerful-otter-123.netlify.app`)

4. **Update the API URL in `script.js`:**

   ```js
   // Change this line:
   const API_URL = "http://localhost:8000/assignments";
   
   // To your Render URL:
   const API_URL = "https://assignplanner.onrender.com/assignments";
   ```

5. Re-deploy (just drag the files again with the updated `script.js`)

---

### Alternative Frontend Hosting: GitHub Pages

If your project is on GitHub:

1. Go to your repo → **Settings → Pages**
2. Set Source to `main` branch, root folder `/`
3. GitHub gives you a URL like `https://yourusername.github.io/assignplanner`
4. Update `API_URL` in `script.js` as above

---

## Tech Stack

| Part      | Technology                    |
|-----------|-------------------------------|
| Frontend  | HTML, CSS, Vanilla JavaScript |
| Backend   | FastAPI (Python)              |
| Database  | SQLite (local) via SQLAlchemy |
| Deploy    | Render (backend) + Netlify (frontend) |
