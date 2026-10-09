/****************************************************
 * GLOBAL STATE
 ****************************************************/
let currentDate = null;
let currentView = "day";

let FIELDS = [];
let COMPLEXES = {};
let SELECTED_COMPLEXES = new Set();
let SELECTED_MODE = "practice"; // matches HTML dropdown

let DATA_TIMESTAMP = null;

// SET THIS TO YOUR DEPLOYED WEB APP URL (NO TRAILING ?)
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxsqMLIxgq5CbzkQCovmwDzI8wjlf3KvQOyB0g10JPTVxzmXAaT7m6B13nPmHmLElrO/exec";


/****************************************************
 * BACKEND HELPERS
 ****************************************************/
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function buildDayCalendarURL(dateStr, mode) {
  const params = new URLSearchParams({
    mode: "day_calendar",
    date: dateStr,
    sched_mode: mode || "practice"
  });
  return `${BACKEND_URL}?${params.toString()}`;
}

function buildSearchBlockURL({ date, complex, start, duration, mode }) {
  const params = new URLSearchParams({
    mode: "search_block",
    date,
    complex,
    start,
    duration: String(duration || 90),
    sched_mode: mode || "practice"
  });
  return `${BACKEND_URL}?${params.toString()}`;
}

async function fetchDayCalendar(dateStr, mode) {
  const url = buildDayCalendarURL(dateStr, mode);
  const data = await fetchJSON(url);

  // Cache global fields/complexes/timestamp from first load
  if (!FIELDS.length && Array.isArray(data.fields)) {
    FIELDS = data.fields;
  }
  if (!Object.keys(COMPLEXES).length && data.complexes) {
    COMPLEXES = data.complexes;
  }
  if (!DATA_TIMESTAMP && data.generated_at) {
    DATA_TIMESTAMP = data.generated_at;
    insertTimestamp(DATA_TIMESTAMP);
  }

  return data;
}


/****************************************************
 * TIMESTAMP DISPLAY
 ****************************************************/
function insertTimestamp(tsStr) {
  const tsEl = document.getElementById("dataTimestamp");
  if (!tsEl) return;

  const ts = new Date(tsStr);
  const formatted = ts.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  tsEl.textContent = `Data current as of: ${formatted}`;
}


/****************************************************
 * COMPLEX FILTERING
 ****************************************************/
function getAllowedFields() {
  if (SELECTED_COMPLEXES.size === 0) return FIELDS;

  const allowed = new Set();
  SELECTED_COMPLEXES.forEach(cx => {
    (COMPLEXES[cx] || []).forEach(fid => allowed.add(fid));
  });

  return FIELDS.filter(f => allowed.has(f.id || f));
}

function toggleComplex(complexName) {
  if (SELECTED_COMPLEXES.has(complexName)) {
    SELECTED_COMPLEXES.delete(complexName);
  } else {
    SELECTED_COMPLEXES.add(complexName);
  }

  renderComplexFilters();

  if (currentView === "day") renderDayView();
  if (currentView === "week") renderWeekView();
  if (currentView === "month") renderMonthView();
  if (currentView === "search") renderSearchView();
}

function renderComplexFilters() {
  const container = document.getElementById("complex-filters");
  const status = document.getElementById("complex-status");
  if (!container || !status) return;

  let html = "";
  Object.keys(COMPLEXES).forEach(cx => {
    const active = SELECTED_COMPLEXES.has(cx) ? "active" : "";
    html += `
      <button class="complex-btn ${active}" onclick="toggleComplex('${cx}')">
        ${cx}
      </button>
    `;
  });

  container.innerHTML = html;

  if (SELECTED_COMPLEXES.size === 0) {
    status.textContent = "Showing ALL complexes";
  } else {
    status.textContent = "Selected: " + Array.from(SELECTED_COMPLEXES).join(", ");
  }
}


/****************************************************
 * STYLE HELPERS
 ****************************************************/
function getStyle(type) {
  switch (type) {
    case "game": return { cls: "block-game", badge: "G" };
    case "practice": return { cls: "block-practice", badge: "P" };
    case "admin": return { cls: "block-admin", badge: "A" };
    default: return { cls: "block-free", badge: "" };
  }
}


/****************************************************
 * DATE/TIME HELPERS
 ****************************************************/
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dow = days[d.getDay()];
  const [y, m, dd] = dateStr.split("-");
  return `${dow} ${m}/${dd}`;
}

function timeToMinutes(t) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

function minutesToTime(m) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// vertical timeline base: 08:00–21:00
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 21 * 60;

function minutesSinceDayStart(t) {
  return timeToMinutes(t) - DAY_START_MIN;
}


/****************************************************
 * INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  // Start at today by default
  currentDate = new Date().toISOString().split("T")[0];

  // MODE SELECT
  const modeSelect = document.getElementById("schedModeSelect");
  if (modeSelect) {
    SELECTED_MODE = modeSelect.value || "practice";

    modeSelect.addEventListener("change", (e) => {
      SELECTED_MODE = e.target.value || "practice";

      if (currentView === "day") renderDayView();
      if (currentView === "week") renderWeekView();
      if (currentView === "month") renderMonthView();
      if (currentView === "search") renderSearchView();
    });
  }

  // NAV BUTTONS
  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Initial load: fetch one day to populate fields/complexes/timestamp
  try {
    const firstDay = await fetchDayCalendar(currentDate, SELECTED_MODE);
    if (firstDay && firstDay.fields) {
      FIELDS = firstDay.fields;
    }
    if (firstDay && firstDay.complexes) {
      COMPLEXES = firstDay.complexes;
    }
  } catch (err) {
    console.error("Initial day load failed:", err);
  }

  renderComplexFilters();
  switchView("day");
});


/****************************************************
 * VIEW SWITCHER
 ****************************************************/
function switchView(viewName) {
  currentView = viewName;

  if (viewName === "day") renderDayView();
  if (viewName === "week") renderWeekView();
  if (viewName === "month") renderMonthView();
  if (viewName === "search") renderSearchView();
}


/****************************************************
 * DAY VIEW (backend-driven)
 ****************************************************/
async function renderDayView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Day View</h2>
    <div class="controls">
      <button id="prevDay">← Previous</button>
      <span>${currentDate}</span>
      <button id="nextDay">Next →</button>
    </div>
    <div id="dayResults"></div>
  `;

  document.getElementById("prevDay").onclick = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    currentDate = d.toISOString().split("T")[0];
    renderDayView();
  };

  document.getElementById("nextDay").onclick = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    currentDate = d.toISOString().split("T")[0];
    renderDayView();
  };

  let dayData;
  try {
    dayData = await fetchDayCalendar(currentDate, SELECTED_MODE);
  } catch (err) {
    console.error("Day calendar fetch failed:", err);
    const res = document.getElementById("dayResults");
    if (res) res.innerHTML = `<p>Error loading data for ${currentDate}</p>`;
    return;
  }

  renderDayCalendar(dayData);
}

function renderDayCalendar(dayData) {
  const container = document.getElementById("dayResults");
  container.innerHTML = "";

  if (!dayData || !dayData.complex_timeline) {
    container.innerHTML = `<p>No data for ${currentDate}</p>`;
    return;
  }

  // Apply complex filter: if some complexes are selected, only show those
  const visibleComplexes = Object.keys(dayData.complex_timeline).filter(cx => {
    if (SELECTED_COMPLEXES.size === 0) return true;
    return SELECTED_COMPLEXES.has(cx);
  });

  if (!visibleComplexes.length) {
    container.innerHTML = `<p>No complexes selected for ${currentDate}</p>`;
    return;
  }

  visibleComplexes.forEach(complexName => {
    const windows = dayData.complex_timeline[complexName] || [];
    if (!windows.length) return;

    const section = document.createElement("div");
    section.className = "complex-section";

    const title = document.createElement("h3");
    title.textContent = complexName;
    section.appendChild(title);

    windows.forEach(w => {
      const card = document.createElement("div");
      card.className = "window-card";

      const header = document.createElement("div");
      header.className = "window-header";
      header.textContent = `${w.start} – ${w.end} (${w.fields.length} fields)`;
      card.appendChild(header);

      const list = document.createElement("ul");
      list.className = "window-field-list";

      (w.fields || []).forEach(name => {
        const li = document.createElement("li");
        li.textContent = name;
        list.appendChild(li);
      });

      card.appendChild(list);
      section.appendChild(card);
    });

    container.appendChild(section);
  });
}


/****************************************************
 * WEEK VIEW (backend-driven, using merged field timeline)
 ****************************************************/
function getWeekRange(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = (day === 0 ? -6 : 1 - day); // shift Sunday back to Monday
  d.setDate(d.getDate() + diff);

  const out = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(d);
    dt.setDate(d.getDate() + i);
    out.push(dt.toISOString().split("T")[0]);
  }
  return out;
}

async function renderWeekView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Week View</h2>
    <div class="controls">
      <button id="prevWeek">← Previous</button>
      <span>${currentDate}</span>
      <button id="nextWeek">Next →</button>
    </div>
    <div id="weekTimeline"></div>
  `;

  document.getElementById("prevWeek").onclick = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    currentDate = d.toISOString().split("T")[0];
    renderWeekView();
  };

  document.getElementById("nextWeek").onclick = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    currentDate = d.toISOString().split("T")[0];
    renderWeekView();
  };

  await renderWeekTimeline();
}

async function renderWeekTimeline() {
  const container = document.getElementById("weekTimeline");
  container.innerHTML = "";

  const days = getWeekRange(currentDate); // Monday → Sunday

  const timeline = document.createElement("div");
  timeline.className = "week-timeline";

  for (const dateStr of days) {
    let dayData;
    try {
      dayData = await fetchDayCalendar(dateStr, SELECTED_MODE);
    } catch (err) {
      console.error("Week day fetch failed for", dateStr, err);
      continue;
    }

    const merged = Array.isArray(dayData.merged) ? dayData.merged : [];

    // Apply complex filter: only include blocks whose field belongs to a visible complex
    const allowedFieldIds = getAllowedFields().map(f => f.id || f);
    const blocks = merged.filter(b => {
      const fid = b.field;
      return !allowedFieldIds.length || allowedFieldIds.includes(fid);
    });

    const dayCol = document.createElement("div");
    dayCol.className = "week-day-col";

    const header = document.createElement("div");
    header.className = "week-day-header";
    header.textContent = formatDateLabel(dateStr);
    dayCol.appendChild(header);

    const dayBody = document.createElement("div");
    dayBody.className = "week-day-body";

    // Assign lanes for overlapping blocks
    let lanes = [];

    blocks.forEach(b => {
      const startMin = minutesSinceDayStart(b.start);
      const endMin = minutesSinceDayStart(b.end);

      let laneIndex = 0;

      while (true) {
        if (!lanes[laneIndex]) {
          lanes[laneIndex] = [];
          break;
        }

        const conflict = lanes[laneIndex].some(existing => {
          const es = minutesSinceDayStart(existing.start);
          const ee = minutesSinceDayStart(existing.end);
          return !(ee <= startMin || es >= endMin);
        });

        if (!conflict) break;

        laneIndex++;
      }

      b.lane = laneIndex;
      lanes[laneIndex].push(b);
    });

    const laneWidth = 100 / (lanes.length || 1);

    blocks.forEach(b => {
      const startMin = minutesSinceDayStart(b.start);
      const endMin = minutesSinceDayStart(b.end);
      const duration = endMin - startMin;

      const style = getStyle(b.type);
      const block = document.createElement("div");
      block.className = "week-block " + (style.cls || "block-free");

      block.style.top = `${startMin}px`;
      block.style.height = `${duration}px`;
      block.style.left = `${b.lane * laneWidth}%`;
      block.style.width = `${laneWidth}%`;

      const label = document.createElement("div");
      label.className = "label";

      if (b.type === "practice" || b.type === "game") {
        label.textContent = b.title || (b.field || "");
      } else if (b.type === "admin") {
        label.textContent = b.title || "Admin Block";
      } else {
        label.textContent = b.field || "";
      }

      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = `${b.start}–${b.end}`;

      block.appendChild(label);
      block.appendChild(sub);

      dayBody.appendChild(block);
    });

    dayCol.appendChild(dayBody);
    timeline.appendChild(dayCol);
  }

  container.appendChild(timeline);
}


/****************************************************
 * MONTH VIEW (simple backend-driven placeholder)
 ****************************************************/
async function renderMonthView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Month View</h2>
    <p>Month view is not fully implemented yet, but will use backend day_calendar data
       to mark days as free/busy/mixed.</p>
  `;
}


/****************************************************
 * SEARCH VIEW (backend-driven using search_block)
 ****************************************************/
async function renderSearchView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Search View</h2>
    <div class="controls">
      <label>Date: <input type="date" id="searchDate" value="${currentDate}"></label>
      <label>Complex:
        <select id="searchComplex">
          ${Object.keys(COMPLEXES).map(cx => `<option value="${cx}">${cx}</option>`).join("")}
        </select>
      </label>
      <label>Start: <input type="time" id="searchStart" value="18:00"></label>
      <label>Duration (min): <input type="number" id="searchDuration" value="90"></label>
      <button id="searchRun">Search</button>
    </div>
    <div id="searchResults"></div>
  `;

  const dateInput = document.getElementById("searchDate");
  const complexSelect = document.getElementById("searchComplex");
  const startInput = document.getElementById("searchStart");
  const durationInput = document.getElementById("searchDuration");
  const runBtn = document.getElementById("searchRun");
  const results = document.getElementById("searchResults");

  if (!runBtn || !results) return;

  runBtn.onclick = async () => {
    const date = dateInput.value || currentDate;
    const complex = complexSelect.value;
    const start = startInput.value || "18:00";
    const duration = parseInt(durationInput.value || "90", 10);

    results.innerHTML = `<p>Searching...</p>`;

    try {
      const url = buildSearchBlockURL({ date, complex, start, duration, mode: SELECTED_MODE });
      const data = await fetchJSON(url);

      const matches = Array.isArray(data.matches) ? data.matches : [];

      if (!matches.length) {
        results.innerHTML = `<p>No matching free blocks found.</p>`;
        return;
      }

      const list = document.createElement("ul");
      list.className = "search-result-list";

      matches.forEach(m => {
        const li = document.createElement("li");
        const fields = (m.fields || []).join(", ");
        li.textContent = `${m.start}–${m.end} @ ${fields}`;
        list.appendChild(li);
      });

      results.innerHTML = "";
      results.appendChild(list);
    } catch (err) {
      console.error("Search failed:", err);
      results.innerHTML = `<p>Error running search.</p>`;
    }
  };
}
