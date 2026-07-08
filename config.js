let currentState = {
    participants: {},
    timelineData: []
};

// --- Initialization ---

function init() {
    // Attempt to load from URL if editing an existing graph
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    if (encodedData) {
        try {
            const decompressed = LZString.decompressFromEncodedURIComponent(encodedData);
            if (decompressed) {
                currentState = JSON.parse(decompressed);
            }
        } catch (e) {
            console.error("Failed to parse URL data");
        }
    } else {
        // Fallback to data.js content
        currentState = JSON.parse(JSON.stringify(chartDataConfig));
    }

    setupTabs();
    setupEventListeners();
    renderTableView();
    renderJsonView();
}

// --- Tabs Logic ---

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const targetPaneId = btn.getAttribute('data-tab');
            document.getElementById(targetPaneId).classList.add('active');

            // Sync data on switch
            if (targetPaneId === 'table-view') {
                if (syncJsonToState()) {
                    renderTableView();
                } else {
                    // Revert tab if JSON is invalid
                    btn.classList.remove('active');
                    document.getElementById(targetPaneId).classList.remove('active');

                    const jsonBtn = document.querySelector('[data-tab="json-view"]');
                    jsonBtn.classList.add('active');
                    document.getElementById('json-view').classList.add('active');
                }
            } else if (targetPaneId === 'json-view') {
                syncTableToState();
                renderJsonView();
            }
        });
    });
}

// --- Table View Logic ---

function renderTableView() {
    const thead = document.querySelector('#data-table thead');
    const tbody = document.querySelector('#data-table tbody');

    thead.innerHTML = '';
    tbody.innerHTML = '';

    const participantNames = Object.keys(currentState.participants);

    // Render Header Row
    const trHead = document.createElement('tr');

    // First column: Time Label (no delete button for the column itself)
    const thTime = document.createElement('th');
    thTime.className = 'sticky-col';
    thTime.textContent = 'Time Label / Participants ➔';
    trHead.appendChild(thTime);

    // Participant Columns
    participantNames.forEach((name, index) => {
        const th = document.createElement('th');

        const container = document.createElement('div');
        container.className = 'header-container';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = name;
        input.dataset.oldName = name;
        input.dataset.colIndex = index;
        input.addEventListener('change', handleParticipantNameChange);

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '×';
        delBtn.title = 'Delete Participant';
        delBtn.dataset.name = name;
        delBtn.addEventListener('click', () => deleteParticipant(name));

        container.appendChild(input);
        container.appendChild(delBtn);
        th.appendChild(container);
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    // Render Data Rows
    currentState.timelineData.forEach((step, rowIndex) => {
        const tr = document.createElement('tr');

        // Time Label Column
        const tdTime = document.createElement('td');
        tdTime.className = 'sticky-col';
        const container = document.createElement('div');
        container.className = 'header-container';

        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.value = step.timeLabel || '';
        timeInput.dataset.rowIndex = rowIndex;
        timeInput.dataset.field = 'timeLabel';

        const delRowBtn = document.createElement('button');
        delRowBtn.className = 'delete-btn';
        delRowBtn.innerHTML = '×';
        delRowBtn.title = 'Delete Row';
        delRowBtn.addEventListener('click', () => deleteRow(rowIndex));

        container.appendChild(timeInput);
        container.appendChild(delRowBtn);
        tdTime.appendChild(container);
        tr.appendChild(tdTime);

        // Score Changes Columns
        participantNames.forEach((name) => {
            const td = document.createElement('td');
            const numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.value = (step.changes && step.changes[name] !== undefined) ? step.changes[name] : 0;
            numInput.dataset.rowIndex = rowIndex;
            numInput.dataset.name = name;
            td.appendChild(numInput);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function syncTableToState() {
    const tbody = document.querySelector('#data-table tbody');
    const thead = document.querySelector('#data-table thead');

    // Get headers (participant names and handle renaming)
    const headerInputs = Array.from(thead.querySelectorAll('input[type="text"]'));
    const newParticipantNames = headerInputs.map(input => {
        return {
            newName: input.value.trim() || 'Unnamed',
            oldName: input.dataset.oldName
        };
    });

    // Rebuild participants object to preserve metadata for existing ones, add random colors for new ones
    const newParticipants = {};
    newParticipantNames.forEach(({ newName, oldName }) => {
        if (currentState.participants[oldName]) {
            newParticipants[newName] = currentState.participants[oldName];
        } else if (currentState.participants[newName]) {
            newParticipants[newName] = currentState.participants[newName];
        } else {
            // New participant
            newParticipants[newName] = {
                imageUrl: "", // No avatar by default for newly added via table
                color: getRandomColor(),
                initialValue: 0
            };
        }
    });
    currentState.participants = newParticipants;

    // Update timeline data
    const rows = Array.from(tbody.querySelectorAll('tr'));
    currentState.timelineData = rows.map((row, rowIndex) => {
        const timeInput = row.querySelector('td.sticky-col input[type="text"]');
        const timeLabel = timeInput ? timeInput.value : `Step ${rowIndex}`;

        const changes = {};
        const numberInputs = Array.from(row.querySelectorAll('td:not(.sticky-col) input[type="number"]'));

        numberInputs.forEach((input, index) => {
            const { newName } = newParticipantNames[index];
            if (newName) {
                changes[newName] = parseFloat(input.value) || 0;
            }
        });

        return {
            timeLabel: timeLabel,
            changes: changes
        };
    });
}

function handleParticipantNameChange(e) {
    syncTableToState();
    renderTableView(); // Re-render to update oldName dataset and keep everything in sync
}

function deleteParticipant(name) {
    if (confirm(`Delete participant "${name}"?`)) {
        syncTableToState(); // Ensure current edits are saved before modifying structure
        delete currentState.participants[name];
        // Clean up from timeline
        currentState.timelineData.forEach(step => {
            if (step.changes) delete step.changes[name];
        });
        renderTableView();
    }
}

function deleteRow(rowIndex) {
    syncTableToState();
    currentState.timelineData.splice(rowIndex, 1);
    renderTableView();
}

function addRow() {
    syncTableToState();

    const newStep = {
        timeLabel: `New Step`,
        changes: {}
    };

    Object.keys(currentState.participants).forEach(name => {
        newStep.changes[name] = 0;
    });

    currentState.timelineData.push(newStep);
    renderTableView();
}

function addColumn() {
    syncTableToState();

    let baseName = "New Participant";
    let name = baseName;
    let counter = 1;
    while (currentState.participants[name]) {
        name = `${baseName} ${counter}`;
        counter++;
    }

    currentState.participants[name] = {
        imageUrl: "",
        color: getRandomColor(),
        initialValue: 0
    };

    currentState.timelineData.forEach(step => {
        if (!step.changes) step.changes = {};
        step.changes[name] = 0;
    });

    renderTableView();
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// --- JSON View Logic ---

function renderJsonView() {
    const editor = document.getElementById('json-editor');
    editor.value = JSON.stringify(currentState, null, 2);
    document.getElementById('json-error').textContent = '';
}

function syncJsonToState() {
    const editor = document.getElementById('json-editor');
    const errorDiv = document.getElementById('json-error');
    try {
        const parsed = JSON.parse(editor.value);
        if (!parsed.participants || !parsed.timelineData) {
            throw new Error("JSON must have 'participants' and 'timelineData' keys.");
        }
        currentState = parsed;
        errorDiv.textContent = '';
        return true;
    } catch (e) {
        errorDiv.textContent = 'Invalid JSON: ' + e.message;
        return false;
    }
}

// --- Event Listeners ---

function setupEventListeners() {
    document.getElementById('add-row-btn').addEventListener('click', addRow);
    document.getElementById('add-col-btn').addEventListener('click', addColumn);

    document.getElementById('save-btn').addEventListener('click', () => {
        const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');

        if (activeTab === 'table-view') {
            syncTableToState();
        } else if (activeTab === 'json-view') {
            if (!syncJsonToState()) {
                alert("Please fix JSON errors before saving.");
                return;
            }
        }

        const jsonString = JSON.stringify(currentState);
        const encoded = LZString.compressToEncodedURIComponent(jsonString);

        // Redirect to index.html with the new data
        window.location.href = `index.html?data=${encoded}`;
    });
}

// Boot up
document.addEventListener('DOMContentLoaded', init);