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
let currentView = "day";

let SELECTED_COMPLEXES = new Set();


const TIME_SLOTS = [
  "06:00","06:30","07:00","07:30","08:00","08:30",
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00"
];


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

  currentDate = AVAIL.season_start || new Date().toISOString().split("T")[0];
  currentWeekId = getWeekId(new Date(currentDate));
  currentMonthId = currentDate.substring(0, 7);
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
  const status = document.getElementById("complex-status");
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

  if (SELECTED_COMPLEXES.size === 0) {
    status.textContent = "Showing ALL complexes";
  } else {
    status.textContent = "Selected: " + Array.from(SELECTED_COMPLEXES).join(", ");
  }
}



function getAllowedFields() {
  if (SELECTED_COMPLEXES.size === 0) return FIELDS;

  const allowed = new Set();
  SELECTED_COMPLEXES.forEach(cx => {
    (COMPLEXES[cx] || []).forEach(f => allowed.add(f));
  });

  return FIELDS.filter(f => allowed.has(f.id || f));
}


/****************************************************
 * MERGING LOGIC
 ****************************************************/
function mergeTimelineForDay(dayData) {
  if (!dayData) return [];

  const availability = dayData.availability || {};
  const events = dayData.events || {};
  const blocks = dayData.blocks || {};
  const fields = dayData.fields || FIELDS;

  let out = [];

  fields.forEach(field => {
    const fieldId = typeof field === "string" ? field : field.id;
    const fieldName = typeof field === "string" ? field : (field.name || field.id);

    const availWindows = availability[fieldId] || [];
    const eventList = events[fieldId] || [];
    const blockList = blocks[fieldId] || [];

    // Free windows
    availWindows.forEach(w => {
      out.push({
        field: fieldId,
        fieldName: fieldName,
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
        field: fieldId,
        fieldName: fieldName,
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
        field: fieldId,
        fieldName: fieldName,
        start: b.start,
        end: b.end,
        type: "admin",
        title: b.reason,
        cls: style.cls,
        badge: style.badge
      });
    });
  });

  out.sort((a, b) => a.start.localeCompare(b.start));
  return filterByComplex(out);
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
 * NAVIGATION / INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  await loadAvailabilityJSON();
  renderComplexFilters();

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  switchView("day");
});

function switchView(view) {
  currentView = view;
  if (view === "day") renderDayView();
  if (view === "week") renderWeekView();
  if (view === "month") renderMonthView();
  if (view === "search") renderSearchView();
}

/****************************************************
 * DAY VIEW (STACKED BY FIELD)
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

function renderDayCalendar(dayData) {
  const container = document.getElementById("dayResults");
  container.innerHTML = "";

  if (!dayData) {
    container.innerHTML = `<p>No data for ${currentDate} (outside season)</p>`;
    return;
  }

  const mergedAll = mergeTimelineForDay(dayData);
  let fields = dayData.fields || FIELDS;
  fields = getAllowedFields();


  fields.forEach(field => {
    const fieldId = typeof field === "string" ? field : field.id;
    const fieldName = typeof field === "string" ? field : (field.name || field.id);

    const card = document.createElement("div");
    card.className = "field-card";

    const title = document.createElement("div");
    title.className = "field-title";
    title.textContent = fieldName;
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
 * WEEK VIEW (STACKED DAY COLUMNS)
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

  const days = getWeekRange(currentDate);
  const allowedFields = getAllowedFields().map(f => f.id || f);

  const grid = document.createElement("div");
  grid.className = "week-grid-time";

  // Time column
  const timeCol = document.createElement("div");
  timeCol.className = "week-time-col";
  TIME_SLOTS.forEach(t => {
    const div = document.createElement("div");
    div.className = "week-time-slot";
    div.textContent = t;
    timeCol.appendChild(div);
  });
  grid.appendChild(timeCol);

  // Day columns
  days.forEach(dateStr => {
    const dayData = DAYS[dateStr];
    const merged = dayData ? mergeTimelineForDay(dayData) : [];

    const col = document.createElement("div");
    col.className = "week-col";

    const title = document.createElement("div");
    title.className = "week-col-title";
    title.textContent = dateStr;
    col.appendChild(title);

    TIME_SLOTS.forEach(t => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "week-slot";

      const active = merged.find(m => m.start <= t && m.end > t);

      if (active && allowedFields.includes(active.field)) {
        slotDiv.classList.add(active.cls);
        slotDiv.textContent = active.badge ? `[${active.badge}]` : "";
        slotDiv.title = `${active.fieldName} ${active.start}–${active.end}`;
      }

      col.appendChild(slotDiv);
    });

    grid.appendChild(col);
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
    const dayData = monthData[dateStr];
    const allowedFields = getAllowedFields().map(f => f.id || f);
    const mergedAll = mergeTimelineForDay(dayData).filter(m => allowedFields.includes(m.field));


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
    const dayData = DAYS[dateStr];
    if (!dayData) return;

    const availability = dayData.availability || {};
    const fields = getAllowedFields();

    fields.forEach(field => {
      const fieldId = field.id || field;

      const fieldName = typeof field === "string" ? field : (field.name || field.id);

      if (allowedFields.size > 0 && !allowedFields.has(fieldId)) return;

      const windows = availability[fieldId] || [];
      windows.forEach(w => {
        if (w.start <= time && w.end >= time) {
          results.push({ date: dateStr, fieldId, fieldName, window: w });
        }
      });
    });
  });

  if (results.length === 0) {
    container.innerHTML = "<p>No availability found.</p>";
    return;
  }

  container.innerHTML = results
    .map(r => `<div>${r.date} — ${r.fieldName} (${r.window.start}–${r.window.end})</div>`)
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
