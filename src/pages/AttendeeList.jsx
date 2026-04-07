import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, UserPlus, Pencil, Trash2, Search, Mail, Clock, CreditCard, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './AttendeeList.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const AttendeeList = () => {
    // Note: The route is /event/:eventId/attendees/:courseId where courseId is the room ID. 
    // Wait, the router path is `/event/:eventId/attendees/:courseId`.
    const { eventId, courseId: roomId } = useParams();
    const navigate = useNavigate();

    const [attendees, setAttendees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [roomInfo, setRoomInfo] = useState(null);
    const [showingQR, setShowingQR] = useState(null);

    // Modal / Form state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        payment_method: 'Efectivo',
        room_id: roomId || ''
    });

    const fetchAttendees = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/events/${eventId}/attendees`);
            if (res.data.success) {
                // Filter by the specific room (cast to String to avoid strict equality issues between number/string)
                const roomAttendees = res.data.attendees.filter(att => String(att.room_id) === String(roomId));
                setAttendees(roomAttendees);
            }

            const roomsRes = await axios.get(`${API_URL}/events/${eventId}/rooms`);
            if (roomsRes.data.success) {
                const currentRoom = roomsRes.data.rooms.find(r => String(r.id) === String(roomId));
                setRoomInfo(currentRoom);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventId && roomId) {
            fetchAttendees();
        }
    }, [eventId, roomId]);

    const openModal = (attendee = null) => {
        if (attendee) {
            // Edit is not explicitly implemented in backend yet, but we can set form for future
            setEditingId(attendee.id);
            setFormData(attendee);
        } else {
            setEditingId(null);
            setFormData({
                first_name: '',
                last_name: '',
                email: '',
                payment_method: 'Efectivo',
                room_id: roomId
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                // UPDATE
                const res = await axios.put(`${API_URL}/events/${eventId}/attendees/${editingId}`, formData);
                if (res.data.success) {
                    fetchAttendees();
                }
            } else {
                // CREATE
                const res = await axios.post(`${API_URL}/events/${eventId}/attendees`, formData);
                if (res.data.success) {
                    fetchAttendees();
                }
            }
        } catch (err) {
            console.error('Error saving attendee:', err);
            alert('Error guardando los datos del asistente');
        }
        closeModal();
    };

    const handleCheckIn = async (id) => {
        try {
            const res = await axios.put(`${API_URL}/events/${eventId}/attendees/${id}/arrival`);
            if (res.data.success) {
                fetchAttendees();
            }
        } catch (err) {
            console.error('Error manual checkin:', err);
            alert('Error al marcar asistencia manualmente');
        }
    };

    const handleDelete = (id) => {
        // DELETE log: not included in backend request.
        if (window.confirm('La eliminación requiere una ruta DELETE en backend. ¿Omitir por ahora?')) {
            // Fake delete from UI
            setAttendees(attendees.filter(att => att.id !== id));
        }
    };

    const filteredAttendees = attendees.filter(att =>
        att.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        att.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (att.email && att.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="attendee-container">
            <div className="background-mesh-attendee"></div>

            <header className="attendee-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                    Volver
                </button>
                <div className="title-group">
                    <h1>Asistentes del Salón {roomInfo?.name ? `- ${roomInfo.name}` : ''}</h1>
                    <p className="course-badge">Salón ID: {roomId}</p>
                </div>
                <button className="primary-btn" onClick={() => openModal()}>
                    <UserPlus size={18} />
                    Nuevo Asistente
                </button>
            </header>

            <div className="toolbar">
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, apellido o correo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="stats" style={{ display: 'flex', gap: '2rem' }}>
                    <span>Llegadas: <strong style={{ color: '#10b981' }}>{attendees.filter(a => !!a.has_arrived).length} / {roomInfo ? roomInfo.expected_capacity : 0}</strong> aforo esperado</span>
                    <span>Total Registrados: <strong>{attendees.length}</strong></span>
                </div>
            </div>

            {loading ? (
                <div style={{ color: 'white', padding: '2rem' }}>Cargando asistentes...</div>
            ) : (
                <div className="table-wrapper">
                    <table className="attendee-table">
                        <thead>
                            <tr>
                                <th>Nombre Completo</th>
                                <th>Contacto</th>
                                <th>Llegada</th>
                                <th>Pago</th>
                                <th className="action-col">QR/Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAttendees.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-state">No se encontraron asistentes para este salón.</td>
                                </tr>
                            ) : (
                                filteredAttendees.map(att => (
                                    <tr key={att.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="avatar">{att.first_name.charAt(0)}{att.last_name.charAt(0)}</div>
                                                <div className="user-name">
                                                    <span className="first-name">{att.first_name}</span>
                                                    <span className="last-name">{att.last_name}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-cell">
                                                <Mail size={14} className="cell-icon" />
                                                {att.email || 'N/A'}
                                            </div>
                                        </td>
                                        <td>
                                            {att.has_arrived ? (
                                                <div className="time-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                                    <Clock size={14} />
                                                    {att.arrival_time}
                                                </div>
                                            ) : (
                                                <div className="time-badge">
                                                    -- : --
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className={`payment-badge payment-${att.payment_method?.toLowerCase() || 'efectivo'}`}>
                                                <CreditCard size={14} />
                                                {att.payment_method}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                {!att.has_arrived && (
                                                    <button className="edit-btn" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }} onClick={() => handleCheckIn(att.id)} title="Marcar Llegada Manual">
                                                        <Clock size={16} />
                                                    </button>
                                                )}
                                                <button className="edit-btn" onClick={() => setShowingQR(att)} title="Ver QR de acceso">
                                                    <QrCode size={16} />
                                                </button>
                                                <button className="delete-btn" onClick={() => handleDelete(att.id)} title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Editar Asistente' : 'Nuevo Asistente'}</h2>
                            <button className="close-btn" onClick={closeModal}>&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="crud-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Nombre</label>
                                    <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Apellido</label>
                                    <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Correo Electrónico</label>
                                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                            </div>
                            <div className="form-group">
                                <label>Método de Pago</label>
                                <select name="payment_method" value={formData.payment_method} onChange={handleInputChange}>
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Tarjeta">Tarjeta</option>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="Beca">Beca</option>
                                </select>
                            </div>
                            <div className="modal-actions mt-4">
                                <button type="button" className="cancel-btn" onClick={closeModal}>Cancelar</button>
                                <button type="submit" className="primary-btn" style={{ padding: '0.75rem 1.5rem' }}>
                                    {editingId ? 'Actualizar' : 'Guardar Participante'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QR Scanner Display Modal */}
            {showingQR && (
                <div className="modal-overlay" onClick={() => setShowingQR(null)}>
                    <div className="modal-content glass-panel" style={{ textAlign: 'center', padding: '3rem', maxWidth: '400px', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: 'white', marginBottom: '1.5rem', fontWeight: 'bold' }}>Pase de Acceso Único</h2>
                        
                        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1.5rem', border: '4px solid #3b82f6' }}>
                            <QRCodeSVG 
                                value={`${window.location.origin}/show/${showingQR.qr_code}`} 
                                size={200}
                                level={"Q"}
                            />
                        </div>
                        
                        <h3 style={{ color: '#cbd5e1', fontSize: '1.2rem', marginBottom: '0.5rem' }}>{showingQR.first_name} {showingQR.last_name}</h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Salón: {roomInfo?.name}</p>

                        <button 
                            style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.8rem 2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                            onClick={() => setShowingQR(null)}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendeeList;
