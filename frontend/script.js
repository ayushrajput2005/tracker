const API_URL = "https://tracker-0l8g.onrender.com";

// ── Session helpers ──────────────────────────────────────────────────────────
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
  return { "X-Session-Token": getToken() };
}

// ── DOM refs ─────────────────────────────────────────────────────────────────
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

const titleInput   = document.getElementById("title");
const subjectInput = document.getElementById("subject");
const dueDateInput = document.getElementById("dueDate");
const assignDocInput = document.getElementById("assignDoc");
const addBtn       = document.getElementById("addBtn");
const listEl       = document.getElementById("assignmentList");
const emptyMsg     = document.getElementById("emptyMsg");
const filterBtns   = document.querySelectorAll(".filter-btn");

const tabBtns      = document.querySelectorAll(".tab-btn");
const panelA       = document.getElementById("panelAssignments");
const panelB       = document.getElementById("panelBoards");

const boardNameInput     = document.getElementById("boardName");
const createBoardBtn     = document.getElementById("createBoardBtn");
const newBoardIdBox      = document.getElementById("newBoardIdBox");
const newBoardIdText     = document.getElementById("newBoardIdText");
const copyBoardIdBtn     = document.getElementById("copyBoardIdBtn");
const searchBoardIdInput = document.getElementById("searchBoardId");
const searchBoardBtn     = document.getElementById("searchBoardBtn");
const searchError        = document.getElementById("searchError");
const boardsListView     = document.getElementById("boardsListView");
const boardDetailView    = document.getElementById("boardDetailView");
const boardDetailName    = document.getElementById("boardDetailName");
const boardDetailOwner   = document.getElementById("boardDetailOwner");
const closeBoardDetail   = document.getElementById("closeBoardDetail");
const boardAddAssForm    = document.getElementById("boardAddAssignmentForm");
const boardAssTitleInput = document.getElementById("boardAssTitle");
const boardAssSubjectInput = document.getElementById("boardAssSubject");
const boardAssDateInput  = document.getElementById("boardAssDate");
const boardAssDocInput   = document.getElementById("boardAssDoc");
const boardAddAssBtn     = document.getElementById("boardAddAssBtn");
const boardAssignmentList = document.getElementById("boardAssignmentList");
const boardEmptyMsg      = document.getElementById("boardEmptyMsg");
const myBoardsCards      = document.getElementById("myBoardsCards");
const myBoardsEmpty      = document.getElementById("myBoardsEmpty");

let assignments   = [];
let currentFilter = "all";
let authMode      = "login";
let currentBoard  = null;

// ── Tab switching ─────────────────────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    const which = btn.dataset.tab;
    panelA.style.display = which === "assignments" ? "block" : "none";
    panelB.style.display = which === "boards"      ? "block" : "none";
    if (which === "boards") loadMyBoards();
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
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
[authUsername, authPassword].forEach(el => el.addEventListener("keydown", e => { if (e.key === "Enter") handleAuth(); }));
authSubmitBtn.addEventListener("click", handleAuth);

async function handleAuth() {
  const username = authUsername.value.trim();
  const password = authPassword.value;
  authError.textContent = "";
  if (!username || !password) { authError.textContent = "Please fill in both fields."; return; }

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = authMode === "login" ? "Logging in…" : "Creating account…";
  try {
    const res  = await fetch(`${API_URL}/${authMode}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { authError.textContent = data.detail || "Something went wrong."; return; }
    saveSession(data.token, data.username);
    showApp();
  } catch {
    authError.textContent = "Could not reach the server.";
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = authMode === "login" ? "Login" : "Sign Up";
  }
}

logoutBtn.addEventListener("click", async () => {
  try { await fetch(`${API_URL}/logout`, { method: "POST", headers: authHeaders() }); } catch {}
  clearSession(); showAuthScreen();
});

// ── Screen switching ──────────────────────────────────────────────────────────
function showApp() {
  authScreen.style.display = "none";
  appScreen.style.display  = "block";
  welcomeMsg.textContent   = `Logged in as ${getUsername()}`;
  authUsername.value = authPassword.value = "";
  authError.textContent = "";
  // reset to assignments tab
  tabBtns.forEach(t => t.classList.remove("active"));
  tabBtns[0].classList.add("active");
  panelA.style.display = "block";
  panelB.style.display = "none";
  assignments = loadCache();
  renderList();
  loadAssignments();
}
function showAuthScreen() {
  appScreen.style.display  = "none";
  authScreen.style.display = "flex";
  assignments = []; renderList();
}

// ── Personal Assignments ──────────────────────────────────────────────────────
async function loadAssignments() {
  try {
    const res = await fetch(`${API_URL}/assignments`, { headers: authHeaders() });
    if (res.status === 401) { clearSession(); showAuthScreen(); return; }
    if (!res.ok) throw new Error();
    assignments = await res.json();
    saveCache(assignments); renderList();
  } catch {
    assignments = loadCache();
    renderList();
  }
}

async function addAssignment() {
  const title   = titleInput.value.trim();
  const subject = subjectInput.value.trim();
  const dueDate = dueDateInput.value;
  const today   = new Date().toISOString().split("T")[0];
  if (!title || !subject || !dueDate) { alert("Please fill in all fields."); return; }
  if (dueDate < today) { alert("Due date cannot be in the past."); return; }

  addBtn.disabled = true; addBtn.textContent = "Adding…";
  try {
    const fd = new FormData();
    fd.append("title", title);
    fd.append("subject", subject);
    fd.append("due_date", dueDate);
    if (assignDocInput.files[0]) fd.append("document", assignDocInput.files[0]);

    const res = await fetch(`${API_URL}/assignments`, {
      method: "POST", headers: authHeaders(), body: fd
    });
    if (!res.ok) throw new Error("Failed to create assignment");
    const created = await res.json();
    assignments.push(created);
    saveCache(assignments);
    titleInput.value = subjectInput.value = dueDateInput.value = "";
    assignDocInput.value = "";
    renderList();
  } catch (err) { alert(err.message); }
  finally { addBtn.disabled = false; addBtn.textContent = "Add Assignment"; }
}

async function toggleDone(id) {
  const a = assignments.find(x => x.id === id);
  if (!a) return;
  try {
    const res = await fetch(`${API_URL}/assignments/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ done: !a.done })
    });
    if (!res.ok) throw new Error();
    const updated = await res.json();
    assignments[assignments.findIndex(x => x.id === id)] = updated;
    saveCache(assignments); renderList();
  } catch { alert("Could not update."); }
}

async function deleteAssignment(id) {
  try {
    const res = await fetch(`${API_URL}/assignments/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error();
    assignments = assignments.filter(x => x.id !== id);
    saveCache(assignments); renderList();
  } catch { alert("Could not delete."); }
}

// ── Cache ─────────────────────────────────────────────────────────────────────
function saveCache(d) { localStorage.setItem("assignments_cache", JSON.stringify(d)); }
function loadCache()  { const s = localStorage.getItem("assignments_cache"); return s ? JSON.parse(s) : []; }

// ── Render assignments ────────────────────────────────────────────────────────
function isOverdue(d) { return d < new Date().toISOString().split("T")[0]; }

function fmtDate(d) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function docLink(doc_name, doc_path) {
  if (!doc_name || !doc_path) return "";
  return `<div class="card-doc"><a href="${API_URL}/uploads/${doc_path}" target="_blank">Attachment: ${doc_name}</a></div>`;
}

function renderList() {
  listEl.innerHTML = "";
  let filtered = assignments;
  if (currentFilter === "pending") filtered = assignments.filter(a => !a.done);
  if (currentFilter === "done")    filtered = assignments.filter(a =>  a.done);
  emptyMsg.style.display = filtered.length === 0 ? "block" : "none";

  filtered.forEach(a => {
    const card = document.createElement("div");
    card.className = "assignment-card" + (a.done ? " done" : "");
    const od = !a.done && isOverdue(a.due_date);
    card.innerHTML = `
      <div class="card-info">
        <div class="card-title">${a.title}</div>
        <div class="card-meta">
          <span>${a.subject}</span>
          <span class="${od ? "overdue" : ""}">Due ${fmtDate(a.due_date)}${od ? " — Overdue" : ""}</span>
        </div>
        ${docLink(a.doc_name, a.doc_path)}
      </div>
      <div class="card-actions">
        <button class="btn-done" data-id="${a.id}">${a.done ? "Undo" : "Done"}</button>
        <button class="btn-delete" data-id="${a.id}">Delete</button>
      </div>`;
    listEl.appendChild(card);
  });

  listEl.querySelectorAll(".btn-done").forEach(b =>
    b.addEventListener("click", () => toggleDone(Number(b.dataset.id))));
  listEl.querySelectorAll(".btn-delete").forEach(b =>
    b.addEventListener("click", () => {
      if (confirm("Delete this assignment?")) deleteAssignment(Number(b.dataset.id));
    }));
}

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

addBtn.addEventListener("click", addAssignment);
[titleInput, subjectInput, dueDateInput].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") addAssignment(); }));

// ── BOARDS ────────────────────────────────────────────────────────────────────

// Create board
createBoardBtn.addEventListener("click", async () => {
  const name = boardNameInput.value.trim();
  if (!name) { alert("Enter a board name."); return; }
  createBoardBtn.disabled = true; createBoardBtn.textContent = "Creating…";
  try {
    const res = await fetch(`${API_URL}/boards`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error();
    const board = await res.json();
    boardNameInput.value = "";
    newBoardIdText.textContent = board.board_id;
    newBoardIdBox.style.display = "flex";
    loadMyBoards();
  } catch { alert("Failed to create board."); }
  finally { createBoardBtn.disabled = false; createBoardBtn.textContent = "Create"; }
});

copyBoardIdBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(newBoardIdText.textContent).then(() => {
    copyBoardIdBtn.textContent = "Copied!";
    setTimeout(() => { copyBoardIdBtn.textContent = "Copy"; }, 1400);
  });
});

// Load my boards
async function loadMyBoards() {
  try {
    const res = await fetch(`${API_URL}/boards`, { headers: authHeaders() });
    if (!res.ok) throw new Error();
    renderMyBoards(await res.json());
  } catch {}
}

function renderMyBoards(boards) {
  myBoardsCards.innerHTML = "";
  myBoardsEmpty.style.display = boards.length === 0 ? "block" : "none";
  boards.forEach(b => {
    const card = document.createElement("div");
    card.className = "board-card";
    card.innerHTML = `
      <div>
        <div class="board-card-name">${b.name}</div>
        <div class="board-card-id">${b.board_id}</div>
      </div>
      <div class="board-card-actions">
        <button class="btn-copy btn-cid" data-id="${b.board_id}">Copy ID</button>
        <button class="btn-view btn-manage" data-id="${b.board_id}">Manage</button>
      </div>`;
    myBoardsCards.appendChild(card);
  });
  myBoardsCards.querySelectorAll(".btn-cid").forEach(b => b.addEventListener("click", () => {
    navigator.clipboard.writeText(b.dataset.id).then(() => {
      b.textContent = "Copied!"; setTimeout(() => { b.textContent = "Copy ID"; }, 1400);
    });
  }));
  myBoardsCards.querySelectorAll(".btn-manage").forEach(b =>
    b.addEventListener("click", () => openBoardDetail(b.dataset.id)));
}

// Search board
searchBoardBtn.addEventListener("click", async () => {
  const id = searchBoardIdInput.value.trim();
  searchError.textContent = "";
  if (!id) { searchError.textContent = "Enter a board ID."; return; }
  searchBoardBtn.disabled = true; searchBoardBtn.textContent = "Searching…";
  try {
    await openBoardDetail(id);
    searchBoardIdInput.value = "";
  } finally {
    searchBoardBtn.disabled = false; searchBoardBtn.textContent = "Search";
  }
});

// Open board detail (drill-down)
async function openBoardDetail(boardId) {
  searchError.textContent = "";
  try {
    const res = await fetch(`${API_URL}/boards/${boardId}`, { headers: authHeaders() });
    if (res.status === 404) { searchError.textContent = "Board not found."; return; }
    if (!res.ok) throw new Error();
    currentBoard = await res.json();
    renderBoardDetail();
    boardsListView.style.display  = "none";
    boardDetailView.style.display = "block";
  } catch { searchError.textContent = "Error fetching board."; }
}

closeBoardDetail.addEventListener("click", () => {
  boardDetailView.style.display = "none";
  boardsListView.style.display  = "block";
  currentBoard = null;
  loadMyBoards();
});

function renderBoardDetail() {
  if (!currentBoard) return;
  const isOwner = currentBoard.owner_username === getUsername();
  boardDetailName.textContent  = currentBoard.name;
  boardDetailOwner.textContent = `by ${currentBoard.owner_username}`;
  boardAddAssForm.style.display = isOwner ? "block" : "none";

  boardAssignmentList.innerHTML = "";
  const items = currentBoard.assignments;
  boardEmptyMsg.style.display = items.length === 0 ? "block" : "none";

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "board-row";
    const actions = isOwner
      ? `<button class="btn-delete btn-del-ba" data-id="${item.id}">Delete</button>`
      : `<button class="btn-schedule btn-sch" data-id="${item.id}">+ My Schedule</button>`;
    row.innerHTML = `
      <div class="card-info">
        <div class="card-title">${item.title}</div>
        <div class="card-meta">
          <span>${item.subject}</span>
          <span>Due ${fmtDate(item.due_date)}</span>
        </div>
        ${docLink(item.doc_name, item.doc_path)}
      </div>
      <div class="card-actions">${actions}</div>`;
    boardAssignmentList.appendChild(row);
  });

  boardAssignmentList.querySelectorAll(".btn-del-ba").forEach(b =>
    b.addEventListener("click", () => {
      if (confirm("Remove this from the board?")) deleteBoardAssignment(currentBoard.board_id, Number(b.dataset.id));
    }));
  boardAssignmentList.querySelectorAll(".btn-sch").forEach(b =>
    b.addEventListener("click", () => addToSchedule(currentBoard.board_id, Number(b.dataset.id), b)));
}

// Add assignment to board (owner)
boardAddAssBtn.addEventListener("click", async () => {
  if (!currentBoard) return;
  const title   = boardAssTitleInput.value.trim();
  const subject = boardAssSubjectInput.value.trim();
  const dueDate = boardAssDateInput.value;
  if (!title || !subject || !dueDate) { alert("Fill in all fields."); return; }
  boardAddAssBtn.disabled = true; boardAddAssBtn.textContent = "Adding…";
  try {
    const fd = new FormData();
    fd.append("title", title); fd.append("subject", subject); fd.append("due_date", dueDate);
    if (boardAssDocInput.files[0]) fd.append("document", boardAssDocInput.files[0]);

    const res = await fetch(`${API_URL}/boards/${currentBoard.board_id}/assignments`, {
      method: "POST", headers: authHeaders(), body: fd
    });
    if (!res.ok) throw new Error("Failed to add.");
    const item = await res.json();
    currentBoard.assignments.push(item);
    boardAssTitleInput.value = boardAssSubjectInput.value = boardAssDateInput.value = "";
    boardAssDocInput.value = "";
    renderBoardDetail();
  } catch (err) { alert(err.message); }
  finally { boardAddAssBtn.disabled = false; boardAddAssBtn.textContent = "Add to Board"; }
});

// Delete board assignment (owner)
async function deleteBoardAssignment(boardId, assignmentId) {
  try {
    const res = await fetch(`${API_URL}/boards/${boardId}/assignments/${assignmentId}`, {
      method: "DELETE", headers: authHeaders()
    });
    if (!res.ok) throw new Error();
    currentBoard.assignments = currentBoard.assignments.filter(a => a.id !== assignmentId);
    renderBoardDetail();
  } catch { alert("Could not delete."); }
}

// Add to personal schedule (non-owner)
async function addToSchedule(boardId, assignmentId, btn) {
  btn.disabled = true; btn.textContent = "Adding…";
  try {
    const res = await fetch(
      `${API_URL}/boards/${boardId}/assignments/${assignmentId}/add-to-schedule`,
      { method: "POST", headers: authHeaders() }
    );
    if (!res.ok) throw new Error();
    const created = await res.json();
    assignments.push(created); saveCache(assignments);
    btn.textContent = "✓ Added"; btn.style.color = "var(--green)"; btn.style.borderColor = "var(--green)";
  } catch { alert("Could not add to schedule."); btn.disabled = false; btn.textContent = "+ My Schedule"; }
}

// ── Init ─────────────────────────────────────────────────────────────────────
dueDateInput.min = new Date().toISOString().split("T")[0];
if (getToken()) { showApp(); } else { showAuthScreen(); }
