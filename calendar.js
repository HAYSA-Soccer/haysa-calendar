// ---- GLOBAL STATE ----
let AVAIL = null;
let currentDate = new Date().toISOString().slice(0, 10);
const SELECTED_COMPLEXES = new Set();

// Time helpers
const HOURS = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00"
];

function timeToY(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const minutes = (h - 8) * 60 + m; // 08:00 = top
  return minutes; // 1 px per minute, 780px total
}

function timeToMin(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

// Human-readable date formatting
function formatHumanDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// ---- INITIALIZE APP ----
document.addEventListener("DOMContentLoaded", () => {
  loadAvailability().then(() => {
    initNav();
    renderDayView();
    renderComplexFilters();
  });
});

// ---- LOAD availability.json ----
async function loadAvailability() {
  const resp = await fetch("data/availability.json");
  AVAIL = await resp.json();

  // Build FIELD_MAP from AVAIL.fields
  window.FIELD_MAP = buildFieldMap(AVAIL.fields);

  // Timestamp display
  const tsEl = document.getElementById("dataTimestamp");
  if (tsEl && AVAIL.generated_at) {
    tsEl.textContent = `Data as of ${AVAIL.generated_at}`;
  }
}

// Build field map from availability.json
function buildFieldMap(fieldsArray) {
  const map = {};

  // First pass: basic field objects
  fieldsArray.forEach(f => {
    map[f.id] = {
      id: f.id,
      parent: f.name === f.id ? null : f.name,   // parent field ID
      type: f.complex,                           // "full" or "half"
      name: f.surface,                           // display name
      halves: []                                 // will fill in second pass
    };
  });

  // Second pass: attach half fields to their parent
  Object.values(map).forEach(f => {
    if (f.parent && map[f.parent]) {
      map[f.parent].halves.push(f.id);
    }
  });

  return map;
}

// ---- NAV + VIEW SWITCHING ----
function initNav() {
  const navButtons = document.querySelectorAll(".nav button");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      switchView(view);
    });
  });
}

function switchView(view) {
  document.getElementById("dayTimeline").style.display = "none";
  document.getElementById("weekTimeline").style.display = "none";
  document.getElementById("monthTimeline").style.display = "none";
  document.getElementById("searchTimeline").style.display = "none";

  if (view === "day") {
    renderDayView();
    document.getElementById("dayTimeline").style.display = "block";
  } else if (view === "week") {
    renderWeekTimeline();
    document.getElementById("weekTimeline").style.display = "block";
  } else if (view === "month") {
    renderMonthView();
    document.getElementById("monthTimeline").style.display = "block";
  } else if (view === "search") {
    renderSearchView();
    document.getElementById("searchTimeline").style.display = "block";
  }
}

// ---- DAY VIEW SHELL ----
function renderDayView() {
  const container = document.getElementById("view-container");
  if (!container || !AVAIL) return;

  container.innerHTML = `
    <h2>Day View</h2>
    <div class="controls">
      <button id="prevDay">←</button>
      <span class="day-date">${formatHumanDate(currentDate)}</span>
      <button id="nextDay">→</button>
    </div>
  `;

  document.getElementById("prevDay").onclick = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    currentDate = d.toISOString().split("T")[0];
    renderDayView();
    renderComplexFilters();
  };

  document.getElementById("nextDay").onclick = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    currentDate = d.toISOString().split("T")[0];
    renderDayView();
    renderComplexFilters();
  };

  const dayData = AVAIL.days[currentDate];
  if (!dayData) {
    document.getElementById("dayTimeline").innerHTML =
      `<p>No data for ${formatHumanDate(currentDate)}</p>`;
    return;
  }

  renderDayTimeline(dayData);
  document.getElementById("dayTimeline").style.display = "block";
}

// ---- WEEK VIEW SHELL ----
function renderWeekTimeline() {
  const container = document.getElementById("view-container");
  if (!container || !AVAIL) return;

  container.innerHTML = `<h2>Week View</h2>`;
  const weekEl = document.getElementById("weekTimeline");
  weekEl.innerHTML = `<p>Week timeline will go here.</p>`;
}

// ---- MONTH + SEARCH PLACEHOLDERS ----
function renderMonthView() {
  const container = document.getElementById("view-container");
  if (!container) return;
  container.innerHTML = `<h2>Month View (placeholder)</h2>`;
}

function renderSearchView() {
  const container = document.getElementById("view-container");
  if (!container) return;
  container.innerHTML = `<h2>Search View (placeholder)</h2>`;
}

// ---- WEEK RANGE HELPER ----
function getWeekRange(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sun
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sunday);
    dt.setDate(sunday.getDate() + i);
    days.push(dt.toISOString().slice(0, 10));
  }
  return days;
}

// ---- COMPLEX FILTERS ----
function extractComplexFromSurface(surfaceName) {
  if (surfaceName.includes("Turf")) return "TURF";
  if (surfaceName.includes("Sumner")) return "SUMNER/SEAN JOYCE";
  if (surfaceName.includes("Brookville")) return "BROOKVILLE";
  if (surfaceName.includes("Butler")) return "BUTLER";
  return null;
}

function renderComplexFilters() {
  const bar = document.getElementById("complex-filters");
  if (!bar || !AVAIL) return;

  bar.innerHTML = "";

  const complexes = new Set();
  Object.values(FIELD_MAP).forEach(f => {
    const loc = extractComplexFromSurface(f.name);
    if (loc) complexes.add(loc);
  });

  [...complexes].forEach(cx => {
    const btn = document.createElement("button");
    btn.className = "complex-btn";
    btn.textContent = cx;
    if (SELECTED_COMPLEXES.has(cx)) btn.classList.add("active");

    btn.addEventListener("click", () => {
      if (SELECTED_COMPLEXES.has(cx)) {
        SELECTED_COMPLEXES.delete(cx);
      } else {
        SELECTED_COMPLEXES.add(cx);
      }
      renderDayView();
      renderWeekTimeline();
      renderComplexFilters();
    });

    bar.appendChild(btn);
  });
}

/* ------------------------------------------------------------------
   DAY VIEW REWRITE: SINGLE-LANE TIMELINE + NESTLED AVAILABILITY
------------------------------------------------------------------- */

// Get the list of fields to consider, honoring complex filters
function getVisibleFieldIds(dayData) {
  let fieldIds = dayData.fields.map(f => f.id);

  if (SELECTED_COMPLEXES.size > 0) {
    fieldIds = fieldIds.filter(fid => {
      const f = FIELD_MAP[fid];
      if (!f) return false;
      const cx = extractComplexFromSurface(f.name);
      return cx && SELECTED_COMPLEXES.has(cx);
    });
  }

  return fieldIds;
}

// Flatten events for the day across visible fields
function collectEventsForDay(dayData, fieldIds) {
  const events = [];
  const eventsByField = dayData.events || {};

  fieldIds.forEach(fid => {
    (eventsByField[fid] || []).forEach(ev => {
      events.push({
        ...ev,
        startMin: timeToMin(ev.start),
        endMin: timeToMin(ev.end),
        fields: [ev.field] // so buildBlockLabel still works
      });
    });
  });

  events.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return events;
}

// Compute global availability windows from dayData.availability
// Availability "nests" around events and lists all free fields
function computeGlobalAvailability(dayData, fieldIds) {
  const dayStart = 8 * 60;
  const dayEnd = 21 * 60;
  const availMap = dayData.availability || {};

  const windows = [];
  let currentStart = null;
  let currentFieldIds = null;

  for (let m = dayStart; m <= dayEnd; m++) {
    const minuteFields = [];

    fieldIds.forEach(fid => {
      const arr = availMap[fid] || [];
      const isFree = arr.some(win => {
        const s = timeToMin(win.start);
        const e = timeToMin(win.end);
        return m >= s && m < e;
      });
      if (isFree) minuteFields.push(fid);
    });

    const key = minuteFields.join("|");

    if (minuteFields.length === 0) {
      if (currentStart !== null) {
        windows.push({
          startMin: currentStart,
          endMin: m,
          fieldIds: currentFieldIds
        });
        currentStart = null;
        currentFieldIds = null;
      }
    } else {
      if (currentStart === null) {
        currentStart = m;
        currentFieldIds = [...minuteFields];
      } else {
        const prevKey = currentFieldIds.join("|");
        if (key !== prevKey) {
          windows.push({
            startMin: currentStart,
            endMin: m,
            fieldIds: currentFieldIds
          });
          currentStart = m;
          currentFieldIds = [...minuteFields];
        }
      }
    }
  }

  if (currentStart !== null) {
    windows.push({
      startMin: currentStart,
      endMin: dayEnd,
      fieldIds: currentFieldIds
    });
  }

  // Only keep windows where at least one field is free
  return windows.filter(w => w.fieldIds && w.fieldIds.length > 0);
}

// ---- DAY TIMELINE RENDERER (SINGLE LANE) ----
function renderDayTimeline(dayData) {
  const timelineEl = document.getElementById("dayTimeline");
  if (!timelineEl) return;

  const fieldIds = getVisibleFieldIds(dayData);

  if (fieldIds.length === 0) {
    timelineEl.innerHTML = `<p>No fields selected.</p>`;
    return;
  }

  const events = collectEventsForDay(dayData, fieldIds);
  const availWindows = computeGlobalAvailability(dayData, fieldIds);

  // Clear and build single-lane layout
  timelineEl.innerHTML = `
    <div class="time-ruler"></div>
    <div class="timeline-column"></div>
  `;

  const ruler = timelineEl.querySelector(".time-ruler");
  const column = timelineEl.querySelector(".timeline-column");

  // Time labels
  HOURS.forEach(h => {
    const y = timeToY(h);
    const label = document.createElement("div");
    label.className = "time-label";
    label.style.top = `${y}px`;
    label.textContent = h;
    ruler.appendChild(label);
  });

  // Availability blocks (green), nestling around events
  availWindows.forEach(win => {
    const top = win.startMin - 8 * 60;
    const height = win.endMin - win.startMin;

    const div = document.createElement("div");
    div.className = "timeline-block block-available";
    div.style.top = `${top}px`;
    div.style.height = `${height}px`;

    const startStr = `${String(Math.floor(win.startMin / 60)).padStart(2, "0")}:${String(win.startMin % 60).padStart(2, "0")}`;
    const endStr = `${String(Math.floor(win.endMin / 60)).padStart(2, "0")}:${String(win.endMin % 60).padStart(2, "0")}`;

    const fieldNames = win.fieldIds
      .map(fid => FIELD_MAP[fid]?.name || fid)
      .join(", ");

    div.textContent = `Available: ${fieldNames} | ${startStr}–${endStr}`;
    column.appendChild(div);
  });

  // Event blocks on top (practice/game/admin)
  events.forEach(ev => {
    const top = ev.startMin - 8 * 60;
    const height = ev.endMin - ev.startMin;

    const div = document.createElement("div");
    div.className = `timeline-block block-${ev.type}`;
    div.style.top = `${top}px`;
    div.style.height = `${height}px`;

    div.textContent = buildBlockLabel(ev);
    column.appendChild(div);
  });
}

// ---- BLOCK LABEL BUILDER ----
function buildBlockLabel(block) {
  const parts = [];
  parts.push(`${block.start}–${block.end}`);

  if (block.fields?.length) {
    const names = block.fields.map(id => FIELD_MAP[id]?.name || id);
    parts.push(names.join(", "));
  } else if (block.field) {
    const name = FIELD_MAP[block.field]?.name || block.field;
    parts.push(name);
  }

  if (block.team) parts.push(block.team);
  if (block.notes) parts.push(block.notes);
  if (block.title && !parts.includes(block.title)) parts.push(block.title);

  return parts.join(" | ");
}
