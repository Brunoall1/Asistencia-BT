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

// Ruta temporal para quitar el candado UNIQUE de producción
app.get('/api/utils/fix-db', async (req, res) => {
    try {
        await db.run(`ALTER TABLE attendees DROP CONSTRAINT IF EXISTS attendees_qr_code_key`);
        res.json({ success: true, message: 'Candado UNIQUE eliminado de producción exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

    try {
        // RESTRICCIÓN 1: Evitar choques de horario por Día y Hora
        if (email) {
            const targetRoomSessions = await db.all(
                `SELECT session_date, start_time, end_time, name FROM sessions WHERE room_id = ? AND event_id = ?`,
                [room_id, event_id]
            );

            const existingSessions = await db.all(
                `SELECT s.session_date, s.start_time, s.end_time, s.name as session_name, r.name as room_name
                 FROM attendees a
                 JOIN sessions s ON a.room_id = s.room_id
                 JOIN rooms r ON a.room_id = r.id
                 WHERE a.email = ? AND a.event_id = ?`,
                [email, event_id]
            );

            for (let newSession of targetRoomSessions) {
                for (let existingSession of existingSessions) {
                    if (newSession.session_date === existingSession.session_date) {
                        if (newSession.start_time < existingSession.end_time && newSession.end_time > existingSession.start_time) {
                            return res.status(400).json({
                                success: false,
                                error: `Choque de horario: La charla "${newSession.name}" choca con "${existingSession.session_name}" (Sala: ${existingSession.room_name}) el día ${newSession.session_date}.`
                            });
                        }
                    }
                }
            }
        }

        // RESTRICCIÓN 2: Evitar registro duplicado en la misma charla (por nombre)
        if (email && req.body.session_id) {
            const targetSession = await db.get(
                `SELECT name FROM sessions WHERE id = ?`,
                [req.body.session_id]
            );

            if (targetSession) {
                const duplicateRegistration = await db.get(
                    `SELECT s.name, s.session_date, s.start_time, r.name as room_name
                     FROM attendees a
                     JOIN sessions s ON a.session_id = s.id
                     JOIN rooms r ON a.room_id = r.id
                     WHERE a.email = ? AND a.event_id = ? AND s.name = ?`,
                    [email, event_id, targetSession.name]
                );

                if (duplicateRegistration) {
                    return res.status(400).json({
                        success: false,
                        message: `Registro denegado: Ya estás inscrito en la charla "${duplicateRegistration.name}" para el día ${duplicateRegistration.session_date} a las ${duplicateRegistration.start_time} (Sala: ${duplicateRegistration.room_name}). No está permitido inscribirse en múltiples horarios de la misma charla.`
                    });
                }
            }
        }

        const id = uuidv4();
        const qr_code = crypto.createHash('md5').update(id + event_id + Date.now().toString()).digest('hex');

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

// ====================================================================
// 🎯 CORRECCIÓN CLAVE 1: RUTA BULK-STATUS REUBICADA ARRIBA DEL COMODÍN
// ====================================================================
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

// Update an attendee status individual (accept / reject)
app.put('/api/events/:eventId/attendees/:attendeeId/status', async (req, res) => {
    const { status } = req.body;
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

// Mark attendee as arrived / QR scan global por CPanel
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

        const room = await db.get(`SELECT name, conference_name FROM rooms WHERE id = ?`, [attendee.room_id]);

        res.json({ success: true, attendee: { ...attendee, has_arrived: true, arrival_time }, room });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark attendee as arrived manually by individual ID (Doble clic en escáner)
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

// ====================================================================
// ⚠️ LA RUTA COMODÍN GENERAL SE QUEDA AQUÍ ABAJO
// ====================================================================
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

// Send Email Endpoint con Itinerario Completo de Charlas
app.post('/api/events/:eventId/attendees/:attendeeId/send-email', async (req, res) => {
    const { eventId, attendeeId } = req.params;
    try {
        // 1. Obtenemos la fila inicial para saber cuál es el QR y el correo de esta persona
        const baseAttendee = await db.get(`SELECT * FROM attendees WHERE id = ? AND event_id = ?`, [attendeeId, eventId]);
        const event = await db.get(`SELECT * FROM events WHERE id = ?`, [eventId]);

        if (!baseAttendee || !baseAttendee.email) {
            return res.status(400).json({ success: false, message: 'El asistente no tiene un correo válido registrado.' });
        }

        // 2. MAGIA SQL: Buscamos TODAS las charlas inscritas por este usuario usando su QR
        const userSessions = await db.all(`
            SELECT s.name as session_name, s.speaker, s.session_date, s.start_time, s.end_time, r.name as room_name
            FROM attendees a
            JOIN sessions s ON a.session_id = s.id
            JOIN rooms r ON a.room_id = r.id
            WHERE a.qr_code = ? AND a.event_id = ?
            ORDER BY s.session_date ASC, s.start_time ASC
        `, [baseAttendee.qr_code, eventId]);

        // 3. Generamos la imagen del código QR
        const qrUrl = req.headers.origin + '/show/' + baseAttendee.qr_code;
        const qrImageBase64 = await QRCode.toDataURL(qrUrl);

        // 4. Construimos un bloque HTML con la lista de charlas ordenadas
        let sessionsHtmlList = `<div style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; text-align: left;">
                <thead style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <tr>
                        <th style="padding: 12px; font-size: 14px; color: #334155;">Charla / Taller</th>
                        <th style="padding: 12px; font-size: 14px; color: #334155;">Salón</th>
                        <th style="padding: 12px; font-size: 14px; color: #334155;">Horario</th>
                    </tr>
                </thead>
                <tbody>`;

        if (userSessions && userSessions.length > 0) {
            userSessions.forEach(sess => {
                sessionsHtmlList += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-size: 14px; color: #0f172a;">
                            <strong>${sess.session_name}</strong><br/>
                            <span style="font-size: 12px; color: #64748b;">Ponente: ${sess.speaker || 'N/A'}</span>
                        </td>
                        <td style="padding: 12px; font-size: 14px; color: #0f172a; font-weight: bold; color: #10b981;">
                            ${sess.room_name}
                        </td>
                        <td style="padding: 12px; font-size: 14px; color: #475569;">
                            ${sess.session_date || ''}<br/>
                            <strong>${sess.start_time} - ${sess.end_time}</strong>
                        </td>
                    </tr>`;
            });
        } else {
            sessionsHtmlList += `<tr><td colSpan="3" style="padding: 12px; text-align: center; color: #64748b;">Inscripción General (Sin charlas específicas)</td></tr>`;
        }

        sessionsHtmlList += `</tbody></table></div>`;

        // 5. Configuración del transportador SMTP
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: (process.env.SMTP_PORT || '465').toString() === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // 6. Cuerpo HTML por defecto (Ahora incluye la tabla de charlas)
        let htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
                <h2 style="color: #1e293b;">¡Hola ${baseAttendee.first_name} ${baseAttendee.last_name}!</h2>
                <p>Te compartimos tu pase oficial y el código QR de acceso único para el evento <strong>"${event?.name}"</strong>.</p>
                
                <h3 style="color: #3b82f6; margin-top: 20px; margin-bottom: 5px;">Tu Itinerario Confirmado:</h3>
                ${sessionsHtmlList}

                <p>Puedes presentar el código QR adjunto en este correo al llegar a las puertas de los salones, o acceder a tu pase digital en vivo en el siguiente enlace:</p>
                <p><a href="${qrUrl}" style="color: #3b82f6; font-weight: bold;">Abrir mi pase web QR</a></p>
                <br/>
                <p>¡Te esperamos!</p>
            </div>
        `;

        // 7. Reemplazo para mensajes personalizados (Añadimos soporte para la etiqueta {charlas})
        if (event?.custom_message) {
            // Nota: Si en tu panel administrativo usaban {sala}, lo dejamos por compatibilidad apuntando a la primera, 
            // pero añadimos el reemplazo de {charlas} para que inyecte la tabla completa.
            const firstRoomObj = await db.get(`SELECT name FROM rooms WHERE id = ?`, [baseAttendee.room_id]);

            let parsedMessage = event.custom_message
                .replace(/{nombre}/g, `${baseAttendee.first_name} ${baseAttendee.last_name}`)
                .replace(/{sala}/g, firstRoomObj?.name || '')
                .replace(/{charlas}/g, sessionsHtmlList) // 👉 NUEVA ETIQUETA SOPORTADA
                .replace(/{qr}/g, `<a href="${qrUrl}" style="color: #3b82f6; font-weight: bold;">Abrir pase QR</a>`)
                .replace(/\n/g, '<br/>');

            htmlBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
                    <p>${parsedMessage}</p>
                    ${!event.custom_message.includes('{charlas}') ? `<br/><h3>Tu Itinerario:</h3>${sessionsHtmlList}` : ''}
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
            to: baseAttendee.email,
            subject: `Tu Itinerario y QR de Acceso - Evento: ${event?.name || 'BrandingTicket'}`,
            html: htmlBody,
            attachments: mailAttachments
        };

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
            return res.status(500).json({ success: false, message: 'Servidor SMTP no configurado en el archivo .env' });
        }

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Correo enviado correctamente con el itinerario.' });
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

    try {
        if (email) {
            const targetRoomSessions = await db.all(
                `SELECT session_date, start_time, end_time, name FROM sessions WHERE room_id = ? AND event_id = ?`,
                [room_id, event_id]
            );

            const existingSessions = await db.all(
                `SELECT s.session_date, s.start_time, s.end_time, s.name as session_name, r.name as room_name
                 FROM attendees a
                 JOIN sessions s ON a.room_id = s.room_id
                 JOIN rooms r ON a.room_id = r.id
                 WHERE a.email = ? AND a.event_id = ?`,
                [email, event_id]
            );

            for (let newSession of targetRoomSessions) {
                for (let existingSession of existingSessions) {
                    if (newSession.session_date === existingSession.session_date) {
                        if (newSession.start_time < existingSession.end_time && newSession.end_time > existingSession.start_time) {
                            return res.status(400).json({
                                success: false,
                                message: `Choque de horario: La charla "${newSession.name}" choca con "${existingSession.session_name}" (Sala: ${existingSession.room_name}) el día ${newSession.session_date}.`
                            });
                        }
                    }
                }
            }
        }

        if (email && req.body.session_id) {
            const targetSession = await db.get(
                `SELECT name FROM sessions WHERE id = ?`,
                [req.body.session_id]
            );

            if (targetSession) {
                const duplicateRegistration = await db.get(
                    `SELECT s.name, s.session_date, s.start_time, r.name as room_name
                     FROM attendees a
                     JOIN sessions s ON a.session_id = s.id
                     JOIN rooms r ON a.room_id = r.id
                     WHERE a.email = ? AND a.event_id = ? AND s.name = ?`,
                    [email, event_id, targetSession.name]
                );

                if (duplicateRegistration) {
                    return res.status(400).json({
                        success: false,
                        message: `Registro denegado: Ya estás inscrito en la charla "${duplicateRegistration.name}" para el día ${duplicateRegistration.session_date} a las ${duplicateRegistration.start_time} (Sala: ${duplicateRegistration.room_name}). No está permitido inscribirse en múltiples horarios de la misma charla.`
                    });
                }
            }
        }

        const id = uuidv4();
        const qr_code = crypto.createHash('md5').update(id + event_id + Date.now().toString()).digest('hex');

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

// Registro público para MÚLTIPLES charlas simultáneas con QR Único Global
app.post('/api/public/events/:eventId/register-multiple', async (req, res) => {
    const { selected_sessions, ci, first_name, last_name, email, phone, company, payment_method } = req.body;
    const event_id = req.params.eventId;

    if (!Array.isArray(selected_sessions) || selected_sessions.length === 0 || !first_name || !last_name) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos o no se seleccionaron charlas.' });
    }

    try {
        const placeholders = selected_sessions.map(() => '?').join(',');
        const targetSessions = await db.all(
            `SELECT id, room_id, name, session_date, start_time, end_time FROM sessions WHERE id IN (${placeholders})`,
            selected_sessions
        );

        if (email) {
            const existingUserSessions = await db.all(
                `SELECT s.id, s.name, s.session_date, s.start_time, s.end_time, r.name as room_name
                 FROM attendees a
                 JOIN sessions s ON a.session_id = s.id
                 JOIN rooms r ON a.room_id = r.id
                 WHERE a.email = ? AND a.event_id = ?`,
                [email, event_id]
            );

            for (let i = 0; i < targetSessions.length; i++) {
                for (let j = i + 1; j < targetSessions.length; j++) {
                    const s1 = targetSessions[i];
                    const s2 = targetSessions[j];
                    if (s1.name === s2.name) {
                        return res.status(400).json({ success: false, message: `Selección inválida: Elegiste la misma charla "${s1.name}" dos veces.` });
                    }
                    if (s1.session_date === s2.session_date && s1.start_time < s2.end_time && s1.end_time > s2.start_time) {
                        return res.status(400).json({ success: false, message: `Selección inválida: Choque de horario entre "${s1.name}" y "${s2.name}".` });
                    }
                }
            }

            for (let newSession of targetSessions) {
                for (let existingSession of existingUserSessions) {
                    if (newSession.name === existingSession.name) {
                        return res.status(400).json({ success: false, message: `Ya estás inscrito en la charla "${existingSession.name}".` });
                    }
                    if (newSession.session_date === existingSession.session_date && newSession.start_time < existingSession.end_time && newSession.end_time > existingSession.start_time) {
                        return res.status(400).json({ success: false, message: `Choque con una charla previa: "${existingSession.name}".` });
                    }
                }
            }
        }

        // Generamos UN SOLO QR basado en el email y el evento para este asistente
        const shared_qr_code = crypto.createHash('md5').update(email.toLowerCase() + event_id).digest('hex');

        let firstInsertedId = null;

        for (let currentSession of targetSessions) {
            const attendeeRecordId = uuidv4();
            if (!firstInsertedId) firstInsertedId = attendeeRecordId;

            await db.run(
                `INSERT INTO attendees (id, event_id, room_id, session_id, ci, first_name, last_name, email, phone, company, payment_method, qr_code, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    attendeeRecordId,
                    event_id,
                    currentSession.room_id,
                    currentSession.id,
                    ci || '',
                    first_name,
                    last_name,
                    email,
                    phone || '',
                    company || 'No Aplica',
                    payment_method || 'Tarjeta',
                    shared_qr_code // Todas las filas guardan el MISMO código QR
                ]
            );
        }

        res.json({ success: true, message: 'Registros múltiples exitosos.', attendeeId: firstInsertedId });
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

        const buffer = await QRCode.toBuffer(qrUrl, { type: 'png', width: 300 });
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    } catch (err) {
        res.status(500).send('Error generating QR image');
    }
});

// Get attendee info via QR Code (MD5) - LISTA COMPLETA DE CHARLAS
app.get('/api/public/attendee/:qrCode', async (req, res) => {
    try {
        // Usamos db.all para traer TODAS las inscripciones de este QR
        const attendeeRows = await db.all(`
            SELECT a.id as attendee_row_id, a.*, r.name as room_name, e.name as event_name, e.access_code as event_access_code,
                   s.name as session_name, s.speaker, s.session_date, s.start_time, s.end_time
            FROM attendees a
            JOIN rooms r ON a.room_id = r.id
            JOIN events e ON a.event_id = e.id
            LEFT JOIN sessions s ON a.session_id = s.id
            WHERE a.qr_code = ?
            ORDER BY s.session_date ASC, s.start_time ASC
        `, [req.params.qrCode]);

        if (!attendeeRows || attendeeRows.length === 0) {
            return res.status(404).json({ success: false, message: 'QR Code inválido o asistente no encontrado' });
        }

        // Agrupamos la información personal común (de la primera fila)
        const userInfo = {
            first_name: attendeeRows[0].first_name,
            last_name: attendeeRows[0].last_name,
            email: attendeeRows[0].email,
            event_name: attendeeRows[0].event_name,
            event_id: attendeeRows[0].event_id,
            event_access_code: attendeeRows[0].event_access_code
        };

        // Mapeamos el itinerario de charlas con sus IDs individuales
        const sessions = attendeeRows.map(row => ({
            attendee_row_id: row.attendee_row_id, // 👉 EL ID INDIVIDUAL PARA MARCAR LLEGADA
            session_name: row.session_name || 'Charla General',
            speaker: row.speaker || '',
            room_name: row.room_name,
            session_date: row.session_date || '',
            start_time: row.start_time || '',
            end_time: row.end_time || '',
            has_arrived: row.has_arrived,
            arrival_time: row.arrival_time
        }));

        res.json({ success: true, user: userInfo, sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ====================================================================
// 🎯 NUEVO ENDPOINT PARA EL ESCÁNER: BUSCA AL USUARIO Y SU ITINERARIO
// ====================================================================
app.get('/api/events/:eventId/scan-lookup/:qrCode', async (req, res) => {
    const { eventId, qrCode } = req.params;

    try {
        // Traemos todas las filas (charlas) asociadas a este QR en este evento
        const attendeeRows = await db.all(
            `SELECT a.id as attendee_row_id, a.first_name, a.last_name, a.ci, a.email, a.has_arrived, a.arrival_time, 
                    s.name as session_name, s.speaker, s.session_date, s.start_time, s.end_time,
                    r.name as room_name
             FROM attendees a
             JOIN sessions s ON a.session_id = s.id
             JOIN rooms r ON a.room_id = r.id
             WHERE a.qr_code = ? AND a.event_id = ?
             ORDER BY s.session_date ASC, s.start_time ASC`,
            [qrCode, eventId]
        );

        if (!attendeeRows || attendeeRows.length === 0) {
            return res.status(404).json({ success: false, message: 'QR no encontrado o no tiene charlas asignadas.' });
        }

        // Extraemos los datos personales comunes (de la primera fila)
        const userInfo = {
            first_name: attendeeRows[0].first_name,
            last_name: attendeeRows[0].last_name,
            ci: attendeeRows[0].ci,
            email: attendeeRows[0].email
        };

        // Mapeamos el itinerario de charlas con su ID de fila individual
        const sessionsList = attendeeRows.map(row => ({
            attendee_row_id: row.attendee_row_id, // 👉 ID INDIVIDUAL PARA MARCAR LA LLEGADA
            session_name: row.session_name,
            speaker: row.speaker,
            room_name: row.room_name,
            session_date: row.session_date,
            start_time: row.start_time,
            end_time: row.end_time,
            has_arrived: row.has_arrived,
            arrival_time: row.arrival_time
        }));

        res.json({ success: true, user: userInfo, sessions: sessionsList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ====================================================================
// 🎯 CORRECCIÓN CLAVE 2: ENDPOINT DEL ESCÁNER AGRUPADO
// ====================================================================
// Buscar información del asistente y TODAS sus charlas mediante el QR (Para el escáner)
app.get('/api/events/:eventId/scan-lookup/:qrCode', async (req, res) => {
    const { eventId, qrCode } = req.params;

    try {
        const attendeeRows = await db.all(
            `SELECT a.id as attendee_row_id, a.first_name, a.last_name, a.ci, a.email, a.has_arrived, a.arrival_time, 
                    s.name as session_name, s.speaker, s.session_date, s.start_time, s.end_time,
                    r.name as room_name
             FROM attendees a
             JOIN sessions s ON a.session_id = s.id
             JOIN rooms r ON a.room_id = r.id
             WHERE a.qr_code = ? AND a.event_id = ?
             ORDER BY s.session_date ASC, s.start_time ASC`,
            [qrCode, eventId]
        );

        if (!attendeeRows || attendeeRows.length === 0) {
            return res.status(404).json({ success: false, message: 'QR no encontrado o no tiene charlas asignadas.' });
        }

        const userInfo = {
            first_name: attendeeRows[0].first_name,
            last_name: attendeeRows[0].last_name,
            ci: attendeeRows[0].ci,
            email: attendeeRows[0].email
        };

        const sessionsList = attendeeRows.map(row => ({
            attendee_row_id: row.attendee_row_id,
            session_name: row.session_name,
            speaker: row.speaker,
            room_name: row.room_name,
            session_date: row.session_date,
            start_time: row.start_time,
            end_time: row.end_time,
            has_arrived: row.has_arrived,
            arrival_time: row.arrival_time
        }));

        res.json({ success: true, user: userInfo, sessions: sessionsList });
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
    const { name, speaker, session_date, start_time, end_time } = req.body;
    const { eventId, roomId } = req.params;
    const id = uuidv4();

    try {
        await db.run(
            `INSERT INTO sessions (id, event_id, room_id, name, speaker, session_date, start_time, end_time) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, eventId, roomId, name, speaker, session_date, start_time, end_time]
        );
        res.json({ success: true, session: { id, event_id: eventId, room_id: roomId, name, speaker, session_date, start_time, end_time } });
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

// API Health check
app.get('/api/ping', (req, res) => {
    res.send('API is alive and running on CPanel');
});

// SERVE FRONTEND - MUST BE AT THE BOTTOM
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get(/.*/, (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'API Route not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});