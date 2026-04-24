const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('./database');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    const { name, expected_forum, rooms_count, dates, logo, custom_message } = req.body;
    const id = uuidv4();
    const accessCode = generateAccessCode();

    try {
        await db.run(`INSERT INTO events (id, name, expected_forum, rooms_count, access_code, dates, logo, custom_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, expected_forum, rooms_count, accessCode, dates || null, logo || null, custom_message || null]
        );
        res.json({ success: true, event: { id, name, expected_forum, rooms_count, access_code: accessCode, dates, logo, custom_message } });
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

// Update event logo
app.put('/api/events/:eventId/logo', async (req, res) => {
    const { logo } = req.body;
    try {
        await db.run(`UPDATE events SET logo = ? WHERE id = ?`, [logo || null, req.params.eventId]);
        res.json({ success: true, message: 'Logo actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update event custom message
app.put('/api/events/:eventId/message', async (req, res) => {
    const { custom_message } = req.body;
    try {
        await db.run(`UPDATE events SET custom_message = ? WHERE id = ?`, [custom_message || null, req.params.eventId]);
        res.json({ success: true, message: 'Mensaje actualizado' });
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

// Get unique companies
app.get('/api/events/:eventId/companies', async (req, res) => {
    try {
        const result = await db.all(
            `SELECT DISTINCT company FROM attendees WHERE event_id = ? AND company IS NOT NULL AND company != '' AND company != 'No Aplica' ORDER BY company ASC`, 
            [req.params.eventId]
        );
        const companies = result.map(r => r.company);
        res.json({ success: true, companies });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Create an attendee
app.post('/api/events/:eventId/attendees', async (req, res) => {
    const { room_id, first_name, last_name, email, phone, company, payment_method } = req.body;
    const event_id = req.params.eventId;
    const id = uuidv4();
    const qr_code = crypto.createHash('md5').update(id + event_id + Date.now().toString()).digest('hex');

    try {
        await db.run(
            `INSERT INTO attendees (id, event_id, room_id, first_name, last_name, email, phone, company, payment_method, qr_code, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted')`,
            [id, event_id, room_id, first_name, last_name, email, phone || '', company || 'No Aplica', payment_method, qr_code]
        );
        res.json({ success: true, attendee: { id, event_id, room_id, first_name, last_name, email, phone, payment_method, qr_code, status: 'accepted' } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an attendee (Edit info)
app.put('/api/events/:eventId/attendees/:attendeeId', async (req, res) => {
    const { room_id, first_name, last_name, email, phone, company, payment_method } = req.body;
    const { eventId, attendeeId } = req.params;

    try {
        await db.run(
            `UPDATE attendees SET room_id = ?, first_name = ?, last_name = ?, email = ?, phone = ?, company = ?, payment_method = ? 
             WHERE id = ? AND event_id = ?`,
            [room_id, first_name, last_name, email, phone || '', company || 'No Aplica', payment_method, attendeeId, eventId]
        );
        res.json({ success: true, message: 'Attendee updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk Create Attendees
app.post('/api/events/:eventId/rooms/:roomId/attendees/bulk', async (req, res) => {
    const { attendees } = req.body;
    const { eventId, roomId } = req.params;

    if (!Array.isArray(attendees)) {
        return res.status(400).json({ error: 'Attendees must be an array' });
    }

    try {
        const addedAttendees = [];
        for (const att of attendees) {
            const id = uuidv4();
            const qr_code = crypto.createHash('md5').update(id + eventId + Date.now().toString()).digest('hex');
            
            await db.run(
                `INSERT INTO attendees (id, event_id, room_id, first_name, last_name, email, phone, company, payment_method, qr_code, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted')`,
                [id, eventId, roomId, att.first_name || '', att.last_name || '', att.email || '', att.phone || '', att.company || 'No Aplica', att.payment_method || 'Efectivo', qr_code]
            );
            addedAttendees.push({ id, event_id: eventId, room_id: roomId, ...att, qr_code, status: 'accepted' });
        }

        res.json({ success: true, attendees: addedAttendees });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PUBLIC REGISTRATION & PENDING APPROVAL ROUTE
// ==========================================

// Public self-registration
app.post('/api/public/events/:eventId/register', async (req, res) => {
    const { room_id, first_name, last_name, email, phone, company, payment_method } = req.body;
    const event_id = req.params.eventId;
    
    if (!room_id || !first_name || !last_name) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos.' });
    }

    const id = uuidv4();
    const qr_code = crypto.createHash('md5').update(id + event_id + Date.now().toString()).digest('hex');

    try {
        await db.run(
            `INSERT INTO attendees (id, event_id, room_id, first_name, last_name, email, phone, company, payment_method, qr_code, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [id, event_id, room_id, first_name, last_name, email, phone || '', company || 'No Aplica', payment_method || 'Tarjeta', qr_code]
        );
        res.json({ success: true, message: 'Registro exitoso, en espera de aprobación.', attendeeId: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an attendee status (accept / reject)
app.put('/api/events/:eventId/attendees/:attendeeId/status', async (req, res) => {
    const { status } = req.body; // 'accepted' or 'rejected'
    const attendeeId = req.params.attendeeId;
    const event_id = req.params.eventId;

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
        await db.run(
            `UPDATE attendees SET status = ? WHERE id = ? AND event_id = ?`,
            [status, attendeeId, event_id]
        );
        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk update attendees status
app.put('/api/events/:eventId/attendees/bulk-status', async (req, res) => {
    const { status, attendeeIds } = req.body;
    const event_id = req.params.eventId;

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Must provide an array of attendee IDs' });
    }

    try {
        // Build query string for IN clause. E.g., (?, ?, ?)
        const placeholders = attendeeIds.map(() => '?').join(',');
        await db.run(
            `UPDATE attendees SET status = ? WHERE event_id = ? AND id IN (${placeholders})`,
            [status, event_id, ...attendeeIds]
        );
        res.json({ success: true, message: `Bulk status updated to ${status}` });
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

// Send Email Endpoint
app.post('/api/events/:eventId/attendees/:attendeeId/send-email', async (req, res) => {
    const { eventId, attendeeId } = req.params;
    try {
        const attendee = await db.get(`SELECT * FROM attendees WHERE id = ? AND event_id = ?`, [attendeeId, eventId]);
        const event = await db.get(`SELECT * FROM events WHERE id = ?`, [eventId]);
        const room = await db.get(`SELECT * FROM rooms WHERE id = ?`, [attendee?.room_id]);

        if (!attendee || !attendee.email) {
            return res.status(400).json({ success: false, message: 'El asistente no tiene un correo válido registrado.' });
        }

        // Generate QR code base64 image
        const qrUrl = req.headers.origin + '/show/' + attendee.qr_code;
        const qrImageBase64 = await QRCode.toDataURL(qrUrl);

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: (process.env.SMTP_PORT || '465').toString() === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        let htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>¡Hola ${attendee.first_name} ${attendee.last_name}!</h2>
                <p>Te compartimos tu código QR de acceso al evento <strong>"${event?.name}"</strong>.</p>
                <p>Estás registrado para asistir a la sala: <strong>"${room?.name}"</strong>.</p>
                <p>Puedes presentar el código QR adjunto en la puerta el día del evento, o acceder al siguiente enlace:</p>
                <p><a href="${qrUrl}">${qrUrl}</a></p>
                <br/>
                <p>¡Te esperamos!</p>
            </div>
        `;

        // Si se colocó un mensaje personalizado, se reemplaza el contenido por defecto
        if (event?.custom_message) {
            let parsedMessage = event.custom_message
                .replace(/{nombre}/g, `${attendee.first_name} ${attendee.last_name}`)
                .replace(/{sala}/g, room?.name || '')
                .replace(/{qr}/g, `<a href="${qrUrl}">${qrUrl}</a>`)
                .replace(/\\n/g, '<br/>'); // Preserve line breaks
                
            htmlBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <p>${parsedMessage}</p>
                </div>
            `;
        }

        const mailAttachments = [
            {
                filename: 'Pase-Acceso-QR.png',
                content: qrImageBase64.split('base64,')[1],
                encoding: 'base64'
            }
        ];

        // Anexar logo del evento si existe
        if (event?.logo && event.logo.includes('base64,')) {
            const extension = event.logo.substring(event.logo.indexOf('/') + 1, event.logo.indexOf(';base64'));
            mailAttachments.push({
                filename: `Logo-Evento.${extension}`,
                content: event.logo.split('base64,')[1],
                encoding: 'base64'
            });
        }

        const mailOptions = {
            from: process.env.SMTP_USER || 'admin@brandingticket.com',
            to: attendee.email,
            subject: `Tu QR de Acceso - Evento: ${event?.name || 'BrandingTicket'}`,
            html: htmlBody,
            attachments: mailAttachments
        };

        if(!process.env.SMTP_HOST || !process.env.SMTP_USER) {
           return res.status(500).json({ success: false, message: 'Servidor SMTP no configurado en el archivo .env' });
        }

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Correo enviado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PUBLIC QR CHECK-IN ROUTES
// ==========================================

// Get QR Code Image Directly (For WhatsApp preview)
app.get('/api/public/qr/:qrCode.png', async (req, res) => {
    try {
        const qrUrl = req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1')
            ? `http://${req.headers.host.replace('3001', '5173')}/show/${req.params.qrCode}`
            : `https://${req.headers.host}/show/${req.params.qrCode}`;
            
        // Provide the generated PNG directly
        const buffer = await QRCode.toBuffer(qrUrl, { type: 'png', width: 300 });
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    } catch (err) {
        res.status(500).send('Error generating QR image');
    }
});

// Get attendee info via QR Code (MD5)
app.get('/api/public/attendee/:qrCode', async (req, res) => {
    try {
        const attendee = await db.get(`
            SELECT a.*, r.name as room_name, e.name as event_name, e.access_code as event_access_code
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