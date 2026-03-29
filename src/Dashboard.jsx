import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, BookOpen, MapPin, Plus, X, ScanLine, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';
import QRScannerModal from './components/QRScannerModal';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="custom-tooltip">
                <p className="tooltip-title">{data.name}</p>
                <p className="tooltip-value">
                    <Users size={14} className="tooltip-icon" />
                    {data.value} Asistentes
                </p>
            </div>
        );
    }
    return null;
};

const Dashboard = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [eventData, setEventData] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [showAccessCode, setShowAccessCode] = useState(false);
    const [newRoomData, setNewRoomData] = useState({ name: '', conference: '', expected_capacity: '' });
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const eventRes = await axios.get(`${API_URL}/events/${eventId}`);
            if (eventRes.data.success) {
                setEventData(eventRes.data.event);
            }

            const roomsRes = await axios.get(`${API_URL}/events/${eventId}/rooms`);
            const attendeesRes = await axios.get(`${API_URL}/events/${eventId}/attendees`);

            if (roomsRes.data.success) {
                const fetchedRooms = roomsRes.data.rooms;
                const allAttendees = attendeesRes.data.success ? attendeesRes.data.attendees : [];

                const formattedRooms = fetchedRooms.map(r => {
                    const roomAttendees = allAttendees.filter(a => a.room_id === r.id);
                    const arrivedCount = roomAttendees.filter(a => a.has_arrived).length;
                    const registeredCount = roomAttendees.length;

                    const notArrivedCount = registeredCount - arrivedCount;
                    const availableCapacity = Math.max(0, r.expected_capacity - registeredCount);

                    // Chart data representing attendance funnel
                    const pieData = [];
                    if (arrivedCount > 0) pieData.push({ name: 'Llegaron', value: arrivedCount, color: '#10b981' });
                    if (notArrivedCount > 0) pieData.push({ name: 'Por llegar', value: notArrivedCount, color: '#f59e0b' });
                    if (availableCapacity > 0) pieData.push({ name: 'Disponibles', value: availableCapacity, color: '#3b82f6' });

                    // Fallback to empty chart if no expecting attendees
                    if (pieData.length === 0) pieData.push({ name: 'Vacío', value: 1, color: '#334155' });

                    return {
                        id: r.id,
                        name: r.name,
                        expected_capacity: r.expected_capacity,
                        arrived_count: arrivedCount,
                        data: pieData
                    };
                });
                setRooms(formattedRooms);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            // If the event doesn't exist (e.g., database was reset), redirect to Home
            if (err.response && err.response.status === 404) {
                alert('El evento ya no existe o fue eliminado.');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    const handleSliceClick = (data, roomIndex) => {
        const room = rooms[roomIndex];
        navigate(`/event/${eventId}/attendees/${room.id}`);
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        if (!newRoomData.name || !newRoomData.conference) return;

        try {
            const res = await axios.post(`${API_URL}/events/${eventId}/rooms`, {
                name: newRoomData.name,
                conference_name: newRoomData.conference,
                expected_capacity: parseInt(newRoomData.expected_capacity, 10) || 0
            });

            if (res.data.success) {
                setShowAddModal(false);
                setNewRoomData({ name: '', conference: '', expected_capacity: '' });
                fetchData(); // Refresh list
            }
        } catch (err) {
            console.error('Error adding room:', err);
        }
    };

    if (loading) {
        return <div style={{ color: 'white', padding: '2rem' }}>Cargando panel...</div>;
    }

    return (
        <div className="dashboard-container">
            {/* Background Effects */}
            <div className="background-mesh"></div>
            <div className="glow-orb orb-1"></div>
            <div className="glow-orb orb-2"></div>

            <header className="dashboard-header">
                <div className="header-content">
                    <h1>
                        <span className="gradient-text">{eventData?.name || 'Métricas de Evento'}</span>
                    </h1>
                    <p className="subtitle">
                        <BookOpen size={18} />
                        Análisis de distribución y control de asistencia
                    </p>
                    <div className="access-badge" onClick={() => setShowAccessCode(!showAccessCode)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                        <span style={{ color: '#94a3b8' }}>Código de Evento:</span>
                        <strong style={{ letterSpacing: '2px', color: 'white' }}>{showAccessCode ? eventData?.access_code : '••••••••'}</strong>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="add-room-btn glass-btn"
                        style={{ padding: '0.6rem 1.2rem', margin: 10 }}
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={20} />
                        Agregar Sala
                    </button>
                    <button
                        className="primary-btn"
                        style={{ padding: '0.6rem 1.2rem', margin: 0 }}
                        onClick={() => setShowQRModal(true)}
                    >
                        <ScanLine size={20} />
                        Escanear QR Asistencia
                    </button>
                </div>
            </header>

            <div className="charts-grid">
                {rooms.length === 0 ? (
                    <div style={{ color: 'white', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', gridColumn: '1/-1', textAlign: 'center' }}>
                        Aún no hay salones creados. Haz clic en "Agregar Sala" para comenzar.
                    </div>
                ) : rooms.map((room, roomIndex) => {

                    return (
                        <div key={room.id} className="chart-card">
                            <div className="card-header">
                                <div className="room-info">
                                    <MapPin size={20} className="room-icon" />
                                    <h2>{room.name}</h2>
                                </div>
                                <div className="total-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    <span>Llegadas: {room.arrived_count} / {room.expected_capacity}</span>
                                </div>
                            </div>

                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={room.data}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                            onClick={(data) => handleSliceClick(data, roomIndex)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {room.data.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                    className="pie-slice"
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            iconType="circle"
                                            formatter={(value) => <span className="legend-text">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setShowAddModal(false)}>
                            <X size={24} />
                        </button>
                        <h2>Agregar Nueva Sala</h2>
                        <form onSubmit={handleAddRoom} className="add-room-form">
                            <div className="form-group">
                                <label htmlFor="roomName">Nombre de la Sala</label>
                                <input
                                    id="roomName"
                                    type="text"
                                    placeholder="Ej. Salón Alpha"
                                    value={newRoomData.name}
                                    onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="conferenceName">Nombre de la Conferencia</label>
                                <input
                                    id="conferenceName"
                                    type="text"
                                    placeholder="Ej. Introducción a React"
                                    value={newRoomData.conference}
                                    onChange={(e) => setNewRoomData({ ...newRoomData, conference: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="expectedCapacity">Aforo Esperado</label>
                                <input
                                    id="expectedCapacity"
                                    type="number"
                                    placeholder="Ej. 50"
                                    min="1"
                                    value={newRoomData.expected_capacity}
                                    onChange={(e) => setNewRoomData({ ...newRoomData, expected_capacity: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-submit">
                                    Guardar Sala
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showQRModal && (
                <QRScannerModal
                    eventId={eventId}
                    onClose={() => setShowQRModal(false)}
                />
            )}
        </div>
    );
};

export default Dashboard;
