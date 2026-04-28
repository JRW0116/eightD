const STORAGE_KEY = "eightD-report-v1";

const tableConfigs = {
  teamMembers: {
    bodyId: "teamMembersBody",
    columns: [
      { key: "department", type: "text" },
      { key: "name", type: "text" },
      { key: "roleSkills", type: "textarea" },
      { key: "responsibility", type: "textarea" }
    ],
    defaultRows: 5
  },
  isIsNot: {
    bodyId: "isIsNotBody",
    columns: [
      { key: "category", type: "text" },
      { key: "is", type: "textarea" },
      { key: "isNot", type: "textarea" }
    ],
    defaultRows: 6
  },
  relatedSystems: {
    bodyId: "relatedSystemsBody",
    columns: [
      { key: "documentSystem", type: "text" },
      { key: "owner", type: "text" },
      { key: "plannedDate", type: "date" },
      { key: "actualDate", type: "date" }
    ],
    defaultRows: 6
  },
  approvals: {
    bodyId: "approvalsBody",
    columns: [
      { key: "name", type: "text" },
      { key: "title", type: "text" },
      { key: "signature", type: "text" },
      { key: "date", type: "date" }
    ],
    defaultRows: 3
  },
  actionItems: {
    bodyId: "actionItemsBody",
    columns: [
      { key: "actionNumber", type: "text" },
      { key: "description", type: "textarea" },
      { key: "type", type: "text" },
      { key: "owner", type: "text" },
      { key: "plannedDate", type: "date" },
      { key: "actualDate", type: "date" },
      { key: "status", type: "text" },
      { key: "verification", type: "textarea" }
    ],
    defaultRows: 8
  }
};

const form = document.getElementById("reportForm");
const saveStatus = document.getElementById("saveStatus");
const importFile = document.getElementById("importFile");
const removeButtonTemplate = document.getElementById("removeButtonTemplate");

let autoSaveTimer = null;

function blankRow(config) {
  return Object.fromEntries(config.columns.map((column) => [column.key, ""]));
}

function createInput(fieldName, type, value) {
  const input = document.createElement(type === "textarea" ? "textarea" : "input");
  input.name = fieldName;
  if (type === "textarea") {
    input.rows = 3;
  } else {
    input.type = type;
  }
  input.value = value ?? "";
  return input;
}

function addTableRow(tableKey, rowData = null) {
  const config = tableConfigs[tableKey];
  const tbody = document.getElementById(config.bodyId);
  const row = rowData ?? blankRow(config);
  const tr = document.createElement("tr");

  config.columns.forEach((column) => {
    const td = document.createElement("td");
    const input = createInput(`${tableKey}.${column.key}`, column.type, row[column.key]);
    input.dataset.tableKey = tableKey;
    input.dataset.columnKey = column.key;
    td.appendChild(input);
    tr.appendChild(td);
  });

  const actionTd = document.createElement("td");
  actionTd.className = "actions-col";
  const button = removeButtonTemplate.content.firstElementChild.cloneNode(true);
  button.addEventListener("click", () => {
    tr.remove();
    scheduleAutoSave();
  });
  actionTd.appendChild(button);
  tr.appendChild(actionTd);

  tbody.appendChild(tr);
}

function getTableData(tableKey) {
  const config = tableConfigs[tableKey];
  const tbody = document.getElementById(config.bodyId);

  return [...tbody.querySelectorAll("tr")].map((tr) => {
    const row = {};
    config.columns.forEach((column) => {
      const field = tr.querySelector(`[data-column-key="${column.key}"]`);
      row[column.key] = field?.value ?? "";
    });
    return row;
  });
}

function setTableData(tableKey, rows = []) {
  const config = tableConfigs[tableKey];
  const tbody = document.getElementById(config.bodyId);
  tbody.innerHTML = "";

  const normalizedRows = rows.length ? rows : Array.from({ length: config.defaultRows }, () => blankRow(config));
  normalizedRows.forEach((row) => addTableRow(tableKey, row));
}

function collectFormData() {
  const data = {};
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    if (!key.includes(".")) {
      data[key] = value;
    }
  }

  Object.keys(tableConfigs).forEach((tableKey) => {
    data[tableKey] = getTableData(tableKey);
  });

  return data;
}

function populateForm(data) {
  form.querySelectorAll("input, textarea").forEach((field) => {
    if (field.dataset.tableKey) {
      return;
    }

    if (field.type === "radio") {
      field.checked = data[field.name] === field.value;
    } else {
      field.value = data[field.name] ?? "";
    }
  });

  Object.keys(tableConfigs).forEach((tableKey) => {
    setTableData(tableKey, data[tableKey]);
  });

  updateHero();
}

function saveToBrowser(showMessage = true) {
  const payload = collectFormData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  updateHero();
  if (showMessage) {
    setStatus(`Saved locally at ${new Date().toLocaleString()}`);
  }
}

function loadFromBrowser() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      populateForm(JSON.parse(saved));
      setStatus("Loaded saved draft from this browser");
      return;
    } catch {
      setStatus("Saved draft could not be loaded");
    }
  }

  Object.keys(tableConfigs).forEach((tableKey) => setTableData(tableKey));
}

function exportJson() {
  const payload = collectFormData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${payload.trackingNumber || "8d-report"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("JSON export created");
}

function importJson(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      populateForm(data);
      saveToBrowser(false);
      setStatus(`Imported ${file.name}`);
    } catch {
      setStatus("Import failed. Choose a valid JSON export.");
    }
  };
  reader.readAsText(file);
}

function clearForm() {
  localStorage.removeItem(STORAGE_KEY);
  form.reset();
  Object.keys(tableConfigs).forEach((tableKey) => setTableData(tableKey));
  updateHero();
  setStatus("Form cleared");
}

function setStatus(message) {
  saveStatus.textContent = message;
}

function scheduleAutoSave() {
  updateHero();
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    saveToBrowser(false);
    setStatus(`Auto-saved at ${new Date().toLocaleTimeString()}`);
  }, 500);
}

function updateHero() {
  const trackingNumber = form.elements.trackingNumber?.value?.trim() || "Not set";
  const preparedBy = form.elements.preparedBy?.value?.trim() || "Not set";
  document.getElementById("heroTrackingNumber").textContent = trackingNumber;
  document.getElementById("heroPreparedBy").textContent = preparedBy;
}

document.querySelectorAll("[data-add-row]").forEach((button) => {
  button.addEventListener("click", () => {
    addTableRow(button.dataset.addRow);
    scheduleAutoSave();
  });
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "save") {
      saveToBrowser();
    } else if (action === "export") {
      exportJson();
    } else if (action === "print") {
      window.print();
    } else if (action === "clear") {
      clearForm();
    }
  });
});

form.addEventListener("input", scheduleAutoSave);
form.addEventListener("change", scheduleAutoSave);

importFile.addEventListener("change", (event) => {
  importJson(event.target.files[0]);
  event.target.value = "";
});

loadFromBrowser();
