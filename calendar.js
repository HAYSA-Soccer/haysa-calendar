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
  // Hide all timeline containers
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

  // Placeholder — timeline engine comes next
  document.getElementById("dayTimeline").innerHTML = `<p>Day timeline will go here.</p>`;
}

// ---- WEEK VIEW SHELL ----
function renderWeekTimeline() {
  const container = document.getElementById("view-container");
  if (!container || !AVAIL) return;

  container.innerHTML = `<h2>Week View</h2>`;
  const weekEl = document.getElementById("weekTimeline");
  weekEl.innerHTML = "";

  const days = getWeekRange(currentDate);

  // Placeholder — real timeline comes later
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
  if (surfaceName.includes("Holbrook High School Turf")) return "TURF";
  if (surfaceName.includes("Sumner")) return "SUMNER/SEAN JOYCE";
  if (surfaceName.includes("Brookville")) return "BROOKVILLE";
  if (surfaceName.includes("Butler")) return "BUTLER";
  return null;
}

function renderComplexFilters() {
  const bar = document.getElementById("complex-filters");
  if (!bar || !AVAIL) return;

  bar.innerHTML = "";

  // Build a unique list of complexes from FIELD_MAP
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
