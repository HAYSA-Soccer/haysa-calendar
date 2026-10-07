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
let currentView = "day";

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

  currentDate = AVAIL.season_start || new Date().toISOString().split("T")[0];
}

/****************************************************
 * COMPLEX FILTERING
 ****************************************************/
function getAllowedFields() {
  if (SELECTED_COMPLEXES.size === 0) return FIELDS;

  const allowed = new Set();
  SELECTED_COMPLEXES.forEach(cx => {
    (COMPLEXES[cx] || []).forEach(f => allowed.add(f));
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

    availWindows.forEach(w => {
      out.push({
        field: fieldId,
        fieldName,
        start: w.start,
        end: w.end,
        type: "free",
        cls: "block-free",
        badge: ""
      });
    });

    eventList.forEach(ev => {
      const style = getStyle(ev.type);
      out.push({
        field: fieldId,
        fieldName,
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
        fieldName,
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

  const allowed = getAllowedFields().map(f => f.id || f);
  return out.filter(m => allowed.includes(m.field));
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
 * CONTINUOUS WINDOW ENGINE (NEW)
 ****************************************************/

function timeToMinutes(t) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

function minutesToTime(m) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildContinuousWindowsForDay(dayData) {
  if (!dayData) return [];

  const { fields, availability, events = {} } = dayData;

  // Build field lookup
  const fieldById = {};
  const complexes = {};
  fields.forEach(f => {
    fieldById[f.id] = f;
    if (!complexes[f.complex]) complexes[f.complex] = [];
    complexes[f.complex].push(f.id);
  });

  // Determine time range
  let minStart = Infinity;
  let maxEnd = -Infinity;
  Object.values(availability).forEach(windows => {
    windows.forEach(w => {
      const s = timeToMinutes(w.start);
      const e = timeToMinutes(w.end);
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
    });
  });
  if (!isFinite(minStart) || !isFinite(maxEnd)) return [];

  // Build 30-min slots
  const SLOT = 30;
  const slots = [];
  for (let t = minStart; t < maxEnd; t += SLOT) {
    slots.push({ start: t, end: t + SLOT });
  }

  function fieldAvailable(fieldId, slot) {
    const windows = availability[fieldId] || [];
    return windows.some(w => {
      const ws = timeToMinutes(w.start);
      const we = timeToMinutes(w.end);
      return ws <= slot.start && we >= slot.end;
    });
  }

  function fieldBlocked(fieldId, slot) {
    const evs = events[fieldId] || [];
    return evs.some(ev => {
      const es = timeToMinutes(ev.start);
      const ee = timeToMinutes(ev.end);
      return es < slot.end && ee > slot.start;
    });
  }

  const blocks = [];

  Object.entries(complexes).forEach(([complexName, fieldIds]) => {
    const slotFieldSets = slots.map(slot => {
      const available = fieldIds.filter(fid => {
        return fieldAvailable(fid, slot) && !fieldBlocked(fid, slot);
      });
      available.sort();
      return available;
    });

    let current = null;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const fieldsHere = slotFieldSets[i];
      const key = fieldsHere.join("|");

      if (!fieldsHere.length) {
        if (current) {
          blocks.push({
            complex: complexName,
            start: minutesToTime(current.start),
            end: minutesToTime(current.end),
            fieldIds: current.fieldIds,
            fields: current.fieldIds.map(fid => fieldById[fid].name)
          });
          current = null;
        }
        continue;
      }

      if (!current) {
        current = {
          start: slot.start,
          end: slot.end,
          fieldIds: fieldsHere.slice(),
          key
        };
      } else if (current.key === key) {
        current.end = slot.end;
      } else {
        blocks.push({
          complex: complexName,
          start: minutesToTime(current.start),
          end: minutesToTime(current.end),
          fieldIds: current.fieldIds,
          fields: current.fieldIds.map(fid => fieldById[fid].name)
        });
        current = {
          start: slot.start,
          end: slot.end,
          fieldIds: fieldsHere.slice(),
          key
        };
      }
    }

    if (current) {
      blocks.push({
        complex: complexName,
        start: minutesToTime(current.start),
        end: minutesToTime(current.end),
        fieldIds: current.fieldIds,
        fields: current.fieldIds.map(fid => fieldById[fid].name)
      });
    }
  });

  return blocks;
}



/****************************************************
 * INIT
 ****************************************************/
/****************************************************
 * INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  await loadAvailabilityJSON();
  renderComplexFilters();

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  switchView("day");

  // TEMP TEST — JSON is already loaded!
  const day = DAYS["2026-10-09"];
  const blocks = buildContinuousWindowsForDay(day);
  console.log("CONTINUOUS BLOCKS:", blocks);
});


/****************************************************
 * VIEW SWITCHER
 ****************************************************/
function switchView(view) {
  currentView = view;
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
    container.innerHTML = `<p>No data for ${currentDate}</p>`;
    return;
  }

  const mergedAll = mergeTimelineForDay(dayData);
  let fields = getAllowedFields();

  fields.forEach(field => {
    const fieldId = field.id || field;
    const fieldName = field.name || fieldId;

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

        if (slot.title) div.title = slot.title;

        card.appendChild(div);
      });
    }

    container.appendChild(card);
  });
}

/****************************************************
 * WEEK VIEW — Monday → Sunday + Time Axis Grid
 ****************************************************/
const TIME_SLOTS = [
  "06:00","06:30","07:00","07:30","08:00","08:30",
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00"
];

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    days.push(dt.toISOString().split("T")[0]);
  }
  return days;
}

function renderWeekView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Week View</h2>
    <div class="controls">
      <button id="prevWeek">← Previous</button>
      <span>${currentDate}</span>
      <button id="nextWeek">Next →</button>
    </div>
    <div id="weekResults"></div>
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

  renderWeekCalendar();
}

function renderWeekCalendar() {
  const container = document.getElementById("weekResults");
  container.innerHTML = "";

  const days = getWeekRange(currentDate);
  const allowedFields = getAllowedFields().map(f => f.id || f);

  const grid = document.createElement("div");
  grid.className = "week-grid-time";

  const timeCol = document.createElement("div");
  timeCol.className = "week-time-col";
  TIME_SLOTS.forEach(t => {
    const div = document.createElement("div");
    div.className = "week-time-slot";
    div.textContent = t;
    timeCol.appendChild(div);
  });
  grid.appendChild(timeCol);

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
function renderMonthView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Month View</h2>
    <div class="controls">
      <button id="prevMonth">← Previous</button>
      <span>${currentDate.substring(0, 7)}</span>
      <button id="nextMonth">Next →</button>
    </div>
    <div id="monthResults"></div>
  `;

  document.getElementById("prevMonth").onclick = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    currentDate = d.toISOString().split("T")[0];
    renderMonthView();
  };

  document.getElementById("nextMonth").onclick = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    currentDate = d.toISOString().split("T")[0];
    renderMonthView();
  };

  renderMonthCalendar();
}

function renderMonthCalendar() {
  const container = document.getElementById("monthResults");
  container.innerHTML = "";

  const monthId = currentDate.substring(0, 7);
  const monthData = MONTHS[monthId];
  if (!monthData) {
    container.innerHTML = `<p>No data for ${monthId}</p>`;
    return;
  }

  const allowedFields = getAllowedFields().map(f => f.id || f);

  const grid = document.createElement("div");
  grid.className = "month-grid";

  Object.keys(monthData).sort().forEach(dateStr => {
    const dayData = monthData[dateStr];
    const merged = mergeTimelineForDay(dayData);

    const dayCard = document.createElement("div");
    dayCard.className = "month-day-card";
    dayCard.textContent = new Date(dateStr).getDate();

    if (merged.some(m => allowedFields.includes(m.field))) {
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
function renderSearchView() {
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

function runSearch() {
  const time = document.getElementById("searchTime").value;
  const container = document.getElementById("searchResults");

  if (!time) {
    container.innerHTML = "<p>Please select a time.</p>";
    return;
  }

  const allowedFields = getAllowedFields().map(f => f.id || f);
  const results = [];

  Object.keys(DAYS).forEach(dateStr => {
    const dayData = DAYS[dateStr];
    if (!dayData) return;

    const availability = dayData.availability || {};
    const fields = getAllowedFields();

    fields.forEach(field => {
      const fieldId = field.id || field;
      const fieldName = field.name || fieldId;

      const windows = availability[fieldId] || [];
      windows.forEach(w => {
        if (w.start <= time && w.end >= time) {
          results.push({ date: dateStr, fieldName, window: w });
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
