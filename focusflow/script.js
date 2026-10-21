// Profetix FocusFlow
// All data is stored locally in localStorage.

const STORAGE_KEY_SESSIONS = "profetix_focusflow_sessions";
const STORAGE_KEY_THEME = "profetix_focusflow_theme";

let sessions = [];
let activeSessionId = null;

let timerState = {
  phase: "idle", // "idle" | "focus" | "break"
  remainingSeconds: 0,
  plannedFocusSeconds: 0,
  elapsedSeconds: 0,
  intervalId: null,
};

let subjectChart = null;

// DOM refs
const sessionForm = document.getElementById("sessionForm");
const sessionsListEl = document.getElementById("sessionsList");
const todayDateEl = document.getElementById("todayDate");

const activeSessionTitleEl = document.getElementById("activeSessionTitle");
const activeSessionSubjectEl = document.getElementById("activeSessionSubject");
const timeRemainingDisplayEl = document.getElementById("timeRemainingDisplay");
const timerPhaseLabelEl = document.getElementById("timerPhaseLabel");
const plannedMinutesEl = document.getElementById("plannedMinutes");
const elapsedMinutesEl = document.getElementById("elapsedMinutes");
const breakMinutesEl = document.getElementById("breakMinutes");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const endEarlyBtn = document.getElementById("endEarlyBtn");

const distractionButtons = document.querySelectorAll(
  ".distraction-section .pill"
);
const distractionListEl = document.getElementById("distractionList");

const historyBodyEl = document.getElementById("historyBody");

const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIconEl = document.getElementById("themeIcon");
const themeLabelEl = document.getElementById("themeLabel");

const progressRingEl = document.getElementById("progressRing");

// Reflection elements
const reflectionOverlayEl = document.getElementById("reflectionOverlay");
const reflectionSessionTitleEl = document.getElementById(
  "reflectionSessionTitle"
);
const reflectionFormEl = document.getElementById("reflectionForm");
const reflectionSkipBtn = document.getElementById("reflectionSkipBtn");

// ====== UTILITIES ======

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeHM(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return `${mm}:${ss}`;
}

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function safeParseInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// ====== STORAGE ======

function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    sessions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load sessions", e);
    sessions = [];
  }
}

function saveSessionsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save sessions", e);
  }
}

function loadThemeFromStorage() {
  return localStorage.getItem(STORAGE_KEY_THEME);
}

function saveThemeToStorage(theme) {
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

// ====== THEME ======

function applyTheme(theme) {
  const html = document.documentElement;
  html.setAttribute("data-theme", theme);

  if (theme === "dark") {
    themeIconEl.textContent = "🌙";
    themeLabelEl.textContent = "Dark";
  } else {
    themeIconEl.textContent = "☀️";
    themeLabelEl.textContent = "Light";
  }
}

// ====== SESSIONS ======

function createSession({ title, subject, durationMin, breakMin, tasks }) {
  const now = new Date();
  const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  const session = {
    id,
    title,
    subject,
    durationMin,
    breakMin,
    tasks,
    createdAt: now.toISOString(),
    dateKey: todayKey(),
    distractions: [],
    focusedSeconds: 0,
    reflection: null,
    completed: false,
  };

  sessions.push(session);
  saveSessionsToStorage();

  activeSessionId = id;
  resetTimerForSession(session);
  renderAll();
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeSessionId) || null;
}

function setActiveSession(id) {
  activeSessionId = id;
  const session = getActiveSession();
  if (!session) {
    resetTimer();
  } else {
    resetTimerForSession(session);
  }
  renderAll();
}

// ====== TIMER ======

function resetTimerForSession(session) {
  clearInterval(timerState.intervalId);
  timerState.phase = "idle";
  timerState.plannedFocusSeconds = session.durationMin * 60;
  timerState.remainingSeconds = session.durationMin * 60;
  timerState.elapsedSeconds = session.focusedSeconds || 0;
  timerState.intervalId = null;

  updateTimerUI();
}

function resetTimer() {
  clearInterval(timerState.intervalId);
  timerState.phase = "idle";
  timerState.remainingSeconds = 0;
  timerState.plannedFocusSeconds = 0;
  timerState.elapsedSeconds = 0;
  timerState.intervalId = null;
  updateTimerUI();
}

function startTimer() {
  const session = getActiveSession();
  if (!session) return;

  if (timerState.phase === "idle") {
    timerState.phase = "focus";
    if (!timerState.remainingSeconds) {
      timerState.remainingSeconds = session.durationMin * 60;
    }
  } else if (timerState.phase === "break") {
    // starting break
    if (!timerState.remainingSeconds) {
      timerState.remainingSeconds = session.breakMin * 60;
    }
  }

  if (timerState.intervalId) clearInterval(timerState.intervalId);

  timerState.intervalId = setInterval(() => {
    tick();
  }, 1000);

  updateTimerUI();
}

function pauseTimer() {
  clearInterval(timerState.intervalId);
  timerState.intervalId = null;
  updateTimerUI();
}

function tick() {
  if (timerState.remainingSeconds <= 0) {
    onTimerFinishedPhase();
    return;
  }

  timerState.remainingSeconds -= 1;

  if (timerState.phase === "focus") {
    timerState.elapsedSeconds += 1;
    const session = getActiveSession();
    if (session) {
      session.focusedSeconds = timerState.elapsedSeconds;
      saveSessionsToStorage();
    }
  }

  updateTimerUI();
}

function onTimerFinishedPhase() {
  clearInterval(timerState.intervalId);
  timerState.intervalId = null;

  const session = getActiveSession();
  if (!session) {
    resetTimer();
    return;
  }

  if (timerState.phase === "focus") {
    // focus just finished
    timerState.phase = "break";
    timerState.remainingSeconds = session.breakMin * 60;
    updateTimerUI();
    if (session.breakMin > 0) {
      startTimer();
    } else {
      onSessionCompleted(session);
    }
  } else if (timerState.phase === "break") {
    onSessionCompleted(session);
  }
}

function onSessionCompleted(session) {
  timerState.phase = "idle";
  timerState.remainingSeconds = 0;
  timerState.intervalId = null;
  session.completed = true;
  session.focusedSeconds = timerState.elapsedSeconds;
  saveSessionsToStorage();
  openReflectionForSession(session);
  renderAll();
}

function endSessionEarly() {
  const session = getActiveSession();
  if (!session) return;
  clearInterval(timerState.intervalId);
  timerState.intervalId = null;

  session.completed = true;
  session.focusedSeconds = timerState.elapsedSeconds;
  saveSessionsToStorage();

  timerState.phase = "idle";
  timerState.remainingSeconds = 0;

  openReflectionForSession(session);
  renderAll();
}

// ====== TIMER UI ======

function updateTimerUI() {
  const session = getActiveSession();

  if (!session) {
    activeSessionTitleEl.textContent = "None selected";
    activeSessionSubjectEl.textContent = "";
    plannedMinutesEl.textContent = "–";
    elapsedMinutesEl.textContent = "0 min";
    breakMinutesEl.textContent = "–";
    timeRemainingDisplayEl.textContent = "00:00";
    timerPhaseLabelEl.textContent = "Idle";
    startBtn.disabled = true;
    pauseBtn.disabled =
      timerState.phase === "idle" || timerState.intervalId === null;
    endEarlyBtn.disabled = true;
    updateProgressRing(0);
    return;
  }

  activeSessionTitleEl.textContent = session.title;
  activeSessionSubjectEl.textContent = session.subject;
  plannedMinutesEl.textContent = `${session.durationMin} min`;
  breakMinutesEl.textContent = `${session.breakMin} min`;
  elapsedMinutesEl.textContent = `${Math.floor(
    timerState.elapsedSeconds / 60
  )} min`;

  timeRemainingDisplayEl.textContent = formatTimeHM(
    timerState.remainingSeconds
  );

  let label = "Idle";
  if (timerState.phase === "focus") label = "Focus";
  if (timerState.phase === "break") label = "Break";
  timerPhaseLabelEl.textContent = label;

  const totalSeconds =
    timerState.phase === "break"
      ? session.breakMin * 60 || 1
      : session.durationMin * 60 || 1;

  const progressed =
    timerState.phase === "focus"
      ? timerState.elapsedSeconds
      : totalSeconds - timerState.remainingSeconds;

  const ratio = Math.max(0, Math.min(1, progressed / totalSeconds));
  updateProgressRing(ratio);

  startBtn.disabled = session.completed;
  pauseBtn.disabled = timerState.intervalId === null;
  endEarlyBtn.disabled = session.completed || timerState.phase === "idle";
}

function updateProgressRing(ratio) {
  if (!progressRingEl) return;
  const circumference = 2 * Math.PI * 70; // r=70 (see CSS)
  const offset = circumference - circumference * ratio;
  progressRingEl.style.strokeDasharray = `${circumference}`;
  progressRingEl.style.strokeDashoffset = `${offset}`;
}

// ====== DISTRACTIONS ======

function addDistraction(kind) {
  const session = getActiveSession();
  if (!session) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    at: new Date().toISOString(),
  };
  session.distractions.push(entry);
  saveSessionsToStorage();
  renderDistractionList(session);
  renderHistory();
}

function renderDistractionList(session) {
  const distractions = session ? session.distractions : [];

  if (!distractions || distractions.length === 0) {
    distractionListEl.classList.add("empty-state");
    distractionListEl.innerHTML = "<li>No distractions logged yet.</li>";
    return;
  }

  distractionListEl.classList.remove("empty-state");
  distractionListEl.innerHTML = "";
  distractions
    .slice()
    .reverse()
    .forEach((d) => {
      const li = document.createElement("li");
      const time = new Date(d.at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      li.textContent = `${time} – ${d.kind}`;
      distractionListEl.appendChild(li);
    });
}

// ====== RENDER SESSIONS ======

function renderSessions() {
  const todaySessions = sessions.filter((s) => s.dateKey === todayKey());

  if (todaySessions.length === 0) {
    sessionsListEl.classList.add("empty-state");
    sessionsListEl.innerHTML =
      "<p>No sessions yet. Create one above to get started.</p>";
    return;
  }

  sessionsListEl.classList.remove("empty-state");
  sessionsListEl.innerHTML = "";

  todaySessions
    .slice()
    .reverse()
    .forEach((session) => {
      const div = document.createElement("div");
      div.className = "session-item";
      if (session.id === activeSessionId) {
        div.style.outline = "1px solid rgba(129, 140, 248, 0.9)";
      }

      const header = document.createElement("div");
      header.className = "session-item-header";

      const titleEl = document.createElement("div");
      titleEl.className = "session-item-title";
      titleEl.textContent = session.title;

      const badgesEl = document.createElement("div");
      badgesEl.className = "session-item-badges";

      const subjectTag = document.createElement("span");
      subjectTag.className = "session-item-tag";
      subjectTag.textContent = session.subject;

      badgesEl.appendChild(subjectTag);

      header.appendChild(titleEl);
      header.appendChild(badgesEl);

      const meta = document.createElement("div");
      meta.className = "session-item-meta";
      const durationSpan = document.createElement("span");
      durationSpan.textContent = `${session.durationMin} min focus`;
      const breakSpan = document.createElement("span");
      breakSpan.textContent = `${session.breakMin} min break`;

      const statusSpan = document.createElement("span");
      statusSpan.textContent = session.completed ? "Completed" : "Planned";

      meta.appendChild(durationSpan);
      meta.appendChild(breakSpan);
      meta.appendChild(statusSpan);

      div.appendChild(header);
      div.appendChild(meta);

      div.addEventListener("click", () => {
        setActiveSession(session.id);
      });

      sessionsListEl.appendChild(div);
    });
}

// ====== HISTORY & STATS ======

function renderHistory() {
  const completedSessions = sessions.filter((s) => s.completed);

  if (completedSessions.length === 0) {
    historyBodyEl.innerHTML =
      '<tr class="empty-row"><td colspan="7">No completed sessions yet.</td></tr>';
  } else {
    historyBodyEl.innerHTML = "";
    completedSessions
      .slice()
      .reverse()
      .forEach((s) => {
        const tr = document.createElement("tr");

        const tdDate = document.createElement("td");
        tdDate.textContent = formatDate(s.createdAt);

        const tdTitle = document.createElement("td");
        tdTitle.textContent = s.title;

        const tdSubject = document.createElement("td");
        tdSubject.textContent = s.subject;

        const tdPlanned = document.createElement("td");
        tdPlanned.textContent = `${s.durationMin} min`;

        const tdFocused = document.createElement("td");
        tdFocused.textContent = `${Math.round((s.focusedSeconds || 0) / 60)} min`;

        const tdDistractions = document.createElement("td");
        tdDistractions.textContent = `${s.distractions.length}`;

        const tdRating = document.createElement("td");
        tdRating.textContent =
          s.reflection && s.reflection.rating ? s.reflection.rating : "–";

        tr.appendChild(tdDate);
        tr.appendChild(tdTitle);
        tr.appendChild(tdSubject);
        tr.appendChild(tdPlanned);
        tr.appendChild(tdFocused);
        tr.appendChild(tdDistractions);
        tr.appendChild(tdRating);

        historyBodyEl.appendChild(tr);
      });
  }

  renderSubjectChart();
}

function renderSubjectChart() {
  const ctx = document.getElementById("subjectChart");
  if (!ctx) return;

  const map = new Map();
  sessions
    .filter((s) => s.completed)
    .forEach((s) => {
      const key = s.subject || "Other";
      const prev = map.get(key) || 0;
      const minutes = Math.round((s.focusedSeconds || 0) / 60);
      map.set(key, prev + minutes);
    });

  const labels = Array.from(map.keys());
  const data = labels.map((label) => map.get(label));

  if (subjectChart) {
    subjectChart.destroy();
  }

  subjectChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Focused minutes",
          data,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 10,
          },
        },
      },
    },
  });
}

// ====== REFLECTION OVERLAY ======

let reflectionSessionId = null;

function openReflectionForSession(session) {
  reflectionSessionId = session.id;
  reflectionSessionTitleEl.textContent = session.title;
  reflectionOverlayEl.classList.remove("hidden");

  // Reset form
  reflectionFormEl.reset();
}

function closeReflectionOverlay() {
  reflectionOverlayEl.classList.add("hidden");
  reflectionSessionId = null;
}

function submitReflection(data) {
  const session = sessions.find((s) => s.id === reflectionSessionId);
  if (!session) {
    closeReflectionOverlay();
    return;
  }
  session.reflection = {
    rating: data.rating ? Number(data.rating) : null,
    wentWell: data.wentWell || "",
    improve: data.improve || "",
  };
  saveSessionsToStorage();
  renderAll();
  closeReflectionOverlay();
}

// ====== RENDER ROOT ======

function renderAll() {
  renderSessions();
  renderHistory();
  const session = getActiveSession();
  renderDistractionList(session);
  updateTimerUI();
}

// ====== EVENT LISTENERS ======

sessionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("sessionTitle").value.trim();
  const subject = document.getElementById("sessionSubject").value.trim();
  const durationMin = safeParseInt(
    document.getElementById("sessionDuration").value,
    25
  );
  const breakMin = safeParseInt(
    document.getElementById("sessionBreak").value,
    5
  );
  const tasksStr = document.getElementById("sessionTasks").value;
  const tasks = tasksStr
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title || !subject) return;

  createSession({ title, subject, durationMin, breakMin, tasks });

  sessionForm.reset();
  document.getElementById("sessionDuration").value = durationMin;
  document.getElementById("sessionBreak").value = breakMin;
});

startBtn.addEventListener("click", () => {
  startTimer();
});

pauseBtn.addEventListener("click", () => {
  pauseTimer();
});

endEarlyBtn.addEventListener("click", () => {
  endSessionEarly();
});

distractionButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.dataset.distraction;
    addDistraction(kind);
  });
});

themeToggleBtn.addEventListener("click", () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  saveThemeToStorage(next);
});

reflectionFormEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const formData = new FormData(reflectionFormEl);
  const rating = formData.get("rating");
  const wentWell = document.getElementById("reflectionWentWell").value.trim();
  const improve = document.getElementById("reflectionImprove").value.trim();

  submitReflection({ rating, wentWell, improve });
});

reflectionSkipBtn.addEventListener("click", () => {
  closeReflectionOverlay();
});

// Close overlay on ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!reflectionOverlayEl.classList.contains("hidden")) {
      closeReflectionOverlay();
    }
  }
});

// ====== INIT ======

function initDateLabel() {
  const d = new Date();
  todayDateEl.textContent = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function initTheme() {
  const stored = loadThemeFromStorage();
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const theme = stored || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

function init() {
  initDateLabel();
  initTheme();
  loadSessionsFromStorage();

  // If there is at least one session today, set latest as active
  const todaySessions = sessions.filter((s) => s.dateKey === todayKey());
  if (todaySessions.length > 0) {
    activeSessionId = todaySessions[todaySessions.length - 1].id;
    resetTimerForSession(getActiveSession());
  }

  renderAll();
}

init();
