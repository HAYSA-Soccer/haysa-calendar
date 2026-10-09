/****************************************************
 * GLOBAL STATE
 ****************************************************/
let AVAIL = null;          // availability.json
let SEARCH = null;         // search_index.json

let currentDate = null;
let currentView = "day";
let SELECTED_MODE = "practice"; // practice/game
let SELECTED_COMPLEXES = new Set();



const HOURS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"];

function timeToY(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const minutes = (h - 8) * 60 + m; // 08:00 = top
  return minutes;
}


/****************************************************
 * LOAD STATIC JSON FILES
 ****************************************************/
async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return await res.json();
}

async function loadAllData() {
  AVAIL = await loadJSON("data/availability.json");
  SEARCH = await loadJSON("data/search_index.json");

  insertTimestamp();
}

/****************************************************
 * TIMESTAMP DISPLAY
 ****************************************************/
function insertTimestamp() {
  const tsEl = document.getElementById("dataTimestamp");
  if (!tsEl) return;

  const now = new Date();
  tsEl.textContent = `Data last updated: ${now.toLocaleString()}`;
}

/****************************************************
 * COMPLEX FILTERS
 ****************************************************/
function renderComplexFilters() {
  const container = document.getElementById("complex-filters");
  const status = document.getElementById("complex-status");

  const complexes = Object.keys(AVAIL.complexes);

  let html = "";
  complexes.forEach(cx => {
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

function toggleComplex(cx) {
  if (SELECTED_COMPLEXES.has(cx)) {
    SELECTED_COMPLEXES.delete(cx);
  } else {
    SELECTED_COMPLEXES.add(cx);
  }

  renderComplexFilters();
  switchView(currentView);
}

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
 * DAY VIEW (STATIC JSON)
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

  const dayData = AVAIL.days[currentDate];
  if (!dayData) {
    document.getElementById("dayResults").innerHTML = `<p>No data for ${currentDate}</p>`;
    return;
  }

  renderDayCalendar(dayData);
}

function renderDayCalendar(dayData) {
  const container = document.getElementById("dayResults");
  container.innerHTML = "";

  const visibleComplexes = Object.keys(dayData.complex_timeline).filter(cx => {
    if (SELECTED_COMPLEXES.size === 0) return true;
    return SELECTED_COMPLEXES.has(cx);
  });

  visibleComplexes.forEach(cx => {
    const windows = dayData.complex_timeline[cx];

    const section = document.createElement("div");
    section.className = "complex-section";

    const title = document.createElement("h3");
    title.textContent = cx;
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

      w.fields.forEach(f => {
        const li = document.createElement("li");
        li.textContent = f;
        list.appendChild(li);
      });

      card.appendChild(list);
      section.appendChild(card);
    });

    container.appendChild(section);
  });
}

/****************************************************
 * WEEK VIEW (STATIC JSON)
 ****************************************************/
function getWeekRange(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);

  const out = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(d);
    dt.setDate(d.getDate() + i);
    out.push(dt.toISOString().split("T")[0]);
  }
  return out;
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

  renderWeekTimeline();
}

function renderWeekTimeline() {
  const container = document.getElementById("weekTimeline");
  container.innerHTML = "";

  const days = getWeekRange(currentDate);
  const timeline = document.createElement("div");
  timeline.className = "week-timeline";

  days.forEach(dateStr => {
    const dayData = AVAIL.days[dateStr];
    if (!dayData) return;

    const dayCol = document.createElement("div");
    dayCol.className = "week-day-col";

    const header = document.createElement("div");
    header.className = "week-day-header";
    header.textContent = dateStr;
    dayCol.appendChild(header);

    const body = document.createElement("div");
    body.className = "week-day-body";

    // STEP 3: Add time labels (08:00 → 21:00)
    HOURS.forEach((h, idx) => {
      const lbl = document.createElement("div");
      lbl.className = "week-time-label";
      lbl.style.top = `${idx * 60}px`;
      lbl.textContent = h;
      body.appendChild(lbl);
    });

    // Use complex_timeline instead of merged
    const visibleComplexes = Object.keys(dayData.complex_timeline).filter(cx => {
      if (SELECTED_COMPLEXES.size === 0) return true;
      return SELECTED_COMPLEXES.has(cx);
    });

    visibleComplexes.forEach(cx => {
      const windows = dayData.complex_timeline[cx];

      // STEP 5: Compute max fields ONCE per complex
      const maxFields = Math.max(...windows.map(win => win.fields.length));

      // STEP 4: Build lanes for overlapping blocks
      const laneAssignments = [];

      windows.forEach(w => {
        const startY = timeToY(w.start);
        const endY = timeToY(w.end);

        let laneIndex = 0;
        while (
          laneAssignments[laneIndex] &&
          laneAssignments[laneIndex].some(b => {
            return !(endY <= b.startY || startY >= b.endY);
          })
        ) {
          laneIndex++;
        }

        if (!laneAssignments[laneIndex]) laneAssignments[laneIndex] = [];
        laneAssignments[laneIndex].push({ startY, endY, w });
      });

      // Render blocks with lane positioning + multi-field scaling + type colors + hover + click
      laneAssignments.forEach((lane, laneIndex) => {
        const baseWidth = 100 / laneAssignments.length;

        lane.forEach(({ startY, endY, w }) => {
          const block = document.createElement("div");
          block.className = "week-block";

          // STEP 6: Type-based color coding
          if (w.type === "free") {
            block.classList.add("block-free");
          } else if (w.type === "practice") {
            block.classList.add("block-practice");
          } else if (w.type === "game") {
            block.classList.add("block-game");
          } else {
            block.classList.add("block-admin");
          }

          const height = endY - startY;

          block.style.position = "absolute";
          block.style.top = `${startY}px`;
          block.style.height = `${height}px`;

          // STEP 5: Multi-field width scaling
          const fieldScale = w.fields.length / maxFields;
          const scaledWidth = Math.max(baseWidth * fieldScale, baseWidth * 0.4);

          block.style.left = `${laneIndex * baseWidth}%`;
          block.style.width = `${scaledWidth}%`;

          block.innerHTML = `
            <div class="label">${w.type === "free" ? "Availability" : cx}</div>
            <div class="sub">${w.start}–${w.end} (${w.fields.length} fields)</div>
            <div class="fields">${w.fields.join(", ")}</div>
          `;

          // STEP 7A: Hover tooltip
          block.addEventListener("mouseenter", e => {
            const tip = document.createElement("div");
            tip.className = "week-block-tooltip";
            tip.textContent = `${w.type.toUpperCase()} • ${w.start}–${w.end} • ${w.fields.length} fields`;
            document.body.appendChild(tip);

            const rect = block.getBoundingClientRect();
            tip.style.left = `${rect.right + 8}px`;
            tip.style.top = `${rect.top}px`;

            block._tooltip = tip;
          });

          block.addEventListener("mouseleave", () => {
            if (block._tooltip) {
              block._tooltip.remove();
              block._tooltip = null;
            }
          });

          // STEP 7B: Click-to-open Day View
          block.addEventListener("click", () => {
            currentDate = dateStr;
            switchView("day");
          });

          body.appendChild(block);
        });
      });
    });

    dayCol.appendChild(body);
    timeline.appendChild(dayCol);
  });

  container.appendChild(timeline);
}




/****************************************************
 * MONTH VIEW (STATIC JSON)
 ****************************************************/
function renderMonthView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Month View</h2>
    <p>Month view will use AVAIL.months[...] data.</p>
  `;
}

/****************************************************
 * SEARCH VIEW (STATIC JSON + FULL/PARTIAL/NEARBY)
 ****************************************************/
function renderSearchView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Search</h2>
    <div class="controls">
      <label>Date: <input type="date" id="searchDate" value="${currentDate}"></label>
      <label>Complex:
        <select id="searchComplex">
          ${Object.keys(AVAIL.complexes).map(cx => `<option value="${cx}">${cx}</option>`).join("")}
        </select>
      </label>
      <label>Start: <input type="time" id="searchStart" value="17:00"></label>
      <label>Duration (min): <input type="number" id="searchDuration" value="90"></label>
      <button id="searchRun">Search</button>
    </div>
    <div id="searchResults"></div>
  `;

  document.getElementById("searchRun").onclick = runSearch;
}

function runSearch() {
  const date = document.getElementById("searchDate").value;
  const complex = document.getElementById("searchComplex").value;
  const start = document.getElementById("searchStart").value;
  const duration = parseInt(document.getElementById("searchDuration").value, 10);

  const results = document.getElementById("searchResults");
  results.innerHTML = "";

  const daySearch = SEARCH[date];
  if (!daySearch || !daySearch[complex]) {
    results.innerHTML = `<p>No free windows found.</p>`;
    return;
  }

  const windows = daySearch[complex];

  const reqStartMin = timeToMin(start);
  const reqEndMin = reqStartMin + duration;

  const full = [];
  const partial = [];
  const nearby = [];

  windows.forEach(w => {
    const wStart = timeToMin(w.start);
    const wEnd = timeToMin(w.end);

    if (wStart <= reqStartMin && wEnd >= reqEndMin) {
      full.push(w);
    } else if (wStart <= reqStartMin && wEnd > reqStartMin && wEnd < reqEndMin) {
      partial.push(w);
    } else if (wStart >= reqStartMin) {
      nearby.push(w);
    }
  });

  renderSearchResults(full, partial, nearby);
}

function renderSearchResults(full, partial, nearby) {
  const container = document.getElementById("searchResults");

  let html = "";

  if (full.length) {
    html += `<h3 class="full-header">FULL MATCHES</h3>`;
    full.forEach(w => {
      html += renderSearchCard(w, true);
    });
  }

  if (partial.length) {
    html += `<h3>PARTIAL MATCHES</h3>`;
    partial.forEach(w => {
      html += renderSearchCard(w, false);
    });
  }

  if (nearby.length) {
    html += `<h3>NEARBY MATCHES</h3>`;
    nearby.forEach(w => {
      html += renderSearchCard(w, false);
    });
  }

  container.innerHTML = html || `<p>No matches found.</p>`;
}

function renderSearchCard(w, isFull) {
  return `
    <div class="search-card ${isFull ? "full-match" : ""}">
      <div class="search-header">
        ${w.start} – ${w.end} (${w.fields.length} fields)
        ${isFull ? `<span class="full-tag">FULL MATCH</span>` : ""}
      </div>
      <ul class="search-field-list">
        ${w.fields.map(f => `<li>${f}</li>`).join("")}
      </ul>
    </div>
  `;
}

/****************************************************
 * TIME HELPERS
 ****************************************************/
function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/****************************************************
 * INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  currentDate = new Date().toISOString().split("T")[0];

  await loadAllData();

  const modeSelect = document.getElementById("schedModeSelect");
  modeSelect.addEventListener("change", e => {
    SELECTED_MODE = e.target.value;
    switchView(currentView);
  });

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  renderComplexFilters();
  switchView("day");
});
