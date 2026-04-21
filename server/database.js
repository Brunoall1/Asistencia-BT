require('dotenv').config();
const path = require('path');

const isPostgres = !!process.env.DATABASE_URL;

let dbHelper = {};

if (isPostgres) {
    console.log('Detected DATABASE_URL. Using PostgreSQL adapter.');
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Needed for platforms like Render
    });

    pool.on('connect', () => {
        console.log('Connected to PostgreSQL database.');
    });

    const convertQuery = (sql) => {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++}`);
    };

    dbHelper = {
        get: async (sql, params = []) => {
            const res = await pool.query(convertQuery(sql), params);
            return res.rows[0];
        },
        all: async (sql, params = []) => {
            const res = await pool.query(convertQuery(sql), params);
            return res.rows;
        },
        run: async (sql, params = []) => {
            const res = await pool.query(convertQuery(sql), params);
            return res; 
        }
    };

    const initPgDb = async () => {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS system_config (
                    key_name TEXT PRIMARY KEY,
                    key_value TEXT NOT NULL
                )
            `);
            const configRow = await dbHelper.get(`SELECT key_value FROM system_config WHERE key_name = 'master_password'`);
            if (!configRow) {
                await pool.query(`INSERT INTO system_config (key_name, key_value) VALUES ('master_password', '1234')`);
            }
            await pool.query(`
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    expected_forum INTEGER,
                    rooms_count INTEGER,
                    access_code TEXT UNIQUE NOT NULL,
                    dates TEXT,
                    logo TEXT,
                    custom_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS rooms (
                    id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    conference_name TEXT NOT NULL,
                    expected_capacity INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                )
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS attendees (
                    id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL,
                    room_id TEXT NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT,
                    phone TEXT,
                    company TEXT DEFAULT 'No Aplica',
                    payment_method TEXT,
                    has_arrived BOOLEAN DEFAULT FALSE,
                    arrival_time TEXT,
                    qr_code TEXT NOT NULL UNIQUE,
                    status TEXT DEFAULT 'accepted',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
                )
            `);
            // Try to add column to existing table in case it was already created before
            try {
                await pool.query(`ALTER TABLE attendees ADD COLUMN status TEXT DEFAULT 'accepted'`);
                console.log('Added default status column to existing attendees table (PostgreSQL).');
            } catch (err) {}
            try {
                await pool.query(`ALTER TABLE attendees ADD COLUMN phone TEXT`);
            } catch (err) {}
            try {
                await pool.query(`ALTER TABLE attendees ADD COLUMN company TEXT DEFAULT 'No Aplica'`);
            } catch (err) {}
            try {
                await pool.query(`ALTER TABLE events ADD COLUMN dates TEXT`);
                await pool.query(`ALTER TABLE events ADD COLUMN logo TEXT`);
                await pool.query(`ALTER TABLE events ADD COLUMN custom_message TEXT`);
                console.log('Added dates, logo, custom_message to events table (PostgreSQL).');
            } catch (err) {}
            try {
                await pool.query(`ALTER TABLE attendees ADD COLUMN phone TEXT`);
                console.log('Added phone column to existing attendees table (PostgreSQL).');
            } catch (err) {
                // Ignore error if column already exists
            }
            try {
                await pool.query(`ALTER TABLE attendees ADD COLUMN company TEXT DEFAULT 'No Aplica'`);
                console.log('Added company column to existing attendees table (PostgreSQL).');
            } catch (err) {
                // Ignore error if column already exists
            }
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL,
                    room_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    speaker TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                )
            `);
            console.log('PostgreSQL database initialized.');
        } catch (err) {
            console.error('Error initializing PostgreSQL:', err);
        }
    };
    initPgDb();

} else {
    console.log('No DATABASE_URL found. Using local SQLite adapter.');
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to the database:', err.message);
        } else {
            console.log('Connected to the local SQLite database.');
            initDb();
        }
    });

    function initDb() {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS system_config (
                    key_name TEXT PRIMARY KEY,
                    key_value TEXT NOT NULL
                )
            `);
            db.get(`SELECT key_value FROM system_config WHERE key_name = 'master_password'`, (err, row) => {
                if (!err && !row) {
                    db.run(`INSERT INTO system_config (key_name, key_value) VALUES ('master_password', '1234')`);
                }
            });
            db.run(`
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    expected_forum INTEGER,
                    rooms_count INTEGER,
                    access_code TEXT UNIQUE NOT NULL,
                    dates TEXT,
                    logo TEXT,
                    custom_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
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
            db.run(`
                CREATE TABLE IF NOT EXISTS attendees (
                    id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL,
                    room_id TEXT NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT,
                    phone TEXT,
                    company TEXT DEFAULT 'No Aplica',
                    payment_method TEXT,
                    has_arrived BOOLEAN DEFAULT 0,
                    arrival_time TEXT,
                    qr_code TEXT NOT NULL UNIQUE,
                    status TEXT DEFAULT 'accepted',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
                )
            `);

            // Try to add column to existing table in case it was already created before
            db.run(`ALTER TABLE attendees ADD COLUMN status TEXT DEFAULT 'accepted'`, (err) => {
                if (!err) console.log('Added default status column to existing attendees table (SQLite).');
            });
            db.run(`ALTER TABLE events ADD COLUMN dates TEXT`, () => {});
            db.run(`ALTER TABLE events ADD COLUMN logo TEXT`, () => {});
            db.run(`ALTER TABLE events ADD COLUMN custom_message TEXT`, () => {});
            db.run(`ALTER TABLE attendees ADD COLUMN phone TEXT`, (err) => {
                if (!err) console.log('Added phone column to existing attendees table (SQLite).');
            });
            db.run(`ALTER TABLE attendees ADD COLUMN company TEXT DEFAULT 'No Aplica'`, (err) => {
                if (!err) console.log('Added company column to existing attendees table (SQLite).');
            });
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

    dbHelper = {
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
                    else resolve(this);
                });
            });
        }
    };
}

module.exports = dbHelper;
