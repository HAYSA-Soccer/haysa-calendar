/****************************************************
 * STATIC JSON CACHE (updated hourly by GitHub)
 ****************************************************/
const STATIC_JSON_URL = "https://haysa-soccer.github.io/haysa-calendar/data/availability.json";
let cachedFull = null;

async function loadStaticAvailability() {
  if (cachedFull) return cachedFull;
  const response = await fetch(STATIC_JSON_URL);
  cachedFull = await response.json();
  return cachedFull;
}

/****************************************************
 * GLOBAL STATE
 ****************************************************/
let currentDate = null;
let currentWeekId = null;
let currentMonthId = null;

/****************************************************
 * NAVIGATION
 ****************************************************/
document.querySelectorAll('.nav button').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Initial view
switchView("day");

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
  const full = await loadStaticAvailability();
  const container = document.getElementById("view-container");

  // Default to today if not set
  if (!currentDate) {
    currentDate = new Date().toISOString().split("T")[0];
  }

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

  renderDayAvailability(full);
}

function navigateDay(offset) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + offset);
  currentDate = d.toISOString().split("T")[0];
  renderDayView();
}

async function renderDayAvailability(full) {
  const container = document.getElementById("dayResults");

  if (!full.days[currentDate]) {
    container.innerHTML = `<p>No data for ${currentDate} (outside season)</p>`;
    return;
  }

  const data = full.days[currentDate];
  container.innerHTML = "";

  Object.keys(data).forEach(fieldId => {
    const card = document.createElement("div");
    card.className = "field-card";

    const title = document.createElement("div");
    title.className = "field-title";
    title.textContent = fieldId;
    card.appendChild(title);

    const windows = data[fieldId];

    if (!windows || windows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "window-empty";
      empty.textContent = "No availability";
      card.appendChild(empty);
    } else {
      windows.forEach(w => {
        const div = document.createElement("div");
        div.className = "window";
        div.textContent = `${w.start} – ${w.end}`;
        card.appendChild(div);
      });
    }

    container.appendChild(card);
  });
}

/****************************************************
 * WEEK VIEW
 ****************************************************/
async function renderWeekView() {
  const full = await loadStaticAvailability();
  const container = document.getElementById("view-container");

  // Default to current week
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

  document.getElementById("prevWeek").onclick = () => navigateWeek(-1, full);
  document.getElementById("nextWeek").onclick = () => navigateWeek(1, full);

  renderWeekGrid(full);
}

function navigateWeek(offset, full) {
  const allWeeks = Object.keys(full.weeks).sort();
  const idx = allWeeks.indexOf(currentWeekId);
  const nextIdx = idx + offset;

  if (nextIdx < 0 || nextIdx >= allWeeks.length) return;

  currentWeekId = allWeeks[nextIdx];
  renderWeekView();
}

async function renderWeekGrid(full) {
  const container = document.getElementById("weekResults");

  if (!full.weeks[currentWeekId]) {
    container.innerHTML = `<p>No data for ${currentWeekId} (outside season)</p>`;
    return;
  }

  const data = full.weeks[currentWeekId];
  container.innerHTML = `<div class="week-grid"></div>`;
  const grid = container.querySelector(".week-grid");

  Object.keys(data).forEach(date => {
    const dayCard = document.createElement("div");
    dayCard.className = "week-day-card";

    const title = document.createElement("div");
    title.className = "week-day-title";
    title.textContent = date;
    dayCard.appendChild(title);

    const fields = data[date];
    const anyAvailable = Object.values(fields).some(w => w.length > 0);

    const summary = document.createElement("div");
    summary.className = "week-day-summary";
    summary.textContent = anyAvailable
      ? `${Object.values(fields).filter(w => w.length > 0).length} fields available`
      : "No availability";
    dayCard.appendChild(summary);

    dayCard.onclick = () => {
      currentDate = date;
      switchView("day");
    };

    grid.appendChild(dayCard);
  });
}

/****************************************************
 * MONTH VIEW
 ****************************************************/
async function renderMonthView() {
  const full = await loadStaticAvailability();
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

  document.getElementById("prevMonth").onclick = () => navigateMonth(-1, full);
  document.getElementById("nextMonth").onclick = () => navigateMonth(1, full);

  renderMonthGrid(full);
}

function navigateMonth(offset, full) {
  const allMonths = Object.keys(full.months).sort();
  const idx = allMonths.indexOf(currentMonthId);
  const nextIdx = idx + offset;

  if (nextIdx < 0 || nextIdx >= allMonths.length) return;

  currentMonthId = allMonths[nextIdx];
  renderMonthView();
}

async function renderMonthGrid(full) {
  const container = document.getElementById("monthResults");

  if (!full.months[currentMonthId]) {
    container.innerHTML = `<p>No data for ${currentMonthId} (outside season)</p>`;
    return;
  }

  const data = full.months[currentMonthId];
  container.innerHTML = `<div class="month-grid"></div>`;
  const grid = container.querySelector(".month-grid");

  Object.keys(data).forEach(date => {
    const dayCard = document.createElement("div");
    dayCard.className = "month-day-card";

    dayCard.textContent = date.substring(8);

    dayCard.onclick = () => {
      currentDate = date;
      switchView("day");
    };

    grid.appendChild(dayCard);
  });
}

/****************************************************
 * SEARCH VIEW
 ****************************************************/
async function renderSearchView() {
  const full = await loadStaticAvailability();
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Search</h2>
    <div class="controls">
      <input type="time" id="searchTime">
      <button id="searchBtn">Search</button>
    </div>
    <div id="searchResults"></div>
  `;

  document.getElementById("searchBtn").onclick = () => runSearch(full);
}

function runSearch(full) {
  const time = document.getElementById("searchTime").value;
  const container = document.getElementById("searchResults");

  if (!time) {
    container.innerHTML = "<p>Please select a time.</p>";
    return;
  }

  const results = [];

  Object.keys(full.days).forEach(date => {
    const fields = full.days[date];
    Object.keys(fields).forEach(fieldId => {
      const windows = fields[fieldId];
      windows.forEach(w => {
        if (w.start <= time && w.end >= time) {
          results.push({ date, fieldId, window: w });
        }
      });
    });
  });

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
