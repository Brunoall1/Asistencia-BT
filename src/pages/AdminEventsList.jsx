import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Key, Shield, ArrowLeft, ArrowRight, CalendarDays, KeyRound } from 'lucide-react';
import axios from 'axios';
import './AdminEventsList.css'; // We'll create this CSS

const API_URL = import.meta.env.VITE_API_URL || '/api';

const AdminEventsList = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [isAuth, setIsAuth] = useState(false);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const res = await axios.post(`${API_URL}/admin/events`, { password });
            if (res.data.success) {
                setEvents(res.data.events);
                setIsAuth(true);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error de autenticación');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuth) {
        return (
            <div className="admin-container">
                <div className="admin-background">
                    <div className="glow glow-1"></div>
                </div>
                
                <button className="back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={18} />
                    Volver a Inicio
                </button>
                
                <div className="auth-card glass-panel fade-in">
                    <div className="icon-wrapper circle-icon">
                        <Shield size={40} className="icon-blue" style={{color: '#10b981'}} />
                    </div>
                    <h2>Panel Administrativo</h2>
                    <p>Ingresa la clave maestra para visualizar los eventos.</p>
                    
                    <form onSubmit={handleAuth} className="auth-form" style={{ marginTop: '2rem' }}>
                        <div className="input-group">
                            <Key size={20} className="input-icon" />
                            <input 
                                type="password" 
                                placeholder="Clave maestra" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {error && <p className="error-text">{error}</p>}
                        
                        <button type="submit" className="primary-btn full-width mt-4" disabled={loading} style={{ background: '#10b981' }}>
                            {loading ? 'Verificando...' : 'Acceder al Panel'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <div className="admin-background">
                <div className="glow glow-2"></div>
            </div>
            
            <header className="admin-header">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={18} />
                    Inicio
                </button>
                <div>
                    <h1>Lista de <span style={{ color: '#10b981' }}>Eventos</span></h1>
                    <p>Visualización global del sistema.</p>
                </div>
                <div style={{ width: '100px' }}></div> {/* Spacer for flex balance */}
            </header>

            <div className="events-grid">
                {events.length === 0 ? (
                    <div className="empty-state glass-panel">
                        <CalendarDays size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
                        <h3>Aún no hay eventos</h3>
                        <p>No se ha detectado ningún evento en la base de datos.</p>
                        <button className="primary-btn mt-4" onClick={() => navigate('/create-event')}>Crear Evento</button>
                    </div>
                ) : (
                    events.map(event => (
                        <div key={event.id} className="event-item-card glass-panel" onClick={() => navigate(`/admin/events/${event.id}`, { state: { password }})}>
                            <div className="event-card-header">
                                <h3>{event.name}</h3>
                                <div className="event-badge">
                                    <KeyRound size={14} />
                                    <span>{event.access_code}</span>
                                </div>
                            </div>
                            
                            <div className="event-stats-row">
                                <div className="stat-col">
                                    <span className="stat-label">Salones</span>
                                    <span className="stat-value">{event.real_rooms_count}</span>
                                </div>
                                <div className="stat-col">
                                    <span className="stat-label">Llegadas Totales</span>
                                    <span className="stat-value highlight">{event.arrived_attendees || 0}</span>
                                </div>
                            </div>
                            
                            <div className="event-card-action">
                                <span>Ver detalle</span>
                                <ArrowRight size={16} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminEventsList;
