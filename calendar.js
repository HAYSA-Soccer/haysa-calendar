const API_BASE = "https://script.google.com/macros/s/AKfycbxHYEJxV8KgtBc5u43H4B19912ZvPuvY0ifb_nrQFhQhy31VYiNALJNVhdQQnS9FPEa/exec";

document.getElementById("loadBtn").addEventListener("click", loadAvailability);

async function loadAvailability() {
  const date = document.getElementById("dateInput").value;

  if (!date) {
    alert("Please select a date.");
    return;
  }

  const url = `${API_BASE}?mode=day&date=${date}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    renderAvailability(data, date);

  } catch (err) {
    console.error(err);
    alert("Error loading availability.");
  }
}

function renderAvailability(data, date) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  const header = document.createElement("h2");
  header.textContent = `Availability for ${date}`;
  container.appendChild(header);

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
