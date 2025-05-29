# Smart Home Monitor & Controller

A real-time web-based dashboard for monitoring environmental conditions (temperature, light) and controlling smart home devices (relay, RGB LED) via an Arduino. Data is stored in a MySQL database and displayed in a sleek, responsive interface with a night mode.

## ✨ Features

* **Real-time Sensor Monitoring:** Displays live temperature (LM35) and light (LDR) readings from Arduino.
* **Appliance Control (Relay):** Turn an appliance ON or OFF with a button click.
* **Mood Light Control (RGB LED):** Select any color using a color picker to set the RGB LED.
* **Sensor History:** View a historical log of sensor readings, with a "Load More" option.
* **Clear History:** Button to clear all stored sensor data from the database.
* **Night Mode Toggle:** Switch between a dark (default) and light theme for comfortable viewing.
* **Persistent Theme:** Your preferred theme (night/light) is saved and loaded automatically.
* **Robust Backend:** Node.js server handles communication with Arduino (Serial), stores data in MySQL, and serves the web interface (WebSockets for real-time updates, REST APIs for controls).

## 🖥️ Technologies Used

* **Frontend:** HTML, CSS, JavaScript (Vanilla JS, WebSockets)
* **Backend:** Node.js (Express.js, `serialport`, `ws`, `mysql2/promise`, `dotenv`)
* **Database:** MySQL
* **Hardware:** Arduino (e.g., Uno), LM35 Temperature Sensor, Photoresistor (LDR), Relay Module, RGB LED, I2C LCD (16x2)

## ⚙️ Hardware Setup

Ensure your Arduino is wired according to the pin definitions in the provided Arduino sketch (`arduino_code.ino`).

* **LM35 Temperature Sensor:** Analog Pin `A2`
* **Photoresistor (LDR):** Analog Pin `A0`
* **Relay Module:** Digital Pin `7`
* **RGB LED:**
    * Red: Digital Pin `9` (PWM)
    * Green: Digital Pin `10` (PWM)
    * Blue: Digital Pin `11` (PWM)
* **LCD I2C (16x2):** Connected via I2C (SDA to A4, SCL to A5 on Uno).
    * **I2C Address:** `0x27` (Confirmed in Arduino sketch)

## 🚀 Getting Started

Follow these steps to get the project up and running on your system.

### Prerequisites

* **Node.js & npm:** [Download and Install Node.js](https://nodejs.org/en/download/) (npm is included).
* **MySQL Server:** [Install MySQL](https://dev.mysql.com/downloads/mysql/) on your system.
* **Arduino IDE:** [Download and Install Arduino IDE](https://www.arduino.cc/en/software).
* **Arduino Libraries:**
    * `ArduinoJson` by Benoit Blanchon (Version 6 or later recommended)
    * `LiquidCrystal I2C` by Frank de Brabander (or similar I2C LCD library)

### 1. Database Setup (MySQL)

1.  **Start your MySQL server.**
2.  Open a MySQL client (e.g., MySQL Workbench, command line, phpMyAdmin).
3.  Execute the following SQL commands to create the database and table:

    ```sql
    -- Create the database if it doesn't exist
    CREATE DATABASE IF NOT EXISTS smart_home_db;

    -- Use the newly created database
    USE smart_home_db;

    -- Create the sensor_readings table
    CREATE TABLE IF NOT EXISTS sensor_readings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        temperature FLOAT,
        ldr_value INT
    );

    -- Optional: Create a dedicated user for your application (recommended)
    CREATE USER 'smart_home_user'@'localhost' IDENTIFIED BY 'your_secure_password';
    GRANT ALL PRIVILEGES ON smart_home_db.* TO 'smart_home_user'@'localhost';
    FLUSH PRIVILEGES;
    ```
    **Remember to replace `'your_secure_password'` with a strong password.**

### 2. Project Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/smart-home-monitor.git](https://github.com/your-username/smart-home-monitor.git) # Replace with your actual repo URL
    cd smart-home-monitor
    ```
    *(If you've been building this locally without Git, just navigate to your project directory.)*

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Create `.env` file:**
    In the root of your `smart-home-monitor` folder, create a file named `.env` and add your configuration details:

    ```dotenv
    # .env file for Smart Home Controller
    # --- MySQL Database Configuration ---
    DB_HOST=localhost
    DB_USER=smart_home_user # Or your MySQL root/other user
    DB_PASSWORD=your_secure_password # The password you set for the user
    DB_DATABASE=smart_home_db

    # --- Arduino Serial Port Configuration ---
    ARDUINO_PORT=COM3 # Replace with your Arduino's serial port (e.g., COM3 on Windows, /dev/ttyUSB0 or /dev/ttyACM0 on Linux/Mac)
    ```
    **Make sure these values match your MySQL setup and Arduino's connected port.**

### 3. Arduino Sketch Upload

1.  Open the Arduino IDE.
2.  Copy the entire Arduino code provided in the project files (e.g., `arduino_code.ino`) and paste it into a new Arduino sketch.
3.  Go to `Sketch > Include Library > Manage Libraries...` and search for and install:
    * `ArduinoJson` by Benoit Blanchon
    * `LiquidCrystal I2C` by Frank de Brabander
4.  Connect your Arduino board to your computer via USB.
5.  Go to `Tools > Board` and select your Arduino board (e.g., "Arduino Uno").
6.  Go to `Tools > Port` and select the serial port corresponding to your Arduino.
7.  Click the "Upload" button (right arrow icon) to compile and upload the sketch to your Arduino.
    * **Important:** Ensure the Arduino IDE's Serial Monitor is closed before running the Node.js server, as only one program can typically access the serial port at a time.

## ▶️ Running the Application

1.  **Start your Node.js server:**
    Open your terminal or command prompt, navigate to your `smart-home-monitor` project folder, and run:
    ```bash
    node server.js
    ```
    You should see console messages indicating successful connections to MySQL and the serial port, and that the server is running.

2.  **Access the Web Interface:**
    Open your web browser and navigate to:
    ```
    http://localhost:3000
    ```
    **Always use this URL to access the application to avoid cross-origin (CORS) issues.**

## 📊 Operating the Web Interface

Once the web interface loads, you'll see the dashboard with various sections:

### 🌡️ Current Readings

* **Temperature:** Displays the current temperature detected by the LM35 sensor in Celsius.
* **Light:** Shows the current light intensity reading from the LDR sensor (0-1023, converted to a percentage).

These readings update in real-time via WebSocket communication from the Arduino.

### 💡 Controls

#### Appliance (Relay)
* **ON Button:** Clicks to send a command to the Arduino to turn the relay (and connected appliance) **ON**.
* **OFF Button:** Clicks to send a command to the Arduino to turn the relay **OFF**.
* **Status:** An indicator that shows the current state of the relay (ON/OFF).

#### Mood Light (RGB LED)
* **Color Picker:** Click on the black square to open a color picker. Select any color you desire.
* **Set Color Button:** After choosing a color, click this button to send the RGB values to the Arduino, changing the color of the RGB LED.
* **Current Color Indicator:** A small square that reflects the currently set color of the RGB LED.

### 📜 Recent History

* **History Table:** Displays a log of past temperature and light readings, including their timestamps.
* **Load More Button:** Click this to fetch and display more historical sensor data from the MySQL database.
* **Clear All History Button:**
    * Clicking this button will prompt a confirmation dialog.
    * If confirmed, it will **truncate** the `sensor_readings` table in your MySQL database, effectively deleting all past sensor data. This action is irreversible.

### 🌓 Night Mode Toggle

* Located in the top right of the header, next to the "Smart Home Dashboard" title.
* Click the **toggle switch** (moon/sun icon) to switch between:
    * **Night Mode (Default):** A dark theme with vibrant accents.
    * **Light Mode:** A brighter, cleaner theme.
* Your chosen theme preference will be **saved locally in your browser** and will be automatically applied the next time you visit the dashboard.

## ⚠️ Troubleshooting

* **"WebSocket connection failed" / Controls not working:**
    * Ensure your `node server.js` is running in the terminal.
    * Make sure you are accessing the page via `http://localhost:3000` (not `file:///` or `127.0.0.1:5500`).
    * Check your `ARDUINO_PORT` in the `.env` file matches the port shown in Arduino IDE's `Tools > Port`.
    * Ensure Arduino IDE's Serial Monitor is closed.
    * Try a hard refresh (`Ctrl + Shift + R` or `Cmd + Shift + R`) in your browser.

* **"Error connecting to MySQL" / History not loading:**
    * Verify your MySQL server is running.
    * Double-check your `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_DATABASE` in the `.env` file.
    * Ensure the `smart_home_db` database and `sensor_readings` table exist and the user has permissions.

* **Arduino "Error opening serial port":**
    * The specified `ARDUINO_PORT` might be incorrect or in use by another application.
    * Unplug and re-plug your Arduino, then re-check the port in Arduino IDE.

---