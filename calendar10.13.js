/****************************************************
 * GLOBAL STATE
 ****************************************************/
let AVAIL = null;          // availability.json
let SEARCH = null;         // search_index.json

let currentDate = null;
let currentView = "week";  // default to week view
let SELECTED_COMPLEXES = new Set();

const HOURS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00",
  "18:00","19:00","20:00","21:00"
];

function timeToY(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const minutes = (h - 8) * 60 + m; // 08:00 = top
  return minutes;
}

function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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
 * COMPLEX FILTERS (per currentDate)
 ****************************************************/
function renderComplexFilters() {
  const container = document.getElementById("complex-filters");
  const status = document.getElementById("complex-status");
  if (!container || !AVAIL || !AVAIL.days || !currentDate) return;

  const dayData = AVAIL.days[currentDate];
  if (!dayData || !dayData.complex_timeline) {
    container.innerHTML = "";
    if (status) status.textContent = "No complexes for this date";
    return;
  }

  const complexes = Object.keys(dayData.complex_timeline);

  let html = "";
  complexes.forEach(cx => {
    const active = SELECTED_COMPLEXES.size === 0 || SELECTED_COMPLEXES.has(cx) ? "active" : "";
    html += `
      <button class="complex-btn ${active}" data-cx="${cx}">
        ${cx}
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll(".complex-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const cx = btn.dataset.cx;

      if (SELECTED_COMPLEXES.has(cx)) {
        SELECTED_COMPLEXES.delete(cx);
      } else {
        SELECTED_COMPLEXES.add(cx);
      }

      renderComplexFilters();
      renderCurrentView();
    });
  });

  if (!status) return;

  if (SELECTED_COMPLEXES.size === 0) {
    status.textContent = "Showing ALL complexes";
  } else {
    status.textContent = "Selected: " + Array.from(SELECTED_COMPLEXES).join(", ");
  }
}

/****************************************************
 * VIEW SWITCHER
 ****************************************************/
function renderCurrentView() {
  if (!AVAIL) return;

  if (currentView === "day") {
    renderDayView();
  } else if (currentView === "week") {
    renderWeekTimeline();
  } else if (currentView === "month") {
    renderMonthView();
  } else if (currentView === "search") {
    renderSearchView();
  }
}

function switchView(mode) {
  currentView = mode;
  renderCurrentView();
  renderComplexFilters();
}

/****************************************************
 * DAY VIEW (complex_timeline)
 ****************************************************/
function renderDayView() {
  const container = document.getElementById("view-container");
  if (!container) return;

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
    document.getElementById("dayResults").innerHTML = `<p>No data for ${currentDate}</p>`;
    return;
  }

  renderDayCalendar(dayData);
}

function renderDayCalendar(dayData) {
  const container = document.getElementById("dayResults");
  if (!container) return;
  container.innerHTML = "";

  const timeNav = document.createElement("div");
  timeNav.className = "day-time-nav";

  ["16:00", "17:00", "18:00", "19:00", "20:00"].forEach(t => {
    const btn = document.createElement("button");
    btn.textContent = t;
    btn.addEventListener("click", () => {
      const target = document.querySelector(`[data-start="${t}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    timeNav.appendChild(btn);
  });

  container.appendChild(timeNav);

  const visibleComplexes = Object.keys(dayData.complex_timeline).filter(cx => {
    if (SELECTED_COMPLEXES.size === 0) return true;
    return SELECTED_COMPLEXES.has(cx);
  });

  visibleComplexes.forEach(cx => {
    const blocks = dayData.complex_timeline[cx];

    const safeCx = cx.replace(/\W+/g, "_");
    const section = document.createElement("div");
    section.className = `complex-section complex-accent-${safeCx}`;

    const title = document.createElement("h3");
    title.textContent = cx;
    title.style.cursor = "pointer";
    title.addEventListener("click", () => {
      section.classList.toggle("collapsed");
    });

    section.appendChild(title);

    blocks.forEach(b => {
      const card = document.createElement("div");
      card.className = "day-window-card";
      card.dataset.start = b.start;

      card.classList.add(
        b.type === "free" ? "block-free" :
        b.type === "practice" ? "block-practice" :
        b.type === "game" ? "block-game" :
        "block-admin"
      );

      const durationMin = timeToMin(b.end) - timeToMin(b.start);

      const header = document.createElement("div");
      header.className = "day-window-header";
      header.innerHTML = `
        ${b.type.charAt(0).toUpperCase() + b.type.slice(1)}
        <span class="day-badge">${durationMin} min</span>
        <span class="day-badge">${b.fields.length} fields</span>
      `;
      card.appendChild(header);

      const sub = document.createElement("div");
      sub.className = "day-window-sub";
      sub.textContent = `${b.start_12}–${b.end_12}`;
      card.appendChild(sub);

      const fieldWrap = document.createElement("div");
      fieldWrap.className = "day-window-fields";

      b.fields.forEach(f => {
        const chip = document.createElement("span");
        chip.className = "field-chip";
        chip.textContent = f;
        fieldWrap.appendChild(chip);
      });

      card.appendChild(fieldWrap);

      card.addEventListener("mouseenter", () => {
        const tip = document.createElement("div");
        tip.className = "week-block-tooltip";
        tip.textContent = `${b.type.toUpperCase()} • ${b.start_12}–${b.end_12} • ${b.fields.length} fields`;

        document.body.appendChild(tip);

        const rect = card.getBoundingClientRect();
        tip.style.left = `${rect.right + 8}px`;
        tip.style.top = `${rect.top}px`;

        card._tooltip = tip;
      });

      card.addEventListener("mouseleave", () => {
        if (card._tooltip) {
          card._tooltip.remove();
          card._tooltip = null;
        }
      });

      section.appendChild(card);
    });

    container.appendChild(section);
  });
}

/****************************************************
 * WEEK VIEW (complex_timeline)
 ****************************************************/
function getWeekRange(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Move back to Sunday
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dow);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sunday);
    dt.setDate(sunday.getDate() + i);
    days.push(dt.toISOString().slice(0, 10)); // YYYY-MM-DD
  }

  return days;
}


function renderWeekTimeline() {
  const container = document.getElementById("view-container");
  if (!container) return;

  container.innerHTML = "";

  const days = getWeekRange(currentDate);
  const timeline = document.createElement("div");
  timeline.className = "week-timeline";

  const todayStr = new Date().toISOString().slice(0, 10);

  days.forEach(dateStr => {
    const dayData = AVAIL.days[dateStr] || null;

    const dayCol = document.createElement("div");
    dayCol.className = "week-day-col";

    if (dateStr === todayStr) {
      dayCol.classList.add("today");
    }

    const dt = new Date(dateStr);
    const dow = dt.toLocaleDateString("en-US", { weekday: "short" });
    const fmt = dt.toLocaleDateString("en-US");

    const header = document.createElement("div");
    header.className = "week-day-header";
    header.innerHTML = `
      <div class="week-dow">${dow}</div>
      <div class="week-date">${fmt}</div>
    `;
    dayCol.appendChild(header);

    const body = document.createElement("div");
    body.className = "week-day-body";

    HOURS.forEach((h, idx) => {
      const lbl = document.createElement("div");
      lbl.className = "week-time-label";
      lbl.style.top = `${idx * 60}px`;
      lbl.textContent = h;
      body.appendChild(lbl);
    });

    if (!dayData || !dayData.complex_timeline) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "week-empty";
      emptyMsg.textContent = "No data";
      body.appendChild(emptyMsg);

      dayCol.appendChild(body);
      timeline.appendChild(dayCol);
      return;
    }

    const visibleComplexes = Object.keys(dayData.complex_timeline).filter(cx => {
      if (SELECTED_COMPLEXES.size === 0) return true;
      return SELECTED_COMPLEXES.has(cx);
    });

    visibleComplexes.forEach(cx => {
      const blocks = dayData.complex_timeline[cx];
      if (!blocks || !blocks.length) return;

      const maxFields = Math.max(...blocks.map(b => b.fields.length));
      const laneAssignments = [];

      blocks.forEach(b => {
        const startY = timeToY(b.start);
        const endY = timeToY(b.end);

        let laneIndex = 0;
        while (
          laneAssignments[laneIndex] &&
          laneAssignments[laneIndex].some(existing => !(endY <= existing.startY || startY >= existing.endY))
        ) {
          laneIndex++;
        }

        if (!laneAssignments[laneIndex]) laneAssignments[laneIndex] = [];
        laneAssignments[laneIndex].push({ startY, endY, b });
      });

      laneAssignments.forEach((lane, laneIndex) => {
        const baseWidth = 100 / laneAssignments.length;

        lane.forEach(({ startY, endY, b }) => {
          const block = document.createElement("div");
          block.className = "week-block";

          block.classList.add(
            b.type === "free" ? "block-free" :
            b.type === "practice" ? "block-practice" :
            b.type === "game" ? "block-game" :
            "block-admin"
          );

          // NEW horizontal timeline logic for Week View
          const startMin = timeToMin(b.start);
          const endMin = timeToMin(b.end);
          
          const left = (startMin - 480);   // 480 = 08:00 in minutes
          const width = endMin - startMin;
          
          block.style.position = "absolute";
          block.style.left = `${left}px`;
          block.style.width = `${width}px`;
          
          // vertical stacking for overlapping blocks
          block.style.top = `${laneIndex * 60}px`;
          block.style.height = "50px";
          
          block.style.borderRadius = "6px";
          block.style.padding = "4px";
          block.style.boxSizing = "border-box";
          block.style.overflow = "hidden";


          const durationMin = timeToMin(b.end) - timeToMin(b.start);

          block.innerHTML = `
            <div class="label">
              ${b.type.toUpperCase()}
              <span class="week-badge">${durationMin} min</span>
              <span class="week-badge">${b.fields.length} fields</span>
            </div>
            <div class="sub">${b.start_12}–${b.end_12}</div>
            <div class="fields">${b.fields.join(", ")}</div>
          `;

          block.addEventListener("mouseenter", () => {
            const tip = document.createElement("div");
            tip.className = "week-block-tooltip";
            tip.textContent = `${b.type.toUpperCase()} • ${b.start_12}–${b.end_12} • ${b.fields.length} fields`;

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
 * MONTH VIEW (stub)
 ****************************************************/
function renderMonthView() {
  const container = document.getElementById("view-container");
  if (!container) return;

  container.innerHTML = `
    <h2>Month View</h2>
    <p>Month view will use AVAIL.months[...] data (to be implemented).</p>
  `;
}

/****************************************************
 * SEARCH VIEW (uses SEARCH + complex_timeline names)
 ****************************************************/
function renderSearchView() {
  const container = document.getElementById("view-container");
  if (!container) return;

  const dayData = AVAIL.days[currentDate];
  const complexes = dayData && dayData.complex_timeline
    ? Object.keys(dayData.complex_timeline)
    : [];

  container.innerHTML = `
    <h2>Search</h2>
    <div class="controls">
      <label>Date: <input type="date" id="searchDate" value="${currentDate}"></label>
      <label>Complex:
        <select id="searchComplex">
          ${complexes.map(cx => `<option value="${cx}">${cx}</option>`).join("")}
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
  if (!container) return;

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
        ${w.start_12} – ${w.end_12} (${w.fields.length} fields)
        ${isFull ? `<span class="full-tag">FULL MATCH</span>` : ""}
      </div>
      <ul class="search-field-list">
        ${w.fields.map(f => `<li>${f}</li>`).join("")}
      </ul>
    </div>
  `;
}

/****************************************************
 * INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  currentDate = new Date().toISOString().split("T")[0];

  await loadAllData();

  document.querySelectorAll(".nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  renderComplexFilters();
  renderCurrentView();
});
