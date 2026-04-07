const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('./database');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ==========================================
// UTILITIES
// ==========================================
// Scrape external QR URLs to extract attendee info
app.post('/api/utils/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            return res.status(400).json({ success: false, message: 'Invalid URL' });
        }
        
        // Use native fetch to get the HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const text = await response.text();
        res.json({ success: true, html: text });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// SYSTEM CONFIG / AUTH ROUTES
// ==========================================

// Verify master password (for creating an event)
app.post('/api/auth/verify-master', async (req, res) => {
    const { password } = req.body;
    try {
        const row = await db.get(`SELECT key_value FROM system_config WHERE key_name = 'master_password'`);
        if (row && row.key_value === password) {
            res.json({ success: true, message: 'Password valid' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid master password' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify master password mid-request helper
const verifyMasterPW = async (password) => {
    const row = await db.get(`SELECT key_value FROM system_config WHERE key_name = 'master_password'`);
    return row && row.key_value === password;
};

// Update master password
app.put('/api/auth/update-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        if (!await verifyMasterPW(currentPassword)) {
            return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta' });
        }
        await db.run(`UPDATE system_config SET key_value = ? WHERE key_name = 'master_password'`, [newPassword]);
        res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Access event via access code
app.post('/api/auth/access-event', async (req, res) => {
    const { accessCode } = req.body;
    try {
        const event = await db.get(`SELECT * FROM events WHERE access_code = ?`, [accessCode]);
        if (event) {
            res.json({ success: true, event });
        } else {
            res.status(401).json({ success: false, message: 'Invalid access code' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// EVENTS ROUTES
// ==========================================

// Generate a random 6-character access code
const generateAccessCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Create an event
app.post('/api/events', async (req, res) => {
    const { name, expected_forum, rooms_count } = req.body;
    const id = uuidv4();
    const accessCode = generateAccessCode();

    try {
        await db.run(`INSERT INTO events (id, name, expected_forum, rooms_count, access_code) VALUES (?, ?, ?, ?, ?)`,
            [id, name, expected_forum, rooms_count, accessCode]
        );
        res.json({ success: true, event: { id, name, expected_forum, rooms_count, access_code: accessCode } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get event details by ID
app.get('/api/events/:eventId', async (req, res) => {
    try {
        const event = await db.get(`SELECT * FROM events WHERE id = ?`, [req.params.eventId]);
        if (event) {
            res.json({ success: true, event });
        } else {
            res.status(404).json({ success: false, message: 'Event not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ROOMS ROUTES
// ==========================================

// Get rooms for an event
app.get('/api/events/:eventId/rooms', async (req, res) => {
    try {
        const rooms = await db.all(`SELECT * FROM rooms WHERE event_id = ?`, [req.params.eventId]);
        res.json({ success: true, rooms });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a room
app.post('/api/events/:eventId/rooms', async (req, res) => {
    const { name, conference_name, expected_capacity } = req.body;
    const event_id = req.params.eventId;
    const id = uuidv4();

    try {
        await db.run(`INSERT INTO rooms (id, event_id, name, conference_name, expected_capacity) VALUES (?, ?, ?, ?, ?)`,
            [id, event_id, name, conference_name, expected_capacity || 0]
        );
        res.json({ success: true, room: { id, event_id, name, conference_name, expected_capacity } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ATTENDEES ROUTES
// ==========================================

// --- ATTENDEES ROUTES --- //

// Get attendees for an event
app.get('/api/events/:eventId/attendees', async (req, res) => {
    try {
        const attendees = await db.all(`SELECT * FROM attendees WHERE event_id = ?`, [req.params.eventId]);
        res.json({ success: true, attendees });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create an attendee
app.post('/api/events/:eventId/attendees', async (req, res) => {
    const { room_id, first_name, last_name, email, payment_method } = req.body;
    const event_id = req.params.eventId;
    const id = uuidv4();
    const qr_code = crypto.createHash('md5').update(id + event_id + Date.now().toString()).digest('hex');

    try {
        await db.run(
            `INSERT INTO attendees (id, event_id, room_id, first_name, last_name, email, payment_method, qr_code) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, event_id, room_id, first_name, last_name, email, payment_method, qr_code]
        );
        res.json({ success: true, attendee: { id, event_id, room_id, first_name, last_name, email, payment_method, qr_code } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an attendee (Edit info)
app.put('/api/events/:eventId/attendees/:attendeeId', async (req, res) => {
    const { room_id, first_name, last_name, email, payment_method } = req.body;
    const { eventId, attendeeId } = req.params;

    try {
        await db.run(
            `UPDATE attendees SET room_id = ?, first_name = ?, last_name = ?, email = ?, payment_method = ? 
             WHERE id = ? AND event_id = ?`,
            [room_id, first_name, last_name, email, payment_method, attendeeId, eventId]
        );
        res.json({ success: true, message: 'Attendee updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark attendee as arrived / QR scan
app.put('/api/events/:eventId/attendees/scan', async (req, res) => {
    const { qr_code } = req.body;
    const event_id = req.params.eventId;

    try {
        const attendee = await db.get(`SELECT * FROM attendees WHERE qr_code = ? AND event_id = ?`, [qr_code, event_id]);
        if (!attendee) {
            return res.status(404).json({ success: false, message: 'Attendee not found for this event' });
        }

        const arrival_time = new Date().toLocaleTimeString('es-ES', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });

        await db.run(`UPDATE attendees SET has_arrived = TRUE, arrival_time = ? WHERE id = ?`, [arrival_time, attendee.id]);

        // Fetch the room info for display
        const room = await db.get(`SELECT name, conference_name FROM rooms WHERE id = ?`, [attendee.room_id]);

        res.json({ success: true, attendee: { ...attendee, has_arrived: true, arrival_time }, room });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark attendee as arrived manually by ID
app.put('/api/events/:eventId/attendees/:attendeeId/arrival', async (req, res) => {
    const attendeeId = req.params.attendeeId;
    const event_id = req.params.eventId;

    try {
        const attendee = await db.get(`SELECT * FROM attendees WHERE id = ? AND event_id = ?`, [attendeeId, event_id]);
        if (!attendee) {
            return res.status(404).json({ success: false, message: 'Attendee not found' });
        }

        const arrival_time = new Date().toLocaleTimeString('es-ES', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });

        await db.run(`UPDATE attendees SET has_arrived = TRUE, arrival_time = ? WHERE id = ?`, [arrival_time, attendeeId]);

        res.json({ success: true, attendee: { ...attendee, has_arrived: true, arrival_time } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PUBLIC QR CHECK-IN ROUTES
// ==========================================

// Get attendee info via QR Code (MD5)
app.get('/api/public/attendee/:qrCode', async (req, res) => {
    try {
        const attendee = await db.get(`
            SELECT a.*, r.name as room_name, e.name as event_name 
            FROM attendees a
            JOIN rooms r ON a.room_id = r.id
            JOIN events e ON a.event_id = e.id
            WHERE a.qr_code = ?
        `, [req.params.qrCode]);

        if (!attendee) {
            return res.status(404).json({ success: false, message: 'QR Code inválido o asistente no encontrado' });
        }

        res.json({ success: true, attendee });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark attendee as arrived publicly via QR Code (MD5)
app.put('/api/public/attendee/:qrCode/arrival', async (req, res) => {
    try {
        const attendee = await db.get(`SELECT * FROM attendees WHERE qr_code = ?`, [req.params.qrCode]);
        if (!attendee) {
            return res.status(404).json({ success: false, message: 'Asistente no encontrado' });
        }

        const arrival_time = new Date().toLocaleTimeString('es-ES', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });

        await db.run(`UPDATE attendees SET has_arrived = TRUE, arrival_time = ? WHERE id = ?`, [arrival_time, attendee.id]);

        res.json({ success: true, attendee: { ...attendee, has_arrived: true, arrival_time } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SESSIONS ROUTES
// ==========================================

// Get all sessions for an event
app.get('/api/events/:eventId/sessions', async (req, res) => {
    try {
        const sessions = await db.all(`SELECT * FROM sessions WHERE event_id = ?`, [req.params.eventId]);
        res.json({ success: true, sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a session in a room
app.post('/api/events/:eventId/rooms/:roomId/sessions', async (req, res) => {
    const { name, speaker, start_time, end_time } = req.body;
    const { eventId, roomId } = req.params;
    const id = uuidv4();

    try {
        await db.run(
            `INSERT INTO sessions (id, event_id, room_id, name, speaker, start_time, end_time) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, eventId, roomId, name, speaker, start_time, end_time]
        );
        res.json({ success: true, session: { id, event_id: eventId, room_id: roomId, name, speaker, start_time, end_time } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================

// Get all events with aggregated stats for admin list
app.post('/api/admin/events', async (req, res) => {
    const { password } = req.body;
    try {
        if (!await verifyMasterPW(password)) return res.status(401).json({ success: false, message: 'No autorizado' });
        
        const events = await db.all(`
            SELECT 
                e.id, 
                e.name, 
                e.access_code, 
                (SELECT COUNT(*) FROM rooms WHERE event_id = e.id) as real_rooms_count,
                (SELECT COUNT(*) FROM attendees WHERE event_id = e.id AND has_arrived = TRUE) as arrived_attendees
            FROM events e
            ORDER BY e.created_at DESC
        `);
        res.json({ success: true, events });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific event room stats for admin details
app.post('/api/admin/events/:eventId', async (req, res) => {
    const { password } = req.body;
    const { eventId } = req.params;
    try {
        if (!await verifyMasterPW(password)) return res.status(401).json({ success: false, message: 'No autorizado' });
        
        const event = await db.get(`SELECT id, name, access_code FROM events WHERE id = ?`, [eventId]);
        if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

        const rooms = await db.all(`
            SELECT 
                r.id, 
                r.name, 
                r.conference_name, 
                r.expected_capacity,
                (SELECT COUNT(*) FROM attendees WHERE room_id = r.id AND has_arrived = TRUE) as arrived_attendees
            FROM rooms r
            WHERE r.event_id = ?
        `, [eventId]);

        res.json({ success: true, event, rooms });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve static files from the React frontend build
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one of the API routes, send back React's index.html file.
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});