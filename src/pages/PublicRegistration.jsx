import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './PublicRegistration.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PublicRegistration = () => {
    const { eventId } = useParams();
    const [eventData, setEventData] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // 1. MODIFICAMOS EL ESTADO PARA SOPORTAR MÚLTIPLES CHARLAS
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        ci: '',
        email: '',
        phone: '',
        company: 'No Aplica',
        payment_method: 'Efectivo',
        selected_sessions: [] // <-- Arreglo que guardará los IDs seleccionados
    });

    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        const fetchEventDetails = async () => {
            try {
                const eventRes = await axios.get(`${API_URL}/events/${eventId}`);
                if (eventRes.data.success) setEventData(eventRes.data.event);

                const roomsRes = await axios.get(`${API_URL}/events/${eventId}/rooms`);
                if (roomsRes.data.success) setRooms(roomsRes.data.rooms);

                try {
                    const sessionsRes = await axios.get(`${API_URL}/events/${eventId}/sessions`);
                    if (sessionsRes.data && sessionsRes.data.success) {
                        setSessions(sessionsRes.data.sessions);
                    }
                } catch (e) { console.error('Error fetching sessions', e); }

                try {
                    const compRes = await axios.get(`${API_URL}/events/${eventId}/companies`);
                    if (compRes.data && compRes.data.success) setCompanies(compRes.data.companies);
                } catch (e) { }
            } catch (err) {
                console.error('Error fetching event details', err);
            } finally {
                setLoading(false);
            }
        };

        if (eventId) fetchEventDetails();
    }, [eventId]);

    // Manejador para agregar o quitar sesiones del arreglo
    const handleSessionToggle = (sessionId) => {
        const currentSelected = formData.selected_sessions;
        if (currentSelected.includes(sessionId)) {
            setFormData({
                ...formData,
                selected_sessions: currentSelected.filter(id => id !== sessionId)
            });
        } else {
            setFormData({
                ...formData,
                selected_sessions: [...currentSelected, sessionId]
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación: Debe elegir al menos una charla
        if (formData.selected_sessions.length === 0) {
            alert('Por favor selecciona al menos una charla / curso al que desees asistir.');
            return;
        }

        setSubmitting(true);
        try {
            // Enviamos la petición POST al nuevo endpoint o al existente adaptado
            const res = await axios.post(`${API_URL}/public/events/${eventId}/register-multiple`, formData);
            if (res.data.success) {
                setSuccessMessage('¡Registro Exitoso! Tus solicitudes han sido enviadas para aprobación.');
                setFormData({ first_name: '', last_name: '', ci: '', email: '', phone: '', company: 'No Aplica', payment_method: 'Efectivo', selected_sessions: [] });
            }
        } catch (err) {
            console.error('Registration error', err);
            alert(err.response?.data?.message || 'Ocurrió un error al intentar registrarte. Verifica que no tengas choques de horario.');
        } finally {
            setSubmitting(false);
        }
    };

    // Función auxiliar para obtener el nombre de la sala
    const getRoomName = (roomId) => {
        const r = rooms.find(room => room.id === roomId);
        return r ? `${r.name} (${r.conference_name})` : '';
    };

    if (loading) return <div className="registration-container"><div className="loading-text">Cargando evento...</div></div>;
    if (!eventData) return <div className="registration-container"><div className="error-text">Evento no encontrado.</div></div>;
    if (successMessage) {
        return (
            <div className="registration-container">
                <div className="registration-card success-card">
                    <div className="success-icon">✅</div>
                    <h2>¡Gracias por Registrarte!</h2>
                    <p>{successMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="registration-container">
            <div className="background-mesh registration-bg"></div>

            <div className="registration-card">
                <div className="registration-header">
                    <h2>Registro Múltiple para Evento</h2>
                    <h3 className="gradient-text">{eventData.name}</h3>
                </div>

                <form onSubmit={handleSubmit} className="registration-form">
                    <div className="form-group">
                        <label>Nombre</label>
                        <input type="text" required placeholder="Ej. Juan" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label>Apellido</label>
                        <input type="text" required placeholder="Ej. Pérez" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label>C.I. (Opcional)</label>
                        <input type="text" placeholder="Ej. 12.345.678" value={formData.ci} onChange={(e) => setFormData({ ...formData, ci: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label>Correo Electrónico</label>
                        <input type="email" required placeholder="Ej. juan@correo.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label>Número de WhatsApp / Teléfono</label>
                        <input type="tel" required placeholder="Ej. +584141234567" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label>Empresa (Opcional)</label>
                        <input list="companyList" name="company" placeholder="Ej. Mi Empresa C.A." value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} onFocus={(e) => { if (e.target.value === 'No Aplica') setFormData({ ...formData, company: '' }); }} />
                        <datalist id="companyList">
                            <option value="No Aplica" />
                            {companies.map((comp, idx) => <option key={idx} value={comp} />)}
                        </datalist>
                    </div>

                    {/* 2. NUEVO COMPONENTE DE SELECCIÓN MÚLTIPLE DE CHARLAS */}
                    <div className="form-group">
                        <label>Selecciona las Charlas / Cursos a los que asistirás:</label>
                        {sessions.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No hay charlas configuradas en este evento.</p>
                        ) : (
                            /* 1. El contenedor padre se queda completamente normal (apilado 1 por fila) */
                            <div className="sessions-checkbox-list" style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                {sessions.map(s => {
                                    const isChecked = formData.selected_sessions.includes(s.id);
                                    return (
                                        /* 2. Aplicamos la cuadrícula interna 1/5 y 4/5 al label */
                                        <label
                                            key={s.id}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 4fr', // <-- AQUÍ ESTÁ LA PROPORCIÓN: 1/5 y 4/5
                                                alignItems: 'flex-start',
                                                gap: '0.8rem',
                                                padding: '0.6rem',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                                background: isChecked ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            {/* 3. El espacio del 1/5 (20%) para el checkbox */}
                                            <div style={{ textAlign: 'center', marginTop: '0.2rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleSessionToggle(s.id)}
                                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                />
                                            </div>

                                            {/* 4. El espacio de los 4/5 (80%) para la información */}
                                            <div>
                                                <strong style={{ color: 'white', display: 'block' }}>{s.name}</strong>
                                                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>Ponente: {s.speaker} | Sala: {getRoomName(s.room_id)}</span>
                                                <span style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 'bold' }}>📅 {s.session_date} ⏰ {s.start_time} - {s.end_time}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button type="submit" className="submit-btn" disabled={submitting}>
                        {submitting ? 'Procesando inscripciones...' : 'Completar Registro Múltiple'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PublicRegistration;