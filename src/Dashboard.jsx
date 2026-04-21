import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, BookOpen, MapPin, Plus, X, ScanLine, ArrowLeft, Link as LinkIcon, ListChecks } from 'lucide-react';
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
    const [qrPrefill, setQrPrefill] = useState(null);
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);
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
                const rawAttendees = attendeesRes.data.success ? attendeesRes.data.attendees : [];
                // ONLY count accepted attendees for Dashboard charts and metrics
                const allAttendees = rawAttendees.filter(a => a.status === 'accepted' || !a.status);

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

    const handleQRScanned = async (decodedText) => {
        setShowQRModal(false); // Close scanner immediately
        
        let textToParse = decodedText;
        
        // Fast-path for internal platform generated QR codes
        if (decodedText.includes('/show/')) {
            try {
                const hashMatch = decodedText.match(/\/show\/([a-zA-Z0-9]+)/);
                if (hashMatch && hashMatch[1]) {
                    const qrHash = hashMatch[1];
                    const checkRes = await axios.put(`${API_URL}/public/attendee/${qrHash}/arrival`);
                    if (checkRes.data.success) {
                        alert(`🎟️ ¡Asistencia Marcada Exitosamente para ${checkRes.data.attendee.first_name} ${checkRes.data.attendee.last_name}!`);
                        fetchData();
                        return; // Stop the flow here, check-in done seamlessly
                    }
                }
            } catch (err) {
                alert('Hubo un error verificando el código interno. Podría ser un invitado no registrado.');
                return;
            }
        }

        // Check if QR is an external ticket URL needing Web Scraping
        if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
            setIsFetchingUrl(true);
            try {
                const scrapeRes = await axios.post(`${API_URL}/utils/scrape`, { url: decodedText });
                if (scrapeRes.data.success) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(scrapeRes.data.html, 'text/html');
                    // Extract text but retain some inner spacing
                    textToParse = doc.body.innerText || decodedText;
                }
            } catch (err) {
                console.error("Error scraping QR link:", err);
            }
            setIsFetchingUrl(false);
        }
        
        let roomId = '';
        let firstName = '';
        let lastName = '';
        
        // Advanced Custom Regex based on typical ticket platforms like BrandingTicket
        // Pattern: "Nombre: [Rest of the line]"
        const nombreMatch = textToParse.match(/Nombre:\s*([^\n\r]+)/i);
        if (nombreMatch) {
            const rawName = nombreMatch[1].trim();
            // Split name nicely: "Blanca Dubuc de Quintana" -> Blanca (First), Dubuc de Quintana (Last)
            const parts = rawName.split(/\s+/).filter(Boolean);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        } else {
            // Fallback generic parse logic
            let genericName = textToParse.replace(/nombre:|name:|sala:|room:|-|,|;/ig, ' ').trim();
            const sortedRooms = [...rooms].sort((a,b) => b.name.length - a.name.length);
            for (const r of sortedRooms) {
                if (genericName.toLowerCase().includes(r.name.toLowerCase())) {
                    genericName = genericName.replace(new RegExp(r.name, 'ig'), '').trim();
                }
            }
            const parts = genericName.split(/\s+/).filter(Boolean);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }
        
        // Pattern for Rooms: Try to match from the parsed text text
        const sortedRooms = [...rooms].sort((a,b) => b.name.length - a.name.length);
        for (const r of sortedRooms) {
            if (textToParse.toLowerCase().includes(r.name.toLowerCase())) {
                roomId = r.id;
                break;
            }
        }
        
        setQrPrefill({
            first_name: firstName,
            last_name: lastName,
            email: '',
            payment_method: 'Efectivo',
            room_id: roomId
        });
    };

    const handleSaveQRAttendee = async (e) => {
        e.preventDefault();
        try {
            if (!qrPrefill.room_id) {
                alert('Por favor selecciona una sala para este asistente.');
                return;
            }
            // Create attendee
            const res = await axios.post(`${API_URL}/events/${eventId}/attendees`, qrPrefill);
            if (res.data.success) {
                const newId = res.data.attendee.id;
                // Automatically mark as arrived
                await axios.put(`${API_URL}/events/${eventId}/attendees/${newId}/arrival`);
                
                setQrPrefill(null);
                fetchData(); // Refresh metrics
            }
        } catch (err) {
            console.error('Error adding from QR:', err);
            alert('Hubo un error al guardar el asistente.');
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
                <div className="header-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', marginTop: '15px' }}>
                    <button
                        className="glass-btn"
                        style={{ padding: '0.6rem 1.2rem' }}
                        onClick={() => {
                            const registerUrl = `${window.location.origin}/register/${eventId}`;
                            navigator.clipboard.writeText(registerUrl)
                                .then(() => alert('¡Enlace de registro copiado al portapapeles!'))
                                .catch(err => console.error('Error al copiar el enlace:', err));
                        }}
                    >
                        <LinkIcon size={20} />
                        Registro
                    </button>
                    <button
                        className="glass-btn"
                        style={{ padding: '0.6rem 1.2rem', borderColor: '#fbbf24', color: '#fbbf24' }}
                        onClick={() => navigate(`/event/${eventId}/pending`)}
                    >
                        <ListChecks size={20} />
                        Lista por Aceptar
                    </button>
                    <button
                        className="add-room-btn glass-btn"
                        style={{ padding: '0.6rem 1.2rem' }}
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={20} />
                        Agregar Sala
                    </button>
                    <button
                        className="primary-btn"
                        style={{ padding: '0.6rem 1.2rem' }}
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
                    onScanSuccess={handleQRScanned}
                />
            )}

            {isFetchingUrl && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ background: '#1e293b', padding: '3rem', borderRadius: '16px', textAlign: 'center', maxWidth: '400px' }}>
                        <h2 className="gradient-text" style={{ margin: 0, marginBottom: '1rem' }}>Extrayendo Información...</h2>
                        <p style={{ color: '#94a3b8' }}>Descargando perfil del asistente desde el código QR. Por favor espera.</p>
                    </div>
                </div>
            )}

            {qrPrefill && (
                <div className="modal-overlay" onClick={() => setQrPrefill(null)}>
                    <div className="modal-content" style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Nuevo Asistente (QR)</h2>
                            <button className="close-btn" onClick={() => setQrPrefill(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveQRAttendee} className="crud-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Nombre</label>
                                    <input type="text" value={qrPrefill.first_name} onChange={e => setQrPrefill({...qrPrefill, first_name: e.target.value})} required style={{ padding: '0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}/>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Apellido</label>
                                    <input type="text" value={qrPrefill.last_name} onChange={e => setQrPrefill({...qrPrefill, last_name: e.target.value})} required style={{ padding: '0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}/>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Sala Destino</label>
                                <select value={qrPrefill.room_id} onChange={e => setQrPrefill({...qrPrefill, room_id: e.target.value})} required style={{ padding: '0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                                    <option value="">Seleccionar Sala...</option>
                                    {rooms.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Correo Electrónico (Opcional)</label>
                                <input type="email" value={qrPrefill.email} onChange={e => setQrPrefill({...qrPrefill, email: e.target.value})} style={{ padding: '0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}/>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Método de Pago</label>
                                <select value={qrPrefill.payment_method} onChange={e => setQrPrefill({...qrPrefill, payment_method: e.target.value})} style={{ padding: '0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Tarjeta">Tarjeta</option>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="Beca">Beca</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => setQrPrefill(null)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                                <button type="submit" style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar e Ingresar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
