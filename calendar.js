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
  if (!dayData || !dayData.complex_timeline) {
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

// ---- AVAILABILITY PER FIELD ----
function buildFieldAvailability(dayData) {
  const availability = {}; // fieldId -> array of { start, end }

  Object.values(FIELD_MAP).forEach(f => {
    availability[f.id] = [];
  });

  const blocked = {}; // fieldId -> array of { startMin, endMin }
  Object.values(FIELD_MAP).forEach(f => blocked[f.id] = []);

  Object.entries(dayData.complex_timeline).forEach(([complexName, blocks]) => {
    blocks.forEach(block => {
      if (!block.fields) return;
      const startMin = timeToMin(block.start);
      const endMin = timeToMin(block.end);

      block.fields.forEach(fid => {
        blocked[fid].push({ startMin, endMin });
      });
    });
  });

  Object.keys(blocked).forEach(fid => {
    const dayStart = 8 * 60;
    const dayEnd = 21 * 60;
    let cursor = dayStart;

    while (cursor < dayEnd) {
      const nextBlock = blocked[fid].find(b =>
        b.startMin <= cursor && b.endMin > cursor
      );

      if (nextBlock) {
        cursor = nextBlock.endMin;
        continue;
      }

      const availStart = cursor;

      while (cursor < dayEnd) {
        const overlappingBlock = blocked[fid].find(b =>
          b.startMin <= cursor && b.endMin > cursor
        );
        if (overlappingBlock) break;
        cursor++;
      }

      const availEnd = cursor;

      availability[fid].push({
        start: `${String(Math.floor(availStart / 60)).padStart(2, "0")}:${String(availStart % 60).padStart(2, "0")}`,
        end: `${String(Math.floor(availEnd / 60)).padStart(2, "0")}:${String(availEnd % 60).padStart(2, "0")}`
      });
    }
  });

  return availability;
}

// ---- OVERLAP HELPERS ----
function overlaps(a, b) {
  const aStart = timeToMin(a.start);
  const aEnd = timeToMin(a.end);
  const bStart = timeToMin(b.start);
  const bEnd = timeToMin(b.end);
  return aStart < bEnd && bStart < aEnd;
}

function assignLanes(blocks) {
  const lanes = [];

  blocks.forEach(block => {
    let placed = false;

    for (const lane of lanes) {
      if (!lane.some(b => overlaps(b, block))) {
        lane.push(block);
        block.laneIndex = lanes.indexOf(lane);
        placed = true;
        break;
      }
    }

    if (!placed) {
      lanes.push([block]);
      block.laneIndex = lanes.length - 1;
    }
  });

  return lanes.length;
}

// ---- DAY TIMELINE RENDERER WITH FIELD LANES ----
function renderDayTimeline(dayData) {
  const timelineEl = document.getElementById("dayTimeline");
  if (!timelineEl) return;

  // Determine which fields to show based on selected complexes
  let fieldIds = Object.values(FIELD_MAP).map(f => f.id);
  if (SELECTED_COMPLEXES.size > 0) {
    fieldIds = fieldIds.filter(fid => {
      const f = FIELD_MAP[fid];
      const cx = extractComplexFromSurface(f.name);
      return cx && SELECTED_COMPLEXES.has(cx);
    });
  }

  if (fieldIds.length === 0) {
    timelineEl.innerHTML = `<p>No fields selected.</p>`;
    return;
  }

  timelineEl.style.setProperty("--field-columns", `repeat(${fieldIds.length}, 1fr)`);

  // Build header + lanes
  timelineEl.innerHTML = `
    <div class="time-ruler"></div>
    ${fieldIds.map(fid => `<div class="field-lane" data-field="${fid}"></div>`).join("")}
  `;

  const ruler = timelineEl.querySelector(".time-ruler");

  HOURS.forEach(h => {
    const y = timeToY(h);
    const label = document.createElement("div");
    label.className = "time-label";
    label.style.top = `${y}px`;
    label.textContent = h;
    ruler.appendChild(label);
  });

  const fieldAvailability = buildFieldAvailability(dayData);

  // Render availability per field lane
  fieldIds.forEach(fid => {
    const lane = timelineEl.querySelector(`.field-lane[data-field="${fid}"]`);
    if (!lane) return;

    (fieldAvailability[fid] || []).forEach(av => {
      const top = timeToY(av.start);
      const height = timeToY(av.end) - top;

      const div = document.createElement("div");
      div.className = "timeline-block block-available";
      div.style.top = `${top}px`;
      div.style.height = `${height}px`;
      div.textContent = `${av.start}–${av.end}`;

      lane.appendChild(div);
    });
  });

  // Collect events per field for lane assignment
  const eventsByField = {};
  fieldIds.forEach(fid => eventsByField[fid] = []);

  Object.entries(dayData.complex_timeline).forEach(([complexName, blocks]) => {
    blocks.forEach(block => {
      if (!block.fields) return;
      block.fields.forEach(fid => {
        if (!eventsByField[fid]) return;
        eventsByField[fid].push(block);
      });
    });
  });

  // Assign lanes and render events per field
  fieldIds.forEach(fid => {
    const laneBlocks = eventsByField[fid];
    if (!laneBlocks || laneBlocks.length === 0) return;

    assignLanes(laneBlocks);

    const lane = timelineEl.querySelector(`.field-lane[data-field="${fid}"]`);
    if (!lane) return;

    laneBlocks.forEach(block => {
      const top = timeToY(block.start);
      const height = timeToY(block.end) - top;

      const div = document.createElement("div");
      div.className = `timeline-block block-${block.type}`;
      div.style.top = `${top}px`;
      div.style.height = `${height}px`;

      const laneOffset = block.laneIndex || 0;
      const laneWidthPct = 1 / (laneOffset + 1);
      div.style.left = `${10 + laneOffset * 20}px`;
      div.style.right = `10px`;

      div.textContent = buildBlockLabel(block);
      lane.appendChild(div);
    });
  });
}

// ---- BLOCK LABEL BUILDER ----
function buildBlockLabel(block) {
  const parts = [];
  parts.push(`${block.start}–${block.end}`);

  if (block.fields?.length) {
    const names = block.fields.map(id => FIELD_MAP[id]?.name || id);
    parts.push(names.join(", "));
  }

  if (block.team) parts.push(block.team);
  if (block.notes) parts.push(block.notes);

  return parts.join(" | ");
}
