/****************************************************
 * CONFIG
 ****************************************************/
const API_BASE = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";

/****************************************************
 * GLOBAL STATE
 ****************************************************/
let currentDate = null;
let currentWeekId = null;
let currentMonthId = null;
let complexes = {};     // from mode=fields
let fields = [];        // from mode=fields

/****************************************************
 * BACKEND FETCHERS
 ****************************************************/
async function fetchDayCalendar(dateStr, schedMode) {
  const url = `${API_BASE}?mode=day_calendar&date=${dateStr}&sched_mode=${schedMode}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchFields() {
  const url = `${API_BASE}?mode=fields`;
  const res = await fetch(url);
  return res.json();
}

/****************************************************
 * INITIAL LOAD
 ****************************************************/
(async function init() {
  const f = await fetchFields();
  complexes = f.complexes;
  fields = f.fields;

  switchView("day");
})();

/****************************************************
 * NAVIGATION
 ****************************************************/
document.querySelectorAll('.nav button').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  if (view === "day") renderDayView();
  if (view === "week") renderWeekView();
  if (view === "month") renderMonthView();
  if (view === "search") renderSearchView();
}

/****************************************************
 * DAY VIEW
 ****************************************************/
async function renderDayView() {
  const container = document.getElementById("view-container");

  if (!currentDate) {
    currentDate = new Date().toISOString().split("T")[0];
  }

  const schedMode = document.getElementById("schedModeSelect").value;

  container.innerHTML = `
    <h2>Day View</h2>
    <div class="controls">
      <button id="prevDay">← Previous</button>
      <span>${currentDate}</span>
      <button id="nextDay">Next →</button>
    </div>
    <div id="dayResults"></div>
  `;

  document.getElementById("prevDay").onclick = () => navigateDay(-1);
  document.getElementById("nextDay").onclick = () => navigateDay(1);

  const data = await fetchDayCalendar(currentDate, schedMode);
  renderDayCalendar(data);
}

function navigateDay(offset) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + offset);
  currentDate = d.toISOString().split("T")[0];
  renderDayView();
}

function renderDayCalendar(data) {
  const container = document.getElementById("dayResults");
  container.innerHTML = "";

  const { availability, events, blocks } = data;

  fields.forEach(fieldId => {
    const card = document.createElement("div");
    card.className = "field-card";

    const title = document.createElement("div");
    title.className = "field-title";
    title.textContent = fieldId;
    card.appendChild(title);

    const merged = mergeTimeline(
      availability[fieldId] || [],
      events[fieldId] || [],
      blocks[fieldId] || []
    );

    if (merged.length === 0) {
      const empty = document.createElement("div");
      empty.className = "window-empty";
      empty.textContent = "No availability";
      card.appendChild(empty);
    } else {
      merged.forEach(slot => {
        const div = document.createElement("div");
        div.className = `block-slot ${slot.cls}`;
        div.textContent = `${slot.start} – ${slot.end}`;

        if (slot.badge) {
          const badgeSpan = document.createElement("span");
          badgeSpan.className = "block-badge";
          badgeSpan.textContent = `[${slot.badge}]`;
          div.appendChild(badgeSpan);
        }

        if (slot.title) {
          div.title = slot.title;
        }

        card.appendChild(div);
      });
    }

    container.appendChild(card);
  });
}

/****************************************************
 * MERGING LOGIC
 ****************************************************/
function mergeTimeline(availWindows, eventList, blockList) {
  const out = [];

  // Free windows
  availWindows.forEach(w => {
    out.push({
      start: w.start,
      end: w.end,
      type: "free",
      title: "",
      cls: "block-free",
      badge: ""
    });
  });

  // Events
  eventList.forEach(ev => {
    const style = getStyle(ev.type);
    out.push({
      start: ev.start,
      end: ev.end,
      type: ev.type,
      title: ev.title,
      cls: style.cls,
      badge: style.badge
    });
  });

  // Blocks
  blockList.forEach(b => {
    const style = getStyle("admin");
    out.push({
      start: b.start,
      end: b.end,
      type: "admin",
      title: b.reason,
      cls: style.cls,
      badge: style.badge
    });
  });

  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function getStyle(type) {
  switch (type) {
    case "game": return { cls: "block-game", badge: "G" };
    case "practice": return { cls: "block-practice", badge: "P" };
    case "admin": return { cls: "block-admin", badge: "A" };
    default: return { cls: "block-free", badge: "" };
  }
}

/****************************************************
 * WEEK VIEW
 ****************************************************/
async function renderWeekView() {
  const container = document.getElementById("view-container");

  if (!currentWeekId) {
    currentWeekId = getWeekId(new Date());
  }

  container.innerHTML = `
    <h2>Week View</h2>
    <div class="controls">
      <button id="prevWeek">← Previous</button>
      <span>${currentWeekId}</span>
      <button id="nextWeek">Next →</button>
    </div>
    <div id="weekResults"></div>
  `;

  document.getElementById("prevWeek").onclick = () => navigateWeek(-1);
  document.getElementById("nextWeek").onclick = () => navigateWeek(1);

  renderWeekCalendar();
}

function navigateWeek(offset) {
  const [year, weekStr] = currentWeekId.split("-W");
  const week = Number(weekStr) + offset;

  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + (week - 1) * 7);

  currentWeekId = getWeekId(d);
  renderWeekView();
}

async function renderWeekCalendar() {
  const container = document.getElementById("weekResults");
  container.innerHTML = "";

  const [year, weekStr] = currentWeekId.split("-W");
  const week = Number(weekStr);

  const start = new Date(year, 0, 1);
  start.setDate(start.getDate() + (week - 1) * 7);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }

  const schedMode = document.getElementById("schedModeSelect").value;

  const grid = document.createElement("div");
  grid.className = "week-grid";

  for (const dateStr of days) {
    const data = await fetchDayCalendar(dateStr, schedMode);

    const dayCard = document.createElement("div");
    dayCard.className = "week-day-card";

    const title = document.createElement("div");
    title.className = "week-day-title";
    title.textContent = dateStr;
    dayCard.appendChild(title);

    const anyAvail = Object.values(data.availability).some(w => w.length > 0);

    const summary = document.createElement("div");
    summary.className = "week-day-summary";
    summary.textContent = anyAvail ? "Available" : "No availability";
    dayCard.appendChild(summary);

    dayCard.onclick = () => {
      currentDate = dateStr;
      switchView("day");
    };

    grid.appendChild(dayCard);
  }

  container.appendChild(grid);
}

/****************************************************
 * MONTH VIEW
 ****************************************************/
async function renderMonthView() {
  const container = document.getElementById("view-container");

  if (!currentMonthId) {
    currentMonthId = new Date().toISOString().substring(0, 7);
  }

  container.innerHTML = `
    <h2>Month View</h2>
    <div class="controls">
      <button id="prevMonth">← Previous</button>
      <span>${currentMonthId}</span>
      <button id="nextMonth">Next →</button>
    </div>
    <div id="monthResults"></div>
  `;

  document.getElementById("prevMonth").onclick = () => navigateMonth(-1);
  document.getElementById("nextMonth").onclick = () => navigateMonth(1);

  renderMonthCalendar();
}

function navigateMonth(offset) {
  const [year, month] = currentMonthId.split("-");
  const d = new Date(Number(year), Number(month) - 1 + offset, 1);
  currentMonthId = d.toISOString().substring(0, 7);
  renderMonthView();
}

async function renderMonthCalendar() {
  const container = document.getElementById("monthResults");
  container.innerHTML = "";

  const [year, month] = currentMonthId.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);

  const schedMode = document.getElementById("schedModeSelect").value;

  const grid = document.createElement("div");
  grid.className = "month-grid";

  while (d.getMonth() === Number(month) - 1) {
    const dateStr = d.toISOString().split("T")[0];

    const dayCard = document.createElement("div");
    dayCard.className = "month-day-card";
    dayCard.textContent = d.getDate();

    dayCard.onclick = () => {
      currentDate = dateStr;
      switchView("day");
    };

    grid.appendChild(dayCard);
    d.setDate(d.getDate() + 1);
  }

  container.appendChild(grid);
}

/****************************************************
 * SEARCH VIEW
 ****************************************************/
async function renderSearchView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Search</h2>
    <div class="controls">
      <input type="time" id="searchTime">
      <button id="searchBtn">Search</button>
    </div>
    <div id="searchResults"></div>
  `;

  document.getElementById("searchBtn").onclick = () => runSearch();
}

async function runSearch() {
  const time = document.getElementById("searchTime").value;
  const container = document.getElementById("searchResults");

  if (!time) {
    container.innerHTML = "<p>Please select a time.</p>";
    return;
  }

  const schedMode = document.getElementById("schedModeSelect").value;

  const results = [];

  // Search next 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    const data = await fetchDayCalendar(dateStr, schedMode);

    Object.keys(data.availability).forEach(fieldId => {
      const windows = data.availability[fieldId];
      windows.forEach(w => {
        if (w.start <= time && w.end >= time) {
          results.push({ date: dateStr, fieldId, window: w });
        }
      });
    });
  }

  if (results.length === 0) {
    container.innerHTML = "<p>No availability found.</p>";
    return;
  }

  container.innerHTML = results
    .map(r => `<div>${r.date} — ${r.fieldId} (${r.window.start}–${r.window.end})</div>`)
    .join("");
}

/****************************************************
 * UTIL: WEEK ID
 ****************************************************/
function getWeekId(d) {
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
  return `${year}-W${week}`;
}
