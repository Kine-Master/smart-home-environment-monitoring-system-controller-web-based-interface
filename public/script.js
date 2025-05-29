// --- Frontend JavaScript (script.js) ---

const tempSpan = document.getElementById('temp');
const ldrSpan = document.getElementById('ldr');

const relayOnBtn = document.getElementById('relayOn');
const relayOffBtn = document.getElementById('relayOff');
const relayStatusSpan = document.getElementById('relayStatus');

const rgbColorPicker = document.getElementById('rgbColorPicker');
const setRgbBtn = document.getElementById('setRgb');
const rgbStatusSpan = document.getElementById('rgbStatus');

const historyTableBody = document.querySelector('#historyTable tbody');
const loadMoreHistoryBtn = document.getElementById('loadMoreHistory');
const clearHistoryBtn = document.getElementById('clearHistory'); // New clear history button

const nightModeToggle = document.getElementById('nightModeToggle');
const body = document.body;

let historyLimit = 10; // Initial number of history items to load

// --- Theme Management ---
function applyTheme(isLightMode) { // Renamed parameter for clarity
    if (isLightMode) {
        body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-mode');
        localStorage.setItem('theme', 'night');
    }
}

// Load saved theme preference on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    // If savedTheme is 'light', or if no theme is saved (default to night mode)
    if (savedTheme === 'light') {
        nightModeToggle.checked = true; // Check the toggle if light mode was saved
        applyTheme(true); // Apply light mode
    } else {
        nightModeToggle.checked = false; // Uncheck the toggle if night mode was saved or no preference
        applyTheme(false); // Apply night mode (default)
    }
    // Fetch initial history data after theme is applied
    fetchHistoryData(historyLimit);
});

// Event listener for the night mode toggle
nightModeToggle.addEventListener('change', () => {
    applyTheme(nightModeToggle.checked); // Apply theme based on toggle state
});


// --- WebSocket Connection ---
const ws = new WebSocket('ws://localhost:3000/ws'); // Connect to your Node.js WebSocket server

ws.onopen = () => {
    console.log('Connected to WebSocket server');
};

ws.onmessage = event => {
    const data = JSON.parse(event.data);
    console.log('Received WebSocket data:', data);

    if (data.type === 'relay_status') {
        relayStatusSpan.textContent = data.status;
        relayStatusSpan.dataset.status = data.status;
    } else if (data.type === 'rgb_status') {
        const hexColor = rgbToHex(data.r, data.g, data.b);
        rgbStatusSpan.style.backgroundColor = hexColor;
        rgbColorPicker.value = hexColor; // Update color picker
    } else { // Assume it's sensor data
        tempSpan.textContent = data.temp !== undefined ? data.temp.toFixed(1) : '--';
        ldrSpan.textContent = data.ldr !== undefined ? ldrValueToPercentage(data.ldr) : '--'; // Convert LDR to percentage
    }
};

ws.onerror = error => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from WebSocket server');
};

// --- Control Functions ---
async function sendRelayCommand(state) {
    try {
        const response = await fetch('/api/relay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state })
        });
        const result = await response.json();
        console.log(result.message);
        if (response.ok) {
            relayStatusSpan.textContent = state.toUpperCase();
            relayStatusSpan.dataset.status = state.toUpperCase();
        }
    } catch (error) {
        console.error('Error sending relay command:', error);
    }
}

async function sendRgbCommand(r, g, b) {
    try {
        const response = await fetch('/api/rgb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ r, g, b })
        });
        const result = await response.json();
        console.log(result.message);
        if (response.ok) {
            rgbStatusSpan.style.backgroundColor = rgbToHex(r, g, b);
        }
    } catch (error) {
        console.error('Error sending RGB command:', error);
    }
}

async function clearHistory() {
    if (confirm('Are you sure you want to clear all sensor history? This action cannot be undone.')) {
        try {
            const response = await fetch('/api/history/clear', {
                method: 'POST', // Use POST for actions that modify data
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            console.log(result.message);
            if (response.ok) {
                historyTableBody.innerHTML = ''; // Clear table on success
                alert('History cleared successfully!'); // Use alert for confirmation
            } else {
                alert('Failed to clear history: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('An error occurred while trying to clear history.');
        }
    }
}

// --- Utility Functions ---
function hexToRgb(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return { r, g, b };
}

function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// Convert LDR 0-1023 to percentage
function ldrValueToPercentage(ldrValue) {
    // Assuming 0 is darkest (0% light) and 1023 is brightest (100% light)
    // You might need to invert this depending on your LDR wiring (pull-up vs pull-down)
    const percentage = map(ldrValue, 0, 1023, 0, 100);
    return `${percentage.toFixed(0)}%`;
}

// Arduino map function equivalent for JavaScript
function map(value, in_min, in_max, out_min, out_max) {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}


// --- Event Listeners ---
relayOnBtn.addEventListener('click', () => sendRelayCommand('on'));
relayOffBtn.addEventListener('click', () => sendRelayCommand('off'));

setRgbBtn.addEventListener('click', () => {
    const hex = rgbColorPicker.value;
    const { r, g, b } = hexToRgb(hex);
    sendRgbCommand(r, g, b);
});

loadMoreHistoryBtn.addEventListener('click', () => {
    historyLimit += 10; // Increase limit
    fetchHistoryData(historyLimit);
});

clearHistoryBtn.addEventListener('click', clearHistory); // New event listener for clear history


// --- History Data Fetching ---
async function fetchHistoryData(limit) {
    try {
        const response = await fetch(`/api/history?limit=${limit}`);
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            console.log('History data:', data);

            historyTableBody.innerHTML = ''; // Clear existing rows
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(row.timestamp).toLocaleTimeString()}</td>
                    <td>${row.temperature !== null ? row.temperature.toFixed(1) : '--'}</td>
                    <td>${row.ldr_value !== null ? ldrValueToPercentage(row.ldr_value) : '--'}</td>
                `;
                historyTableBody.appendChild(tr);
            });
        } else {
            const text = await response.text();
            console.error("Received non-JSON response from /api/history:", text);
            // Optionally display a user-friendly error message
        }
    } catch (error) {
        console.error('Error fetching history data:', error);
    }
}

// Fetch initial history data when the page loads
// This is now called after theme application in DOMContentLoaded
//document.addEventListener('DOMContentLoaded', () => {
 //    fetchHistoryData(historyLimit);
 //});