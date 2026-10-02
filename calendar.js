const API_BASE = "https://script.google.com/macros/s/AKfycbxHYEJxV8KgtBc5u43H4B19912ZvPuvY0ifb_nrQFhQhy31VYiNALJNVhdQQnS9FPEa/exec";

document.querySelectorAll('.nav button').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Initial view
switchView("day");

function switchView(view) {
  if (view === "day") renderDayView();
  if (view === "week") renderWeekView();
  if (view === "month") renderMonthView();
  if (view === "search") renderSearchView();
}

/******************************
 * DAY VIEW
 ******************************/
function renderDayView() {
  const container = document.getElementById("view-container");

  container.innerHTML = `
    <h2>Day View</h2>
    <div class="controls">
      <input type="date" id="dayInput">
      <button id="dayLoadBtn">Load Availability</button>
    </div>
    <div id="dayResults"></div>
  `;

  document.getElementById("dayLoadBtn").addEventListener("click", loadDayAvailability);
}

async function loadDayAvailability() {
  const date = document.getElementById("dayInput").value;
  if (!date) {
    alert("Please select a date.");
    return;
  }

  const url = `${API_BASE}?mode=day&date=${date}`;
  const response = await fetch(url);
  const data = await response.json();

  const container = document.getElementById("dayResults");
  container.innerHTML = `<h3>Availability for ${date}</h3>`;

  Object.keys(data).forEach(fieldId => {
    const card = document.createElement("div");
    card.className = "field-card";

    const title = document.createElement("div");
    title.className = "field-title";
    title.textContent = fieldId;
    card.appendChild(title);

    const windows = data[fieldId];

    if (!windows || windows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "window-empty";
      empty.textContent = "No availability";
      card.appendChild(empty);
    } else {
      windows.forEach(w => {
        const div = document.createElement("div");
        div.className = "window";
        div.textContent = `${w.start} – ${w.end}`;
        card.appendChild(div);
      });
    }

    container.appendChild(card);
  });
}

/******************************
 * WEEK VIEW (placeholder)
 ******************************/
function renderWeekView() {
  const container = document.getElementById("view-container");
  container.innerHTML = `
    <h2>Week View</h2>
    <p>Week view coming next — powered by ?mode=range.</p>
  `;
}

/******************************
 * MONTH VIEW (placeholder)
 ******************************/
function renderMonthView() {
  const container = document.getElementById("view-container");
  container.innerHTML = `
    <h2>Month View</h2>
    <p>Month calendar grid coming next — powered by ?mode=month.</p>
  `;
}

/******************************
 * SEARCH VIEW (placeholder)
 ******************************/
function renderSearchView() {
  const container = document.getElementById("view-container");
  container.innerHTML = `
    <h2>Search</h2>
    <p>Search tools coming next — find fields available at specific times.</p>
  `;
}
