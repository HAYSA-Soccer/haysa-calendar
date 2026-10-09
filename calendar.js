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


function getEventTitlesForWindow(dayData, window) {
  const titles = [];

  window.fields.forEach(fieldId => {
    const events = dayData.events[fieldId] || [];

    events.forEach(ev => {
      if (ev.start === window.start && ev.end === window.end) {
        titles.push(ev.title);
      }
    });
  });

  return titles;
}



/****************************************************
 * VIEW SWITCHER
 ****************************************************/
function switchView(mode) {
  CURRENT_VIEW = mode;

  if (mode === "day") {
    renderDayView();
  } else if (mode === "week") {
    renderWeekTimeline();   // <-- FIXED
  } else if (mode === "month") {
    renderMonthView();
  } else if (mode === "search") {
    renderSearchView();
  }
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

  /* Jump-to-time navigation */
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
    const windows = dayData.complex_timeline[cx];

    const section = document.createElement("div");
    section.className = `complex-section complex-accent-${cx.replace(/\s/g, "\\ ")}`;

    const title = document.createElement("h3");
    title.textContent = cx;

    /* Collapsible complex sections */
    title.style.cursor = "pointer";
    title.addEventListener("click", () => {
      section.classList.toggle("collapsed");
    });

    section.appendChild(title);

    windows.forEach(w => {
      const card = document.createElement("div");
      card.className = "day-window-card";
      card.dataset.start = w.start;

      /* Normalize title for keyword checks */
      const txt = (w.title || "").toLowerCase();

      /* --- COLOR RULES (your exact rules) --- */

      // Availability → green
      if (w.type === "free") {
        card.classList.add("block-free");
      }

      // Practice → gray
      else if (w.type === "practice" || txt.includes("practice")) {
        card.classList.add("block-practice");
      }

      // Game / Team → blue
      else if (w.type === "game" || txt.includes("vs") || txt.includes("game")) {
        card.classList.add("block-game");
      }

      // Blocks_ → red unless containing game/practice
      else if (w.source === "blocks") {
        if (txt.includes("game") || txt.includes("practice")) {
          card.classList.add("block-game");   // treat as game/practice
        } else {
          card.classList.add("block-admin");  // red
        }
      }

      // Fallback → red
      else {
        card.classList.add("block-admin");
      }

      const durationMin = timeToMin(w.end) - timeToMin(w.start);

      /* --- LABEL RULES (your exact rules) --- */

      let labelHTML;

      if (w.type === "free") {
        labelHTML = "Availability";
      }
      else if (w.type === "practice" || txt.includes("practice")) {
        labelHTML = w.title || "Practice";
      }
      else if (w.type === "game" || txt.includes("vs") || txt.includes("game")) {
        labelHTML = w.title || "Game";
      }
      else if (w.source === "blocks") {
        if (txt.includes("game")) labelHTML = "Game";
        else if (txt.includes("practice")) labelHTML = "Practice";
        else labelHTML = "Blocked";
      }
      else {
        labelHTML = "Blocked";
      }

      /* HEADER */
      const header = document.createElement("div");
      header.className = "day-window-header";
      header.innerHTML = `
        ${labelHTML}
        <span class="day-badge">${durationMin} min</span>
        <span class="day-badge">${w.fields.length} fields</span>
      `;
      card.appendChild(header);

      /* TIME RANGE */
      const sub = document.createElement("div");
      sub.className = "day-window-sub";
      sub.textContent = `${w.start}–${w.end}`;
      card.appendChild(sub);

      /* FIELD CHIPS */
      const fieldWrap = document.createElement("div");
      fieldWrap.className = "day-window-fields";

      w.fields.forEach(f => {
        const chip = document.createElement("span");
        chip.className = "field-chip";
        chip.textContent = f;
        fieldWrap.appendChild(chip);
      });

      card.appendChild(fieldWrap);

      /* Hover tooltip */
      card.addEventListener("mouseenter", () => {
        const tip = document.createElement("div");
        tip.className = "week-block-tooltip";

        tip.textContent = w.title
          ? w.title
          : `${labelHTML} • ${w.start}–${w.end} • ${w.fields.length} fields`;

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


/***********************************************
* DISPLAY TITLES OF EVENTS
***********************************************/

function getEventTitlesForWindow(dayData, window) {
  const titles = [];

  window.fields.forEach(fieldId => {
    const events = dayData.events[fieldId] || [];

    events.forEach(ev => {
      if (ev.start === window.start && ev.end === window.end) {
        titles.push(ev.title);
      }
    });
  });

  return titles;
}


/****************************************************
 * WEEK VIEW (STATIC JSON)
 ****************************************************/
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);

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
  container.innerHTML = "";

  const days = getWeekRange(currentDate);
  const timeline = document.createElement("div");
  timeline.className = "week-timeline";

  days.forEach(dateStr => {
    const dayData = AVAIL.days[dateStr] || null;

    const dayCol = document.createElement("div");
    dayCol.className = "week-day-col";

    // HEADER
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

    // Highlight today
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStr === todayStr) dayCol.classList.add("today");

    const body = document.createElement("div");
    body.className = "week-day-body";

    // Time labels
    HOURS.forEach((h, idx) => {
      const lbl = document.createElement("div");
      lbl.className = "week-time-label";
      lbl.style.top = `${idx * 60}px`;
      lbl.textContent = h;
      body.appendChild(lbl);
    });

    // No data
    if (!dayData) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "week-empty";
      emptyMsg.textContent = "No data";
      body.appendChild(emptyMsg);

      dayCol.appendChild(body);
      timeline.appendChild(dayCol);
      return;
    }

    // Complex filtering
    const visibleComplexes = Object.keys(dayData.complex_timeline).filter(cx => {
      if (SELECTED_COMPLEXES.size === 0) return true;
      return SELECTED_COMPLEXES.has(cx);
    });

    visibleComplexes.forEach(cx => {
      const windows = dayData.complex_timeline[cx];

      // Max fields for width scaling
      const maxFields = Math.max(...windows.map(win => win.fields.length));

      // Lane assignment
      const laneAssignments = [];

      windows.forEach(w => {
        const startY = timeToY(w.start);
        const endY = timeToY(w.end);

        let laneIndex = 0;
        while (
          laneAssignments[laneIndex] &&
          laneAssignments[laneIndex].some(b => !(endY <= b.startY || startY >= b.endY))
        ) {
          laneIndex++;
        }

        if (!laneAssignments[laneIndex]) laneAssignments[laneIndex] = [];
        laneAssignments[laneIndex].push({ startY, endY, w });
      });

      // Render blocks
      laneAssignments.forEach((lane, laneIndex) => {
        const baseWidth = 100 / laneAssignments.length;

        lane.forEach(({ startY, endY, w }) => {
          const block = document.createElement("div");
          block.className = "week-block";

          const txt = (w.title || "").toLowerCase();

          /* --- COLOR RULES (your exact rules) --- */

          if (w.type === "free") {
            block.classList.add("block-free");        // GREEN
          }
          else if (w.type === "practice" || txt.includes("practice")) {
            block.classList.add("block-practice");    // GRAY
          }
          else if (w.type === "game" || txt.includes("vs") || txt.includes("game")) {
            block.classList.add("block-game");        // BLUE
          }
          else if (w.source === "blocks") {
            if (txt.includes("game") || txt.includes("practice")) {
              block.classList.add("block-game");      // BLUE
            } else {
              block.classList.add("block-admin");     // RED
            }
          }
          else {
            block.classList.add("block-admin");       // RED
          }

          const height = endY - startY;
          block.style.position = "absolute";
          block.style.top = `${startY}px`;
          block.style.height = `${height}px`;

          const fieldScale = w.fields.length / maxFields;
          const scaledWidth = Math.max(baseWidth * fieldScale, baseWidth * 0.4);

          block.style.left = `${laneIndex * baseWidth}%`;
          block.style.width = `${scaledWidth}%`;

          const durationMin = timeToMin(w.end) - timeToMin(w.start);

          /* --- LABEL RULES (your exact rules) --- */

          let labelHTML;

          if (w.type === "free") {
            labelHTML = "Availability";
          }
          else if (w.type === "practice" || txt.includes("practice")) {
            labelHTML = w.title || "Practice";
          }
          else if (w.type === "game" || txt.includes("vs") || txt.includes("game")) {
            labelHTML = w.title || "Game";
          }
          else if (w.source === "blocks") {
            if (txt.includes("game")) labelHTML = "Game";
            else if (txt.includes("practice")) labelHTML = "Practice";
            else labelHTML = "Blocked";
          }
          else {
            labelHTML = "Blocked";
          }

          block.innerHTML = `
            <div class="label">
              ${labelHTML}
              <span class="week-badge">${durationMin} min</span>
              <span class="week-badge">${w.fields.length} fields</span>
            </div>
            <div class="sub">${w.start}–${w.end}</div>
            <div class="fields">${w.fields.join(", ")}</div>
          `;

          // Tooltip
          block.addEventListener("mouseenter", () => {
            const tip = document.createElement("div");
            tip.className = "week-block-tooltip";

            tip.textContent = w.title
              ? w.title
              : `${labelHTML} • ${w.start}–${w.end} • ${w.fields.length} fields`;

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

          // Click-to-day
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
