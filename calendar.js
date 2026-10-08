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
let SELECTED_MODE = "practice"; // default matches HTML dropdown


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
 * MERGING LOGIC (week/month/search)
 ****************************************************/
function mergeTimelineForDay(dayData) {
  if (!dayData) return [];

  if (dayData.merged) delete dayData.merged;

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

    // free windows
    availWindows.forEach(w => {
      const blocked = eventList.some(ev => {
        const t = ev.title ? ev.title.toLowerCase() : "";
        const evType = t.includes("game") || t.includes("vs") || t.includes("match")
          ? "game"
          : "practice";

        if (SELECTED_MODE !== evType) return false;

        const es = timeToMinutes(ev.start);
        const ee = timeToMinutes(ev.end);
        const ws = timeToMinutes(w.start);
        const we = timeToMinutes(w.end);

        return es < we && ee > ws;
      });

      if (blocked) return;

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

    // events
    eventList.forEach(ev => {
      if (!ev.type) {
        const t = ev.title ? ev.title.toLowerCase() : "";
        ev.type = (t.includes("game") || t.includes("vs") || t.includes("match"))
          ? "game"
          : "practice";
      }

      if (SELECTED_MODE && ev.type !== SELECTED_MODE) return;

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

    // admin blocks
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


function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dow = days[d.getDay()];
  const [y, m, dd] = dateStr.split("-");
  return `${dow} ${m}/${dd}`;
}

function minutesSinceStart(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}


/****************************************************
 * CONTINUOUS WINDOW ENGINE (day view)
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

  const fieldById = {};
  const complexes = {};
  fields.forEach(f => {
    fieldById[f.id] = f;
    if (!complexes[f.complex]) complexes[f.complex] = [];
    complexes[f.complex].push(f.id);
  });

  const allowedFieldIds = getAllowedFields().map(f => f.id || f);

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

  const SLOT = 30;
  const slots = [];
  for (let t = minStart; t < maxEnd; t += SLOT) {
    slots.push({ start: t, end: t + SLOT });
  }

  function fieldAvailable(fieldId, slot) {
    const windows = availability[fieldId] || [];

    const inWindow = windows.some(w => {
      const ws = timeToMinutes(w.start);
      const we = timeToMinutes(w.end);
      return ws <= slot.start && we >= slot.end;
    });

    if (!inWindow) return false;

    const evs = events[fieldId] || [];
    const blockedByMode = evs.some(ev => {
      const t = ev.title ? ev.title.toLowerCase() : "";
      const evType = t.includes("game") || t.includes("vs") || t.includes("match")
        ? "game"
        : "practice";

      if (SELECTED_MODE !== evType) return false;

      const es = timeToMinutes(ev.start);
      const ee = timeToMinutes(ev.end);
      return es < slot.end && ee > slot.start;
    });

    return !blockedByMode;
  }

  function fieldBlocked(fieldId, slot) {
    const evs = events[fieldId] || [];
    return evs.some(ev => {
      if (!ev.type) {
        const t = ev.title ? ev.title.toLowerCase() : "";
        ev.type = (t.includes("game") || t.includes("vs") || t.includes("match"))
          ? "game"
          : "practice";
      }

      if (SELECTED_MODE && ev.type !== SELECTED_MODE) return false;

      const es = timeToMinutes(ev.start);
      const ee = timeToMinutes(ev.end);
      return es < slot.end && ee > slot.start;
    });
  }

  const blocks = [];

  Object.entries(complexes).forEach(([complexName, fieldIds]) => {
    if (SELECTED_COMPLEXES.size > 0 && !SELECTED_COMPLEXES.has(complexName)) return;

    const filteredFieldIds = fieldIds.filter(fid => allowedFieldIds.includes(fid));
    if (filteredFieldIds.length === 0) return;

    const slotFieldSets = slots.map(slot => {
      const available = filteredFieldIds.filter(fid => {
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
document.addEventListener("DOMContentLoaded", async () => {
  await loadAvailabilityJSON();
  renderComplexFilters();

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

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

  switchView("day");
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

  const blocks = buildContinuousWindowsForDay(dayData);

  if (blocks.length === 0) {
    container.innerHTML = `<p>No availability for ${currentDate}</p>`;
    return;
  }

  const byComplex = {};
  blocks.forEach(b => {
    if (!byComplex[b.complex]) byComplex[b.complex] = [];
    byComplex[b.complex].push(b);
  });

  Object.entries(byComplex).forEach(([complexName, windows]) => {
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

      w.fields.forEach(name => {
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
 * WEEK VIEW
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

  const grid = document.createElement("div");
  grid.className = "week-grid-time";

  // Left column: time labels
  const timeCol = document.createElement("div");
  timeCol.className = "week-time-col";
  TIME_SLOTS.forEach(t => {
    const div = document.createElement("div");
    div.className = "week-time-slot";
    div.textContent = t;
    timeCol.appendChild(div);
  });
  grid.appendChild(timeCol);

  // Columns for each day (Monday → Sunday from getWeekRange)
  days.forEach(dateStr => {
    const dayData = DAYS[dateStr] || {
      fields: FIELDS,
      availability: {},
      events: {}
    };

    const blocks = buildContinuousWindowsForDay(dayData);

    const col = document.createElement("div");
    col.className = "week-col";

    // Day header: "Thu 10/08"
    const title = document.createElement("div");
    title.className = "week-col-title";
    title.textContent = formatDateLabel(dateStr);
    col.appendChild(title);

    // One row per time slot
    TIME_SLOTS.forEach(t => {
      const slotStart = timeToMinutes(t);
      const slotEnd = slotStart + 30;

      const slotDiv = document.createElement("div");
      slotDiv.className = "week-slot";

      // All blocks that overlap this time slice
      const actives = blocks.filter(b => {
        const bs = timeToMinutes(b.start);
        const be = timeToMinutes(b.end);
        return bs < slotEnd && be > slotStart;
      });

      // Render each block inside the slot
      actives.forEach(b => {
        const blockDiv = document.createElement("div");
        blockDiv.className = "week-block " + (b.cls || "block-free");

        // Show ONLY count, not field names
        blockDiv.textContent = `${b.fields.length} fields`;

        // Simple hover: complex + window
        blockDiv.title = `${b.complex} ${b.start}–${b.end}`;

        slotDiv.appendChild(blockDiv);
      });

      col.appendChild(slotDiv);
    });

    grid.appendChild(col);
  });

  container.appendChild(grid);
}
