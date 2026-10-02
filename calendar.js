/****************************************************
 * STATIC JSON CACHE (updated hourly by GitHub)
 ****************************************************/
const STATIC_JSON_URL = "https://haysa-soccer.github.io/HAYSA-Home-Games/data/availability.json";
let cachedFull = null;

async function loadStaticAvailability() {
  if (cachedFull) return cachedFull;

  const response = await fetch(STATIC_JSON_URL);
  cachedFull = await response.json();
  return cachedFull;
}

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
function renderDayView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Day View</h2>
    <div class="controls">
      <input type="date" id="dayInput">
      <button id="dayLoadBtn">Load Availability</button>
    </div>
    <div id="dayResults"></div>
  `;

  document.getElementById("dayLoadBtn").addEventListener("click", loadDayAvailability);
}

async function loadDayAvailability() {
  const date = document.getElementById("dayInput").value;
  if (!date) {
    alert("Please select a date.");
    return;
  }

  const full = await loadStaticAvailability();

  // For now, show today's availability (full.day)
  // Later we can map any selected date to full.month or full.week
  const data = full.day;

  const container = document.getElementById("dayResults");
  container.innerHTML = `<h3>Availability for ${date}</h3>`;

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
function renderWeekView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Week View</h2>
    <p>This week's availability (auto-loaded from static JSON)</p>
    <div id="weekResults"></div>
  `;

  loadWeekAvailability();
}

async function loadWeekAvailability() {
  const full = await loadStaticAvailability();
  const data = full.week;

  renderWeekGrid(data);
}

function renderWeekGrid(data) {
  const container = document.getElementById("weekResults");
  container.innerHTML = `
    <h3>This Week's Availability</h3>
    <div class="week-grid"></div>
  `;

  const grid = container.querySelector(".week-grid");

  Object.keys(data).forEach(date => {
    const dayCard = document.createElement("div");
    dayCard.className = "week-day-card";

    const title = document.createElement("div");
    title.className = "week-day-title";
    title.textContent = date;
    dayCard.appendChild(title);

    const fields = data[date];
    const anyAvailable = Object.values(fields).some(windows => windows.length > 0);

    if (!anyAvailable) {
      const empty = document.createElement("div");
      empty.className = "week-day-empty";
      empty.textContent = "No availability";
      dayCard.appendChild(empty);
    } else {
      const summary = document.createElement("div");
      summary.className = "week-day-summary";

      const count = Object.values(fields).filter(w => w.length > 0).length;
      summary.textContent = `${count} fields available`;
      dayCard.appendChild(summary);
    }

    dayCard.addEventListener("click", () => showDayDetail(date, fields));

    grid.appendChild(dayCard);
  });
}

function showDayDetail(date, fields) {
  const container = document.getElementById("weekResults");

  container.innerHTML = `
    <h3>Detailed Availability for ${date}</h3>
    <button id="backToWeek">← Back to Week</button>
    <div id="weekDetail"></div>
  `;

  document.getElementById("backToWeek").addEventListener("click", loadWeekAvailability);

  const detail = document.getElementById("weekDetail");

  Object.keys(fields).forEach(fieldId => {
    const card = document.createElement("div");
    card.className = "field-card";

    const title = document.createElement("div");
    title.className = "field-title";
    title.textContent = fieldId;
    card.appendChild(title);

    const windows = fields[fieldId];

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

    detail.appendChild(card);
  });
}

/****************************************************
 * MONTH VIEW (placeholder)
 ****************************************************/
function renderMonthView() {
  const container = document.getElementById("view-container");
  container.innerHTML = `
    <h2>Month View</h2>
    <p>Month calendar grid coming next — powered by static JSON.</p>
  `;
}

/****************************************************
 * SEARCH VIEW (placeholder)
 ****************************************************/
function renderSearchView() {
  const container = document.getElementById("view-container");
  container.innerHTML = `
    <h2>Search</h2>
    <p>Search tools coming next — using static JSON.</p>
  `;
}
