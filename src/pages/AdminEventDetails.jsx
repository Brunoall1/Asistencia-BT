import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Users, Home as RoomIcon, KeyRound, ExternalLink } from 'lucide-react';
import axios from 'axios';
import './AdminEventsList.css'; // Reusing global admin styles

const API_URL = import.meta.env.VITE_API_URL || '/api';

const AdminEventDetails = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const password = location.state?.password; // We passed the password securely in routing state
    
    const [event, setEvent] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!password) {
            navigate('/admin/events'); // Kick back out if refreshed without password
            return;
        }

        const fetchDetails = async () => {
            try {
                const res = await axios.post(`${API_URL}/admin/events/${eventId}`, { password });
                if (res.data.success) {
                    setEvent(res.data.event);
                    setRooms(res.data.rooms);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Error al cargar detalles');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [eventId, password, navigate]);

    if (loading) {
        return <div className="admin-container" style={{display: 'flex', justifyContent:'center', alignItems: 'center'}}><div className="loader"></div></div>;
    }

    if (error) {
        return <div className="admin-container error-text" style={{textAlign: 'center', marginTop: '5rem'}}>{error}</div>;
    }

    return (
        <div className="admin-container">
            <div className="admin-background">
                <div className="glow glow-1"></div>
            </div>
            
            <header className="admin-header">
                <button className="back-btn" onClick={() => navigate('/admin/events')}>
                    <ArrowLeft size={18} />
                    Regresar
                </button>
                <div>
                    <h1>{event?.name}</h1>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '0.5rem 1rem', borderRadius: '12px', marginTop: '0.5rem', border: '1px solid rgba(244,63,94,0.2)' }}>
                        <KeyRound size={16} />
                        <span style={{ fontWeight: 'bold', letterSpacing: '2px' }}>{event?.access_code}</span>
                    </div>
                </div>
                <div style={{ width: '100px' }}></div> {/* Spacer */}
            </header>

            <div className="events-grid">
                {rooms.length === 0 ? (
                    <div className="empty-state glass-panel">
                        <RoomIcon size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
                        <h3>Sin salones configurados</h3>
                        <p>Este evento aún no tiene ningún salón programado en su Dashboard.</p>
                    </div>
                ) : (
                    rooms.map(room => (
                        <div key={room.id} className="event-item-card glass-panel" onClick={() => navigate(`/event/${eventId}/attendees/${room.id}`)}>
                            <div className="event-card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <RoomIcon size={20} color="#10b981" />
                                    <h3>{room.name}</h3>
                                </div>
                            </div>
                            
                            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', textAlign: 'center', fontStyle: 'italic' }}>"{room.conference_name}"</p>
                            
                            <div className="event-stats-row">
                                <div className="stat-col">
                                    <span className="stat-label">Capacidad</span>
                                    <span className="stat-value" style={{ fontSize: '1.4rem' }}>{room.expected_capacity}</span>
                                </div>
                                <div className="stat-col">
                                    <span className="stat-label">Llegadas</span>
                                    <span className="stat-value highlight" style={{ fontSize: '1.4rem' }}>{room.arrived_attendees || 0}</span>
                                </div>
                            </div>
                            
                            <div className="event-card-action">
                                <span>Administrar Lista</span>
                                <ExternalLink size={16} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminEventDetails;
