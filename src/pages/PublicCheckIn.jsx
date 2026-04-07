import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Home as RoomIcon, Calendar, Clock, CheckCircle, ShieldAlert } from 'lucide-react';
import './AdminEventsList.css'; // Let's reuse the modern glass-panel styles

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PublicCheckIn = () => {
    const { qrCode } = useParams();
    const [attendee, setAttendee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [marking, setMarking] = useState(false);

    useEffect(() => {
        const fetchAttendee = async () => {
            try {
                const res = await axios.get(`${API_URL}/public/attendee/${qrCode}`);
                if (res.data.success) {
                    setAttendee(res.data.attendee);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Error al validar el código QR');
            } finally {
                setLoading(false);
            }
        };

        if (qrCode) fetchAttendee();
    }, [qrCode]);

    const handleCheckIn = async () => {
        setMarking(true);
        try {
            const res = await axios.put(`${API_URL}/public/attendee/${qrCode}/arrival`);
            if (res.data.success) {
                setAttendee(res.data.attendee); // Update local state directly with marked has_arrived mapping
            }
        } catch (err) {
            alert('Hubo un error al marcar la llegada.');
        } finally {
            setMarking(false);
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
            
            <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', position: 'relative', zIndex: 1, padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'white', fontSize: '2rem', fontWeight: 'bold' }}>
                        {attendee.first_name.charAt(0)}{attendee.last_name.charAt(0)}
                    </div>
                    <h1 style={{ color: 'white', fontSize: '2rem', marginBottom: '0.5rem', marginTop: '0' }}>{attendee.first_name} {attendee.last_name}</h1>
                    <div style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: '500' }}>
                        Pase de Invitado
                    </div>
                </div>

                <div className="stats" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#cbd5e1' }}>
                        <Mail size={18} color="#94a3b8" />
                        <span>{attendee.email || 'Sin correo asociado'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#cbd5e1' }}>
                        <Calendar size={18} color="#94a3b8" />
                        <span><strong>Evento:</strong> {attendee.event_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#cbd5e1' }}>
                        <RoomIcon size={18} color="#94a3b8" />
                        <span><strong>Salón:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{attendee.room_name}</span></span>
                    </div>
                </div>

                {attendee.has_arrived ? (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', color: '#10b981' }}>
                        <CheckCircle size={32} style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Asistencia Confirmada</h2>
                        <p style={{ color: '#a7f3d0' }}>Llegada registrada a las <strong>{attendee.arrival_time}</strong></p>
                    </div>
                ) : (
                    <button 
                        onClick={handleCheckIn}
                        disabled={marking}
                        style={{
                            width: '100%',
                            background: marking ? '#475569' : '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '1.2rem',
                            borderRadius: '12px',
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            cursor: marking ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: marking ? 'none' : '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                            transition: 'all 0.3s'
                        }}
                    >
                        {marking ? <div className="loader" style={{ width: '20px', height: '20px', borderWidth: '3px' }}></div> : <Clock size={20} />}
                        {marking ? 'Marcando...' : 'Marcar Llegada Manual'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default PublicCheckIn;
