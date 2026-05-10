import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Mail, Calendar, Clock, CheckCircle, ShieldAlert } from 'lucide-react';
import './AdminEventsList.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PublicCheckIn = () => {
    const { qrCode } = useParams();
    const [userData, setUserData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [markingId, setMarkingId] = useState(null); // Sabe cuál charla específica está cargando

    useEffect(() => {
        const fetchAttendeeData = async () => {
            try {
                const res = await axios.get(`${API_URL}/public/attendee/${qrCode}`);
                if (res.data.success) {
                    setUserData(res.data.user);
                    setSessions(res.data.sessions);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Error al validar el código QR');
            } finally {
                setLoading(false);
            }
        };

        if (qrCode) fetchAttendeeData();
    }, [qrCode]);

    // 👉 FUNCIÓN CLAVE: Solicita código y marca llegada a una charla específica
    const handleDoubleClickArrival = async (session) => {
        // Si ya llegó o se está procesando, ignoramos
        if (session.has_arrived || markingId) return;

        const code = prompt(`Para registrar la entrada a "${session.session_name}", ingrese el código de acceso del evento:`);

        if (code === userData.event_access_code) {
            setMarkingId(session.attendee_row_id);
            try {
                // Usamos tu ruta existente que marca llegada por ID individual
                const res = await axios.put(`${API_URL}/events/${userData.event_id}/attendees/${session.attendee_row_id}/arrival`);

                if (res.data.success) {
                    // Actualizamos visualmente esa charla específica a verde
                    setSessions(prevSessions => prevSessions.map(s =>
                        s.attendee_row_id === session.attendee_row_id
                            ? { ...s, has_arrived: true, arrival_time: res.data.attendee.arrival_time }
                            : s
                    ));
                }
            } catch (err) {
                alert('Hubo un error al intentar registrar la entrada en el servidor.');
            } finally {
                setMarkingId(null);
            }
        } else if (code !== null) {
            alert('Código de acceso incorrecto. No autorizado.');
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}><div className="loader"></div></div>;
    }

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', maxWidth: '400px' }}>
                    <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ color: 'white', marginBottom: '1rem' }}>Acceso Inválido</h2>
                    <p style={{ color: '#94a3b8' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="admin-background">
                <div className="glow glow-1"></div>
            </div>

            <div className="glass-panel" style={{ maxWidth: '550px', width: '100%', position: 'relative', zIndex: 1, padding: '2.5rem' }}>

                {/* Encabezado del Asistente */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'white', fontSize: '2rem', fontWeight: 'bold', userSelect: 'none' }}>
                        {userData.first_name.charAt(0)}{userData.last_name.charAt(0)}
                    </div>
                    <h1 style={{ color: 'white', fontSize: '1.8rem', marginBottom: '0.3rem', marginTop: '0' }}>
                        {userData.first_name} {userData.last_name}
                    </h1>
                    <div style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        Pase de Acceso Verificado
                    </div>
                </div>

                {/* Datos Generales */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#cbd5e1' }}>
                        <Mail size={16} color="#94a3b8" />
                        <span>{userData.email || 'Sin correo asociado'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#cbd5e1' }}>
                        <Calendar size={16} color="#94a3b8" />
                        <span><strong>Evento:</strong> {userData.event_name}</span>
                    </div>
                </div>

                {/* Instrucción Operativa */}
                <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <p style={{ color: '#60a5fa', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>
                        💡 <strong>Instrucción:</strong> Haz <b>doble clic</b> sobre la charla a la que ingresa el asistente para autorizar y registrar su entrada.
                    </p>
                </div>

                {/* 👉 ITINERARIO DE CHARLAS DE ESTE ASISTENTE */}
                <h3 style={{ color: '#cbd5e1', fontSize: '1rem', marginBottom: '0.8rem', marginTop: 0 }}>
                    Charlas Inscritas ({sessions.length}):
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {sessions.map(session => (
                        <div
                            key={session.attendee_row_id}
                            onDoubleClick={() => handleDoubleClickArrival(session)}
                            style={{
                                padding: '1rem',
                                borderRadius: '10px',
                                border: '1px solid',
                                borderColor: session.has_arrived ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.1)',
                                background: session.has_arrived ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.4)',
                                cursor: session.has_arrived ? 'default' : 'pointer',
                                userSelect: 'none',
                                transition: 'all 0.2s'
                            }}
                            title={session.has_arrived ? "Asistencia confirmada" : "Doble clic para marcar entrada"}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div>
                                    <strong style={{ color: 'white', display: 'block', fontSize: '1.05rem' }}>
                                        💬 {session.session_name}
                                    </strong>
                                    <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginTop: '0.2rem' }}>
                                        📍 Salón: {session.room_name}
                                    </span>
                                    {session.speaker && (
                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block' }}>
                                            Ponente: {session.speaker}
                                        </span>
                                    )}
                                    <span style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginTop: '0.2rem' }}>
                                        📅 {session.session_date} ({session.start_time} - {session.end_time})
                                    </span>
                                </div>

                                {/* Insignia de Estado */}
                                <div style={{ textAlign: 'right' }}>
                                    {markingId === session.attendee_row_id ? (
                                        <div className="loader" style={{ width: '16px', height: '16px', borderWidth: '2px', display: 'inline-block' }}></div>
                                    ) : session.has_arrived ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                <CheckCircle size={14} /> Confirmado
                                            </span>
                                            <span style={{ color: '#a7f3d0', fontSize: '0.75rem' }}>{session.arrival_time}</span>
                                        </div>
                                    ) : (
                                        <span style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            ⏳ Pendiente
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default PublicCheckIn; ``