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
  const resp = await fetch("data/availability.json");   // <-- UPDATED
  AVAIL = await resp.json();

  // Build FIELD_MAP from AVAIL.fields
  window.FIELD_MAP = buildFieldMap(AVAIL.fields);

  // Timestamp display
  const tsEl = document.getElementById("dataTimestamp");
  if (tsEl && AVAIL.generated_at) {
    tsEl.textContent = `Data as of ${AVAIL.generated_at}`;
  }
}

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
