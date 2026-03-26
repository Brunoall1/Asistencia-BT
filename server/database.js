const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database file (creates it if it doesn't exist)
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Create system_config table for master password
        db.run(`
            CREATE TABLE IF NOT EXISTS system_config (
                key_name TEXT PRIMARY KEY,
                key_value TEXT NOT NULL
            )
        `);

        // Check if master password exists, if not set default '1234'
        db.get(`SELECT key_value FROM system_config WHERE key_name = 'master_password'`, (err, row) => {
            if (!err && !row) {
                db.run(`INSERT INTO system_config (key_name, key_value) VALUES ('master_password', '1234')`);
            }
        });

        // Create events table
        db.run(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                expected_forum INTEGER,
                rooms_count INTEGER,
                access_code TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create rooms table
        db.run(`
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                name TEXT NOT NULL,
                conference_name TEXT NOT NULL,
                expected_capacity INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
            )
        `);

        // Create attendees table
        db.run(`
            CREATE TABLE IF NOT EXISTS attendees (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                room_id TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT,
                payment_method TEXT,
                has_arrived BOOLEAN DEFAULT 0,
                arrival_time TEXT,
                qr_code TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )
        `);

        // Create sessions table
        db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                room_id TEXT NOT NULL,
                name TEXT NOT NULL,
                speaker TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
            )
        `);
    });
}

// Wrapper functions to use Promises for cleaner async/await syntax in routes
const dbHelper = {
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this); // Returning 'this' provides access to lastID and changes
            });
        });
    }
};

module.exports = dbHelper;
