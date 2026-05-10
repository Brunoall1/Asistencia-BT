import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Check, X, ArrowLeft, Users, CheckSquare, Square, Calendar } from 'lucide-react';
import './PendingList.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PendingList = () => {
    const { eventId } = useParams();
    const [attendees, setAttendees] = useState([]);
    const [eventData, setEventData] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [sessions, setSessions] = useState([]); // 👉 1. NUEVO ESTADO PARA LOS NOMBRES DE LAS CHARLAS
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [processing, setProcessing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const eventRes = await axios.get(`${API_URL}/events/${eventId}`);
            if (eventRes.data.success) setEventData(eventRes.data.event);

            const roomsRes = await axios.get(`${API_URL}/events/${eventId}/rooms`);
            if (roomsRes.data.success) setRooms(roomsRes.data.rooms);

            // 👉 2. DESCARGAMOS LAS SESIONES PARA SABER LOS NOMBRES DE LAS CHARLAS
            try {
                const sessRes = await axios.get(`${API_URL}/events/${eventId}/sessions`);
                if (sessRes.data.success) setSessions(sessRes.data.sessions);
            } catch (e) { console.error('Error fetching sessions:', e); }

            const attRes = await axios.get(`${API_URL}/events/${eventId}/attendees?t=${Date.now()}`);
            if (attRes.data.success) {
                const pending = attRes.data.attendees.filter(a => a.status === 'pending');
                setAttendees(pending);
                setSelectedIds(new Set());
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventId) fetchData();
    }, [eventId]);

    // Acción para una sola fila (Aceptar/Rechazar charla individual)
    const handleAction = async (attendeeId, status) => {
        setProcessing(true);
        try {
            await axios.put(`${API_URL}/events/${eventId}/attendees/${attendeeId}/status`, { status });
            setAttendees(attendees.filter(a => a.id !== attendeeId));
        } catch (err) {
            console.error(`Error updating to ${status}:`, err);
            alert('Hubo un error al actualizar el estado.');
        } finally {
            setProcessing(false);
        }
    };

    // Acción Global por Usuario (Aceptar/Rechazar TODAS las charlas de una persona a la vez)
    const handleUserBulkAction = async (userRecordIds, status) => {
        setProcessing(true);
        try {
            await axios.put(`${API_URL}/events/${eventId}/attendees/bulk-status`, {
                status,
                eventId, // 👉 SOLUCIÓN: Añadimos el eventId para que el backend sí guarde en la BD
                attendeeIds: userRecordIds
            });

            // Filtramos localmente para quitar todas las filas de este usuario de la pantalla
            setAttendees(prevAttendees => prevAttendees.filter(a => !userRecordIds.includes(a.id)));

            // Limpiamos la selección por si el usuario tenía marcada alguna de estas charlas
            setSelectedIds(prevSelected => {
                const newSet = new Set(prevSelected);
                userRecordIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        } catch (err) {
            console.error(`Error bulk updating user to ${status}:`, err);
            alert('Hubo un error al procesar las solicitudes de este usuario.');
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkAction = async (status) => {
        if (selectedIds.size === 0) return;
        setProcessing(true);

        // Guardamos una copia estática de los IDs que vamos a procesar
        const idsToProcess = Array.from(selectedIds);

        try {
            await axios.put(`${API_URL}/events/${eventId}/attendees/bulk-status`, {
                status,
                eventId,
                attendeeIds: idsToProcess
            });

            // 👉 LA MAGIA: Filtramos localmente al instante para quitar solo las charlas que seleccionaste
            setAttendees(prevAttendees => prevAttendees.filter(a => !idsToProcess.includes(a.id)));

            // Limpiamos las casillas seleccionadas
            setSelectedIds(new Set());
        } catch (err) {
            console.error(`Error bulk updating to ${status}:`, err);
            alert('Hubo un error al actualizar los estados.');
        } finally {
            setProcessing(false);
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === attendees.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(attendees.map(a => a.id)));
    };

    // Función auxiliar para obtener el nombre de la charla
    const getSessionName = (sessionId) => {
        const s = sessions.find(sess => sess.id === sessionId);
        return s ? `${s.name} (${s.session_date || ''} ${s.start_time || ''})` : 'Charla General';
    };

    // 👉 3. EL MOTOR DE AGRUPACIÓN: Juntamos todas las filas pendientes por Correo Electrónico
    const groupedAttendees = attendees.reduce((acc, att) => {
        // Usamos el email como llave de grupo (si no tiene, usamos su QR o ID)
        const groupKey = att.email || att.qr_code || att.id;
        if (!acc[groupKey]) {
            acc[groupKey] = {
                first_name: att.first_name,
                last_name: att.last_name,
                email: att.email,
                ci: att.ci,
                payment_method: att.payment_method,
                records: [] // Aquí guardaremos todas sus filas individuales
            };
        }
        acc[groupKey].records.push(att);
        return acc;
    }, {});

    if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Cargando lista de pendientes...</div>;

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
                    <h1>Lista por Aceptar (Agrupada)</h1>
                    <p>Gestiona las solicitudes múltiples para el evento <strong className="gradient-text">{eventData?.name}</strong></p>
                </div>
            </header>

            <div className="list-content">
                {Object.keys(groupedAttendees).length === 0 ? (
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
                                <span>{selectedIds.size} charlas individuales seleccionadas</span>
                            </div>

                            {selectedIds.size > 0 && (
                                <div className="bulk-buttons">
                                    <button className="bulk-reject-btn" onClick={() => handleBulkAction('rejected')} disabled={processing}>
                                        Rechazar Seleccionados
                                    </button>
                                    <button className="bulk-accept-btn" onClick={() => handleBulkAction('accepted')} disabled={processing}>
                                        Aceptar Seleccionados
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 👉 4. RENDERIZAMOS UNA SOLA TARJETA PRINCIPAL POR USUARIO */}
                        <div className="cards-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '800px', margin: '0 auto' }}>
                            {Object.values(groupedAttendees).map((userGroup, idx) => {
                                // Obtenemos un arreglo con los IDs de todas las filas de este usuario
                                const allUserRecordIds = userGroup.records.map(r => r.id);

                                return (
                                    <div key={idx} className="pending-card user-group-card" style={{ display: 'block', padding: '1.5rem', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid #334155', borderRadius: '12px' }}>

                                        {/* Encabezado del Usuario */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                            <div>
                                                <h3 style={{ fontSize: '1.3rem', color: 'white', fontWeight: 'bold', margin: 0 }}>
                                                    👤 {userGroup.first_name} {userGroup.last_name}
                                                </h3>
                                                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.3rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                    <span><strong>C.I:</strong> {userGroup.ci || 'N/A'}</span>
                                                    <span><strong>Email:</strong> {userGroup.email || 'N/A'}</span>
                                                    <span><strong>Pago:</strong> <span style={{ color: '#10b981' }}>{userGroup.payment_method}</span></span>
                                                </div>
                                            </div>

                                            {/* 👉 BOTÓN MAESTRO: ACEPTAR TODAS SUS CHARLAS */}
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleUserBulkAction(allUserRecordIds, 'accepted')}
                                                    disabled={processing}
                                                    style={{
                                                        background: 'rgba(16, 185, 129, 0.2)',
                                                        color: '#10b981',
                                                        border: '1px solid #10b981',
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '6px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem'
                                                    }}
                                                    title="Aceptar todas las inscripciones de este usuario"
                                                >
                                                    <Check size={18} />
                                                    Aceptar Todo ({userGroup.records.length})
                                                </button>

                                                <button
                                                    onClick={() => handleUserBulkAction(allUserRecordIds, 'rejected')}
                                                    disabled={processing}
                                                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                                                    title="Rechazar todas"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* 👉 LISTA INTERNA DE SUS CHARLAS SOLICITADAS */}
                                        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '1px', marginBottom: '0.5rem' }}>
                                            Charlas solicitadas ({userGroup.records.length}):
                                        </h4>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {userGroup.records.map(record => {
                                                const roomObj = rooms.find(r => r.id === record.room_id);
                                                const roomName = roomObj ? `${roomObj.name} (${roomObj.conference_name})` : 'Sala General';
                                                const isSelected = selectedIds.has(record.id);

                                                return (
                                                    <div
                                                        key={record.id}
                                                        onClick={() => toggleSelection(record.id)}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '0.6rem 1rem',
                                                            background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0,0,0,0.3)',
                                                            border: isSelected ? '1px solid #3b82f6' : '1px solid #1e293b',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                            {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className="text-gray-600" />}
                                                            <div>
                                                                <strong style={{ color: '#e2e8f0', display: 'block', fontSize: '0.95rem' }}>
                                                                    🎟️ {getSessionName(record.session_id)}
                                                                </strong>
                                                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>📍 {roomName}</span>
                                                            </div>
                                                        </div>

                                                        {/* Acciones individuales por charla */}
                                                        <div style={{ display: 'flex', gap: '0.3rem' }} onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleAction(record.id, 'accepted')}
                                                                disabled={processing}
                                                                style={{ background: 'transparent', color: '#10b981', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                                                                title="Aceptar solo esta charla"
                                                            >
                                                                <Check size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleAction(record.id, 'rejected')}
                                                                disabled={processing}
                                                                style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                                                                title="Rechazar solo esta charla"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
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