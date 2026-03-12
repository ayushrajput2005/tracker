const API_URL = "https://tracker-0l8g.onrender.com";

// --- Session helpers ---
function getToken()    { return localStorage.getItem("session_token"); }
function getUsername() { return localStorage.getItem("username"); }

function saveSession(token, username) {
  localStorage.setItem("session_token", token);
  localStorage.setItem("username", username);
}

function clearSession() {
  localStorage.removeItem("session_token");
  localStorage.removeItem("username");
  localStorage.removeItem("assignments_cache");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Session-Token": getToken()
  };
}

// --- DOM refs ---
const authScreen    = document.getElementById("authScreen");
const appScreen     = document.getElementById("appScreen");
const tabLogin      = document.getElementById("tabLogin");
const tabSignup     = document.getElementById("tabSignup");
const authUsername  = document.getElementById("authUsername");
const authPassword  = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authError     = document.getElementById("authError");
const welcomeMsg    = document.getElementById("welcomeMsg");
const logoutBtn     = document.getElementById("logoutBtn");

const titleInput  = document.getElementById("title");
const subjectInput= document.getElementById("subject");
const dueDateInput= document.getElementById("dueDate");
const addBtn      = document.getElementById("addBtn");
const listEl      = document.getElementById("assignmentList");
const emptyMsg    = document.getElementById("emptyMsg");
const filterBtns  = document.querySelectorAll(".filter-btn");

let assignments   = [];
let currentFilter = "all";
let authMode      = "login";

// --- Auth tab toggle ---
tabLogin.addEventListener("click", () => {
  authMode = "login";
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  authSubmitBtn.textContent = "Login";
  authError.textContent = "";
});

tabSignup.addEventListener("click", () => {
  authMode = "signup";
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  authSubmitBtn.textContent = "Sign Up";
  authError.textContent = "";
});

[authUsername, authPassword].forEach(input => {
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") handleAuth();
  });
});

authSubmitBtn.addEventListener("click", handleAuth);

// --- Auth actions ---
async function handleAuth() {
  const username = authUsername.value.trim();
  const password = authPassword.value;
  authError.textContent = "";

  if (!username || !password) {
    authError.textContent = "Please enter both username and password.";
    return;
  }

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = authMode === "login" ? "Logging in..." : "Creating account...";

  const endpoint = authMode === "login" ? "/login" : "/signup";

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.detail || "Something went wrong.";
      return;
    }

    saveSession(data.token, data.username);
    showApp();

  } catch (err) {
    authError.textContent = "Could not reach the server. Is the backend running?";
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = authMode === "login" ? "Login" : "Sign Up";
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      headers: authHeaders()
    });
  } catch (_) {}

  clearSession();
  showAuthScreen();
}

logoutBtn.addEventListener("click", handleLogout);

// --- Screen switching ---
function showApp() {
  authScreen.style.display = "none";
  appScreen.style.display  = "block";
  welcomeMsg.textContent   = `Logged in as ${getUsername()}`;

  authUsername.value = "";
  authPassword.value = "";
  authError.textContent = "";

  assignments = loadCache();
  renderList();
  loadAssignments();
}

function showAuthScreen() {
  appScreen.style.display  = "none";
  authScreen.style.display = "flex";
  assignments = [];
  renderList();
}

// --- API calls ---
async function loadAssignments() {
  try {
    const res = await fetch(`${API_URL}/assignments`, {
      headers: authHeaders()
    });

    if (res.status === 401) {
      clearSession();
      showAuthScreen();
      return;
    }

    if (!res.ok) throw new Error("Failed to fetch assignments");

    assignments = await res.json();
    saveCache(assignments);
    renderList();
  } catch (err) {
    console.warn("Could not reach backend:", err.message);
    assignments = loadCache();
    showBanner("Could not connect to backend. Showing cached data.");
    renderList();
  }
}

async function addAssignment() {
  const title   = titleInput.value.trim();
  const subject = subjectInput.value.trim();
  const dueDate = dueDateInput.value;

  const today = new Date().toISOString().split("T")[0];
  if (!title || !subject || !dueDate) {
    alert("Please fill in all three fields.");
    return;
  }
  if (dueDate < today) {
    alert("Due date cannot be in the past.");
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = "Adding...";

  try {
    const res = await fetch(`${API_URL}/assignments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title, subject, due_date: dueDate })
    });

    if (!res.ok) throw new Error("Failed to create assignment");

    const created = await res.json();
    assignments.push(created);
    saveCache(assignments);
    titleInput.value = subjectInput.value = dueDateInput.value = "";
    renderList();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = "Add Assignment";
  }
}

async function toggleDone(id) {
  const a = assignments.find(x => x.id === id);
  if (!a) return;

  try {
    const res = await fetch(`${API_URL}/assignments/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ done: !a.done })
    });
    if (!res.ok) throw new Error("Failed to update");

    const updated = await res.json();
    const idx = assignments.findIndex(x => x.id === id);
    assignments[idx] = updated;
    saveCache(assignments);
    renderList();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function deleteAssignment(id) {
  try {
    const res = await fetch(`${API_URL}/assignments/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete");

    assignments = assignments.filter(x => x.id !== id);
    saveCache(assignments);
    renderList();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

// --- Cache ---
function saveCache(data) {
  localStorage.setItem("assignments_cache", JSON.stringify(data));
}

function loadCache() {
  const s = localStorage.getItem("assignments_cache");
  return s ? JSON.parse(s) : [];
}

// --- Rendering ---
function isOverdue(d) {
  return d < new Date().toISOString().split("T")[0];
}

function renderList() {
  listEl.innerHTML = "";

  let filtered = assignments;
  if (currentFilter === "pending") filtered = assignments.filter(a => !a.done);
  if (currentFilter === "done")    filtered = assignments.filter(a =>  a.done);

  emptyMsg.style.display = filtered.length === 0 ? "block" : "none";

  filtered.forEach(a => {
    const card = document.createElement("div");
    card.classList.add("assignment-card");
    if (a.done) card.classList.add("done");

    const overdueClass = (!a.done && isOverdue(a.due_date)) ? "overdue" : "";
    const parts    = a.due_date.split("-");
    const niceDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

    card.innerHTML = `
      <div class="card-info">
        <div class="card-title">${a.title}</div>
        <div class="card-meta">
          <span>Subject: ${a.subject}</span>
          <span class="${overdueClass}">Due: ${niceDate}${!a.done && isOverdue(a.due_date) ? " (Overdue)" : ""}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-done" data-id="${a.id}">${a.done ? "Undo" : "Done"}</button>
        <button class="btn-delete" data-id="${a.id}">Delete</button>
      </div>
    `;
    listEl.appendChild(card);
  });

  document.querySelectorAll(".btn-done").forEach(btn => {
    btn.addEventListener("click", () => toggleDone(Number(btn.dataset.id)));
  });

  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this assignment?")) deleteAssignment(Number(btn.dataset.id));
    });
  });
}

function showBanner(msg) {
  let b = document.getElementById("errorBanner");
  if (!b) {
    b = document.createElement("p");
    b.id = "errorBanner";
    b.style.cssText = "color:#c0392b;font-size:0.85rem;margin-bottom:12px;";
    listEl.before(b);
  }
  b.textContent = msg;
}

// --- Filters ---
filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

addBtn.addEventListener("click", addAssignment);

[titleInput, subjectInput, dueDateInput].forEach(input => {
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") addAssignment();
  });
});

// --- Init ---
const todayStr = new Date().toISOString().split("T")[0];
dueDateInput.min = todayStr;

if (getToken()) {
  showApp();
} else {
  showAuthScreen();
}
