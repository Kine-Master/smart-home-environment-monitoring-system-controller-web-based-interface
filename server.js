// --- Node.js Backend (server.js) ---

// Load environment variables from .env file FIRST
require('dotenv').config(); // This line should be at the very top!

const express = require('express');
const { SerialPort, ReadlineParser } = require('serialport');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = 3000; // Port for your web server

// --- MySQL Database Setup ---
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost', // Default to localhost if not set in .env
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool; // Declare pool variable globally

async function connectToDatabase() {
    try {
        pool = await mysql.createPool(DB_CONFIG);
        console.log('Connected to MySQL database pool.');
        // You can optionally check/create tables here if you want to automate it
        // but it's generally better to do schema management separately in production.
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                temperature FLOAT,
                ldr_value INT
            )
        `);
        console.log('Sensor readings table checked/created in MySQL.');
    } catch (err) {
        console.error('Error connecting to MySQL database:', err.message);
        console.log('Retrying MySQL connection in 5 seconds...');
        setTimeout(connectToDatabase, 5000); // Try to reconnect
    }
}

connectToDatabase(); // Initiate database connection attempt

// --- Serial Port Setup ---
const ARDUINO_PORT = process.env.ARDUINO_PORT; // Loaded from .env
const BAUD_RATE = 9600;

let serialPort;
let parser;

function connectToArduino() {
    if (!ARDUINO_PORT) {
        console.error('Error: ARDUINO_PORT is not defined in your .env file!');
        console.log('Please set ARDUINO_PORT=COMX (or /dev/ttyACM0, etc.) in your .env file.');
        return; // Exit if port is not defined
    }

    serialPort = new SerialPort({ path: ARDUINO_PORT, baudRate: BAUD_RATE }, (err) => {
        if (err) {
            console.error('Error opening serial port:', err.message);
            console.log(`Retrying serial connection to ${ARDUINO_PORT} in 5 seconds...`);
            setTimeout(connectToArduino, 5000); // Try to reconnect after 5 seconds
            return;
        }
        console.log(`Serial port ${ARDUINO_PORT} opened successfully.`);

        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
        parser.on('data', handleSerialData);

        serialPort.on('close', () => {
            console.log('Serial port closed. Attempting to reconnect...');
            setTimeout(connectToArduino, 5000);
        });
        serialPort.on('error', (err) => {
            console.error('Serial port error:', err.message);
        });
    });
}

connectToArduino(); // Initiate connection attempt

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', ws => {
    console.log('WebSocket client connected');
    ws.on('close', () => console.log('WebSocket client disconnected'));
    ws.on('error', error => console.error('WebSocket error:', error));
});

function broadcastSensorData(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// --- Serial Data Handler ---
async function handleSerialData(data) {
    const rawString = data.toString().trim();
    console.log('Arduino:', rawString);

    if (rawString.startsWith('{') && rawString.endsWith('}')) {
        try {
            const sensorData = JSON.parse(rawString);
            broadcastSensorData(sensorData);

            if (pool) {
                try {
                    await pool.execute(
                        `INSERT INTO sensor_readings (temperature, ldr_value) VALUES (?, ?)`,
                        [sensorData.temp, sensorData.ldr]
                    );
                } catch (dbErr) {
                    console.error('Error inserting data into MySQL DB:', dbErr.message);
                }
            } else {
                console.warn('MySQL pool not connected, skipping data insertion.');
            }

        } catch (e) {
            console.error('Error parsing JSON from Arduino:', e, rawString);
        }
    } else if (rawString.startsWith('RELAY_STATUS:')) {
        const status = rawString.split(':')[1];
        broadcastSensorData({ type: 'relay_status', status: status });
    } else if (rawString.startsWith('RGB_STATUS:')) {
        const [r, g, b] = rawString.split(':')[1].split(',').map(Number);
        broadcastSensorData({ type: 'rgb_status', r, g, b });
    }
}


// --- API Endpoints for Control ---
app.use(express.json());

app.post('/api/relay', (req, res) => {
    const { state } = req.body;
    if (serialPort && serialPort.isOpen) {
        if (state === 'on') {
            serialPort.write('RELAY_ON\n');
            res.json({ message: 'Relay ON command sent' });
        } else if (state === 'off') {
            serialPort.write('RELAY_OFF\n');
            res.json({ message: 'Relay OFF command sent' });
        } else {
            res.status(400).json({ error: 'Invalid relay state. Use "on" or "off".' });
        }
    } else {
        res.status(500).json({ error: 'Arduino not connected or serial port not open.' });
    }
});

app.post('/api/rgb', (req, res) => {
    const { r, g, b } = req.body;
    if (serialPort && serialPort.isOpen) {
        if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number' &&
            r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
            const command = `RGB_${r},${g},${b}\n`;
            serialPort.write(command);
            res.json({ message: `RGB command sent: ${r},${g},${b}` });
        } else {
            res.status(400).json({ error: 'Invalid RGB values. Must be 0-255.' });
        }
    } else {
        res.status(500).json({ error: 'Arduino not connected or serial port not open.' });
    }
});

app.get('/api/history', async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    if (pool) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT ?`,
                [limit]
            );
            res.json(rows);
        } catch (err) {
            console.error('Error fetching history data from MySQL:', err.message);
            res.status(500).json({ error: err.message });
        }
    } else {
        res.status(500).json({ error: 'MySQL database not connected.' });
    }
});

// NEW: Endpoint to clear history
app.post('/api/history/clear', async (req, res) => {
    if (pool) {
        try {
            await pool.execute(`TRUNCATE TABLE sensor_readings`); // TRUNCATE is faster than DELETE FROM
            console.log('Sensor readings history cleared.');
            res.json({ message: 'History cleared successfully.' });
        } catch (err) {
            console.error('Error clearing history from MySQL:', err.message);
            res.status(500).json({ error: err.message });
        }
    } else {
        res.status(500).json({ error: 'MySQL database not connected.' });
    }
});


// --- Serve Frontend Files ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));


// --- Start Server ---
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// --- Handle WebSocket Upgrade ---
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
        wss.handleUpgrade(request, socket, head, ws => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// --- Graceful Shutdown ---
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    if (serialPort && serialPort.isOpen) {
        serialPort.close(() => console.log('Serial port closed.'));
    }
    if (pool) {
        try {
            await pool.end();
            console.log('MySQL connection pool closed.');
        } catch (err) {
            console.error('Error closing MySQL pool:', err.message);
        }
    }
    server.close(() => {
        console.log('Node.js server closed.');
        process.exit(0);
    });
});