import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Check, X, ArrowLeft, Users, CheckSquare, Square } from 'lucide-react';
import './PendingList.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PendingList = () => {
    const { eventId } = useParams();
    const [attendees, setAttendees] = useState([]);
    const [eventData, setEventData] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [processing, setProcessing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const eventRes = await axios.get(`${API_URL}/events/${eventId}`);
            if (eventRes.data.success) {
                setEventData(eventRes.data.event);
            }
            
            const roomsRes = await axios.get(`${API_URL}/events/${eventId}/rooms`);
            if (roomsRes.data.success) {
                setRooms(roomsRes.data.rooms);
            }
            // Fetch all and filter 'pending' locally for simplicity based on existing API, 
            // though in a very large DB a dedicated endpoint is better.
            const attRes = await axios.get(`${API_URL}/events/${eventId}/attendees`);
            if (attRes.data.success) {
                const pending = attRes.data.attendees.filter(a => a.status === 'pending');
                setAttendees(pending);
                setSelectedIds(new Set()); // Clear selection on refresh
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    const handleAction = async (attendeeId, status) => {
        setProcessing(true);
        try {
            await axios.put(`${API_URL}/events/${eventId}/attendees/${attendeeId}/status`, { status });
            // remove from list locally to feel snappy
            setAttendees(attendees.filter(a => a.id !== attendeeId));
        } catch (err) {
            console.error(`Error updating to ${status}:`, err);
            alert('Hubo un error al actualizar el estado.');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkAction = async (status) => {
        if (selectedIds.size === 0) return;
        setProcessing(true);
        try {
            await axios.put(`${API_URL}/events/${eventId}/attendees/bulk-status`, {
                status,
                attendeeIds: Array.from(selectedIds)
            });
            fetchData(); // refresh all
        } catch (err) {
            console.error(`Error bulk updating to ${status}:`, err);
            alert('Hubo un error al actualizar los estados.');
        } finally {
            setProcessing(false);
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === attendees.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(attendees.map(a => a.id)));
        }
    };

    if (loading) {
        return <div style={{ color: 'white', padding: '2rem' }}>Cargando lista de pendientes...</div>;
    }

    return (
        <div className="pending-list-container">
            <div className="background-mesh"></div>
            
            <header className="page-header">
                <div className="header-breadcrumbs">
                    <Link to={`/event/${eventId}`} className="back-link">
                        <ArrowLeft size={20} />
                        Volver al Panel
                    </Link>
                </div>
                <div className="header-title">
                    <h1>Lista por Aceptar</h1>
                    <p>Gestiona las personas que se auto-registraron para el evento <strong className="gradient-text">{eventData?.name}</strong></p>
                </div>
            </header>

            <div className="list-content">
                {attendees.length === 0 ? (
                    <div className="empty-state">
                        <Users size={48} className="empty-icon" />
                        <h3>No hay registros pendientes</h3>
                        <p>No se han encontrado nuevos registros en espera de aprobación.</p>
                    </div>
                ) : (
                    <>
                        <div className="bulk-actions-bar">
                            <div className="selection-info">
                                <button className="icon-btn" onClick={toggleAll} style={{ color: '#cbd5e1' }}>
                                    {selectedIds.size === attendees.length ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                                <span>{selectedIds.size} seleccionados de {attendees.length}</span>
                            </div>
                            
                            {selectedIds.size > 0 && (
                                <div className="bulk-buttons">
                                    <button 
                                        className="bulk-reject-btn" 
                                        onClick={() => handleBulkAction('rejected')}
                                        disabled={processing}
                                    >
                                        Rechazar Seleccionados
                                    </button>
                                    <button 
                                        className="bulk-accept-btn" 
                                        onClick={() => handleBulkAction('accepted')}
                                        disabled={processing}
                                    >
                                        Aceptar Seleccionados
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="cards-grid">
                            {attendees.map(att => {
                                const roomName = rooms.find(r => r.id === att.room_id)?.name || 'Sala Desconocida';
                                return (
                                <div key={att.id} className={`pending-card ${selectedIds.has(att.id) ? 'selected' : ''}`} onClick={() => toggleSelection(att.id)}>
                                    <div className="card-selector">
                                        {selectedIds.has(att.id) ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} className="text-gray-500" />}
                                    </div>
                                    <div className="card-details">
                                        <h4>{att.first_name} {att.last_name}</h4>
                                        <div className="card-meta">
                                            <span><strong>Sala:</strong> {roomName}</span>
                                            <span><strong>Email:</strong> {att.email || 'N/A'}</span>
                                            <span><strong>Pago:</strong> {att.payment_method}</span>
                                        </div>
                                    </div>
                                    <div className="card-actions" onClick={e => e.stopPropagation()}>
                                        <button 
                                            className="action-btn accept" 
                                            title="Aceptar"
                                            onClick={() => handleAction(att.id, 'accepted')}
                                            disabled={processing}
                                        >
                                            <Check size={20} />
                                        </button>
                                        <button 
                                            className="action-btn reject" 
                                            title="Rechazar"
                                            onClick={() => handleAction(att.id, 'rejected')}
                                            disabled={processing}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PendingList;
