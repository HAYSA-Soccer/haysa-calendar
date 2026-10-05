/****************************************************
 * GLOBAL STATE
 ****************************************************/
let AVAIL = null;
let DAYS = null;
let WEEKS = null;
let MONTHS = null;
let FIELDS = null;
let COMPLEXES = null;

let currentDate = null;
let currentWeekId = null;
let currentMonthId = null;

let SELECTED_COMPLEXES = new Set();

/****************************************************
 * LOAD STATIC JSON
 ****************************************************/
async function loadAvailabilityJSON() {
  const res = await fetch("data/availability.json", { cache: "no-store" });
  AVAIL = await res.json();

  DAYS = AVAIL.days || {};
  WEEKS = AVAIL.weeks || {};
  MONTHS = AVAIL.months || {};
  FIELDS = AVAIL.fields || [];
  COMPLEXES = AVAIL.complexes || {};
}

/****************************************************
 * COMPLEX FILTERING
 ****************************************************/
function toggleComplex(complexName) {
  if (SELECTED_COMPLEXES.has(complexName)) {
    SELECTED_COMPLEXES.delete(complexName);
  } else {
    SELECTED_COMPLEXES.add(complexName);
  }

  if (currentView === "day") renderDayView();
  if (currentView === "week") renderWeekView();
  if (currentView === "month") renderMonthView();
}

function filterByComplex(merged) {
  if (SELECTED_COMPLEXES.size === 0) return merged;

  const allowedFields = new Set();
  SELECTED_COMPLEXES.forEach(cx => {
    (COMPLEXES[cx] || []).forEach(f => allowedFields.add(f));
  });

  return merged.filter(item => allowedFields.has(item.field));
}

function renderComplexFilters() {
  const container = document.getElementById("complex-filters");
  if (!container) return;

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
}

/****************************************************
 * MERGING LOGIC
 ****************************************************/
function mergeTimeline(availWindows, eventList, blockList, fieldId) {
  const out = [];

  availWindows.forEach(w => {
    out.push({
      field: fieldId,
      start: w.start,
      end: w.end,
      type: "free",
      title: "",
      cls: "block-free",
      badge: ""
    });
  });

  eventList.forEach(ev => {
    const style = getStyle(ev.type);
    out.push({
      field: fieldId,
      start: ev.start,
      end: ev.end,
      type: ev.type,
      title: ev.title,
      cls: style.cls,
      badge: style.badge
    });
  });

  blockList.forEach(b => {
    const style = getStyle("admin");
    out.push({
      field: fieldId,
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
 * VIEW STATE
 ****************************************************/
let currentView = "day";

/****************************************************
 * NAVIGATION
 ****************************************************/
document.addEventListener("DOMContentLoaded", () => {
  initCalendar();

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
});

function switchView(view) {
  currentView = view;
  if (view === "day") renderDayView();
  if (view === "week") renderWeekView();
  if (view === "month") renderMonthView();
  if (view === "search") renderSearchView();
}

/****************************************************
 * INIT
 ****************************************************/
async function initCalendar() {
  await loadAvailabilityJSON();

  currentDate = AVAIL.season_start || new Date().toISOString().split("T")[0];
  currentWeekId = getWeekId(new Date(currentDate));
  currentMonthId = currentDate.substring(0, 7);

  renderComplexFilters();
  switchView("day");
}

/****************************************************
 * DAY VIEW
 ****************************************************/
async function renderDayView() {
  const container = document.getElementById("view-container");

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

  const dayData = DAYS[currentDate];
  renderDayCalendar(dayData);
}

function renderDayCalendar(data) {
  const container = document.getElementById("dayResults");
  container.innerHTML = "";

  if (!data) {
    container.innerHTML = `<p>No data for ${currentDate} (outside season)</p>`;
    return;
  }

  const { availability, events, blocks } = data;

  const dayFields = data.fields || FIELDS;

  let mergedAll = [];
  dayFields.forEach(fieldId => {
    const merged = mergeTimeline(
      availability[fieldId] || [],
      (events && events[fieldId]) || [],
      (blocks && blocks[fieldId]) || [],
      fieldId
    );
    mergedAll = mergedAll.concat(merged);
  });

  mergedAll = filterByComplex(mergedAll);

  dayFields.forEach(fieldId => {
    const card = document.createElement("div");
    card.className = "field-card";

    const title = document.createElement("div");
    title.className = "field-title";
    title.textContent = fieldId;
    card.appendChild(title);

    const fieldSlots = mergedAll.filter(m => m.field === fieldId);

    if (fieldSlots.length === 0) {
      const empty = document.createElement("div");
      empty.className = "window-empty";
      empty.textContent = "No availability";
      card.appendChild(empty);
    } else {
      fieldSlots.forEach(slot => {
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
 * WEEK VIEW
 ****************************************************/
async function renderWeekView() {
  const container = document.getElementById("view-container");

  if (!currentWeekId) {
    currentWeekId = getWeekId(new Date(currentDate || new Date()));
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

  document.getElementById("prevWeek").onclick = () => {
    const [year, weekStr] = currentWeekId.split("-W");
    const week = Number(weekStr) - 1;
    const d = new Date(year, 0, 1);
    d.setDate(d.getDate() + (week - 1) * 7);
    currentWeekId = getWeekId(d);
    renderWeekView();
  };

  document.getElementById("nextWeek").onclick = () => {
    const [year, weekStr] = currentWeekId.split("-W");
    const week = Number(weekStr) + 1;
    const d = new Date(year, 0, 1);
    d.setDate(d.getDate() + (week - 1) * 7);
    currentWeekId = getWeekId(d);
    renderWeekView();
  };

  renderWeekCalendar();
}

async function renderWeekCalendar() {
  const container = document.getElementById("weekResults");
  container.innerHTML = "";

  const weekData = WEEKS[currentWeekId];
  if (!weekData) {
    container.innerHTML = `<p>No data for week ${currentWeekId}</p>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "week-grid";

  Object.keys(weekData).sort().forEach(dateStr => {
    const data = weekData[dateStr];
    const { availability, events, blocks } = data;

    let mergedAll = [];
    const dayFields = data.fields || FIELDS;

    dayFields.forEach(fieldId => {
      const merged = mergeTimeline(
        availability[fieldId] || [],
        (events && events[fieldId]) || [],
        (blocks && blocks[fieldId]) || [],
        fieldId
      );
      mergedAll = mergedAll.concat(merged);
    });

    mergedAll = filterByComplex(mergedAll);

    const dayCard = document.createElement("div");
    dayCard.className = "week-day-card";

    const title = document.createElement("div");
    title.className = "week-day-title";
    title.textContent = dateStr;
    dayCard.appendChild(title);

    const anyAvail = mergedAll.some(m => m.type === "free");

    const summary = document.createElement("div");
    summary.className = "week-day-summary";
    summary.textContent = anyAvail ? "Available" : "No availability";
    dayCard.appendChild(summary);

    dayCard.onclick = () => {
      currentDate = dateStr;
      switchView("day");
    };

    grid.appendChild(dayCard);
  });

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

  document.getElementById("prevMonth").onclick = () => {
    const [year, month] = currentMonthId.split("-");
    const d = new Date(Number(year), Number(month) - 2, 1);
    currentMonthId = d.toISOString().substring(0, 7);
    renderMonthView();
  };

  document.getElementById("nextMonth").onclick = () => {
    const [year, month] = currentMonthId.split("-");
    const d = new Date(Number(year), Number(month), 1);
    currentMonthId = d.toISOString().substring(0, 7);
    renderMonthView();
  };

  renderMonthCalendar();
}

async function renderMonthCalendar() {
  const container = document.getElementById("monthResults");
  container.innerHTML = "";

  const monthData = MONTHS[currentMonthId];
  if (!monthData) {
    container.innerHTML = `<p>No data for month ${currentMonthId}</p>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "month-grid";

  Object.keys(monthData).sort().forEach(dateStr => {
    const data = monthData[dateStr];
    const { availability, events, blocks } = data;

    let mergedAll = [];
    const dayFields = data.fields || FIELDS;

    dayFields.forEach(fieldId => {
      const merged = mergeTimeline(
        availability[fieldId] || [],
        (events && events[fieldId]) || [],
        (blocks && blocks[fieldId]) || [],
        fieldId
      );
      mergedAll = mergedAll.concat(merged);
    });

    mergedAll = filterByComplex(mergedAll);

    const dayCard = document.createElement("div");
    dayCard.className = "month-day-card";
    dayCard.textContent = new Date(dateStr).getDate();

    if (mergedAll.some(m => m.type === "free")) {
      dayCard.classList.add("has-availability");
    }

    dayCard.onclick = () => {
      currentDate = dateStr;
      switchView("day");
    };

    grid.appendChild(dayCard);
  });

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

  const results = [];
  const allowedFields = new Set();

  if (SELECTED_COMPLEXES.size > 0) {
    SELECTED_COMPLEXES.forEach(cx => {
      (COMPLEXES[cx] || []).forEach(f => allowedFields.add(f));
    });
  }

  Object.keys(DAYS).forEach(dateStr => {
    const data = DAYS[dateStr];
    const availability = data.availability || {};
    Object.keys(availability).forEach(fieldId => {
      if (allowedFields.size > 0 && !allowedFields.has(fieldId)) return;
      const windows = availability[fieldId];
      windows.forEach(w => {
        if (w.start <= time && w.end >= time) {
          results.push({ date: dateStr, fieldId, window: w });
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
