import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Key, Shield, ArrowLeft, ArrowRight, CalendarDays, KeyRound, Search } from 'lucide-react';
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
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const EVENTS_PER_PAGE = 6;

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset page on filter
    };

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
                        <Shield size={40} className="icon-blue" style={{ color: '#10b981' }} />
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

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '2rem', padding: '0 2rem' }}>
                <div className="input-group" style={{ maxWidth: '400px', width: '100%', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.2rem' }}>
                    {/* <Search size={20} className="input-icon" style={{ marginLeft: '1rem', color: '#bc2a98ff' }} /> */}
                    <input
                        list="eventSuggestions"
                        type="text"
                        placeholder="Buscar por nombre de evento..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        style={{ background: 'transparent', border: 'none', color: 'white', padding: '0.8rem', width: '100%', outline: 'none' }}
                    />
                    <datalist id="eventSuggestions">
                        {events.map(ev => (
                            <option key={ev.id} value={ev.name} />
                        ))}
                    </datalist>
                </div>
            </div>

            <div className="events-grid">
                {events.length === 0 ? (
                    <div className="empty-state glass-panel">
                        <CalendarDays size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
                        <h3>Aún no hay eventos</h3>
                        <p>No se ha detectado ningún evento en la base de datos.</p>
                        <button className="primary-btn mt-4" onClick={() => navigate('/create-event')}>Crear Evento</button>
                    </div>
                ) : (
                    (() => {
                        // Filter by search query
                        const filteredEvents = events.filter(e =>
                            e.name.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        // The backend already sorts by created_at DESC, so it is newest-first by default
                        const sortedEvents = [...filteredEvents];
                        const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
                        const paginatedEvents = sortedEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE);
                        const totalPages = Math.ceil(sortedEvents.length / EVENTS_PER_PAGE);

                        if (sortedEvents.length === 0) {
                            return (
                                <div className="empty-state glass-panel" style={{ gridColumn: '1 / -1' }}>
                                    <Search size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
                                    <h3>Sin resultados</h3>
                                    <p>No se encontraron eventos con la búsqueda "{searchQuery}".</p>
                                    <button className="primary-btn mt-4" onClick={() => setSearchQuery('')}>Limpiar Búsqueda</button>
                                </div>
                            );
                        }

                        return (
                            <>
                                {paginatedEvents.map(event => (
                                    <div key={event.id} className="event-item-card glass-panel" onClick={() => navigate(`/admin/events/${event.id}`, { state: { password } })}>
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
                                ))}

                                {totalPages > 1 && (
                                    <div className="pagination-controls" style={{
                                        display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center', width: '100%', gridColumn: '1 / -1', marginTop: '2rem'
                                    }}>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="primary-btn"
                                            style={{ margin: 0, padding: '0.5rem 1rem', background: currentPage === 1 ? '#334155' : 'rgba(59, 130, 246, 0.2)', color: currentPage === 1 ? '#64748b' : '#60a5fa', border: `1px solid ${currentPage === 1 ? 'transparent' : 'rgba(59, 130, 246, 0.4)'}`, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                                        >
                                            <ArrowLeft size={16} /> Anterior
                                        </button>
                                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                                            Página {currentPage} de {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="primary-btn"
                                            style={{ margin: 0, padding: '0.5rem 1rem', background: currentPage === totalPages ? '#334155' : 'rgba(59, 130, 246, 0.2)', color: currentPage === totalPages ? '#64748b' : '#60a5fa', border: `1px solid ${currentPage === totalPages ? 'transparent' : 'rgba(59, 130, 246, 0.4)'}`, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                                        >
                                            Siguiente <ArrowRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()
                )}
            </div>
        </div>
    );
};

export default AdminEventsList;
