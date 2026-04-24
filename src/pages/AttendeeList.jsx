import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, UserPlus, Pencil, Trash2, Search, Mail, Clock, CreditCard, QrCode, FileSpreadsheet, Download, Upload, MessageCircle, Send, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import PrintBadges from '../components/PrintBadges';
import './AttendeeList.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const AttendeeList = () => {
    // Note: The route is /event/:eventId/attendees/:courseId where courseId is the room ID. 
    // Wait, the router path is `/event/:eventId/attendees/:courseId`.
    const { eventId, courseId: roomId } = useParams();
    const navigate = useNavigate();

    const [attendees, setAttendees] = useState([]);
    const [filteredAttendees, setFilteredAttendees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [roomInfo, setRoomInfo] = useState(null);
    const [eventInfo, setEventInfo] = useState(null);
    const [showingQR, setShowingQR] = useState(null);
    const [selectedPrintAttendees, setSelectedPrintAttendees] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [printStartingSlot, setPrintStartingSlot] = useState(0);

    const hiddenFileInput = useRef(null);

    // Modal / Form state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: 'No Aplica',
        payment_method: 'Efectivo',
        room_id: roomId || ''
    });

    const [sendingEmailId, setSendingEmailId] = useState(null);
    const [companies, setCompanies] = useState([]);

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

            const eventRes = await axios.get(`${API_URL}/events/${eventId}`);
            if (eventRes.data.success) {
                setEventInfo(eventRes.data.event);
            }

            try {
                const compRes = await axios.get(`${API_URL}/events/${eventId}/companies`);
                if (compRes.data && compRes.data.success) {
                    setCompanies(compRes.data.companies);
                }
            } catch (e) {
                console.error('Error fetching companies:', e);
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

    useEffect(() => {
        const filtered = attendees.filter(att =>
            att.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            att.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (att.email && att.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredAttendees(filtered);
    }, [searchTerm, attendees]);

    const handleExportExcel = () => {
        const dataToExport = filteredAttendees.map(att => ({
            'Nombre': att.first_name,
            'Apellido': att.last_name,
            'Correo': att.email || 'N/A',
            'WhatsApp': att.phone || 'N/A',
            'Empresa': att.company || 'No Aplica',
            'Método Pago': att.payment_method || 'Efectivo',
            'Hora Llegada': att.has_arrived ? att.arrival_time : 'Aún no llega',
            'URL Validar Asistencia (Seguridad)': `${window.location.origin}/show/${att.qr_code}`
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Asistentes");
        XLSX.writeFile(wb, `Asistentes_Salon_${roomInfo?.name || roomId}.xlsx`);
    };

    const handleImportExcelClick = () => {
        hiddenFileInput.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Map Excel Columns -> Supported arrays for SQLite Bulk loop
                const mappedAttendees = data.map(row => ({
                    first_name: row['Nombre'] || row['Nombres'] || row['First Name'] || '',
                    last_name: row['Apellido'] || row['Apellidos'] || row['Last Name'] || '',
                    email: row['Correo'] || row['Email'] || '',
                    phone: row['Teléfono'] || row['WhatsApp'] || row['Telefono'] || row['Phone'] || '',
                    company: row['Empresa'] || row['Compañia'] || row['Company'] || 'No Aplica',
                    payment_method: row['Pago'] || row['Método Pago'] || 'Efectivo'
                })).filter(att => att.first_name || att.last_name);

                if (mappedAttendees.length > 0) {
                    const res = await axios.post(`${API_URL}/events/${eventId}/rooms/${roomId}/attendees/bulk`, {
                        attendees: mappedAttendees
                    });
                    if (res.data.success) {
                        alert(`🎟️ ¡Importación exitosa! Se procesaron ${mappedAttendees.length} nuevos asistentes al Salón.`);
                        fetchAttendees();
                    }
                } else {
                    alert('No se encontraron registros válidos o las columnas no coinciden con las directrices esperadas ("Nombre", "Apellido", "Correo", "Pago").');
                }
            } catch (err) {
                console.error("Error importing excel:", err);
                alert("Ocurrió un crítico error al procesar el archivo XLS/CSV binario.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);

        // Reset unmounted payload references so repeat uploads work flawlessly
        e.target.value = null;
    };

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
                phone: '',
                company: 'No Aplica',
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

    const handleSendWA = (att) => {
        if (!att.phone) {
            alert('Este asistente no tiene un número registrado.');
            return;
        }
        const cleanPhone = att.phone.replace(/\\D/g, '');
        const eventName = roomInfo?.conference_name || 'nuestro evento';
        const roomName = roomInfo?.name || 'nuestra sala';
        const qrUrl = `${window.location.origin}/show/${att.qr_code}`;
        const qrImageUrl = `${window.location.origin}/api/public/qr/${att.qr_code}.png`;

        let message = '';
        if (eventInfo?.custom_message) {
            let userMsg = eventInfo.custom_message
                .replace(/{nombre}/g, `${att.first_name} ${att.last_name}`)
                .replace(/{sala}/g, roomName)
                .replace(/{qr}/g, qrUrl)
                .replace(/\\n/g, '%0A');

            message = `${userMsg} %0A%0AImagen de tu QR: ${qrImageUrl}`;
        } else {
            message = `Hola ${att.first_name} ${att.last_name}, te comparto tu qr de acceso al evento "${eventName}" que fuiste registrado en la sala "${roomName}". %0A%0ATu pase web: ${qrUrl} %0A%0AImagen de tu QR (Clic para abrir o descargar directo): ${qrImageUrl}`;
        }

        window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    };

    const toggleSelection = (att) => {
        if (selectedPrintAttendees.find(a => a.id === att.id)) {
            setSelectedPrintAttendees(selectedPrintAttendees.filter(a => a.id !== att.id));
        } else {
            if (selectedPrintAttendees.length >= 10) {
                alert('Puedes imprimir un máximo de 10 etiquetas a la vez por hoja.');
                return;
            }
            setSelectedPrintAttendees([...selectedPrintAttendees, att]);
        }
    };

    const handlePrintClick = () => {
        if (selectedPrintAttendees.length === 1) {
            setShowSlotModal(true);
        } else if (selectedPrintAttendees.length > 1) {
            setPrintStartingSlot(0);
            setIsPrinting(true);
        }
    };

    const handleSendEmail = async (att) => {
        if (!att.email) {
            alert('Este asistente no tiene correo electrónico registrado.');
            return;
        }
        setSendingEmailId(att.id);
        try {
            const res = await axios.post(`${API_URL}/events/${eventId}/attendees/${att.id}/send-email`);
            if (res.data.success) {
                alert('Correo enviado exitosamente.');
            }
        } catch (err) {
            console.error('Error enviando correo:', err);
            alert('en Desarrollo. PROXIMAMENTE');
        } finally {
            setSendingEmailId(null);
        }
    };

    const safeArrivedCount = attendees.filter(a => String(a.has_arrived) === "1" || a.has_arrived === true || String(a.has_arrived) === "true").length;
    const safeCapacity = roomInfo?.expected_capacity || 0;

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

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        ref={hiddenFileInput}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <button className="primary-btn" onClick={handleImportExcelClick} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }} title="Subir lista en Excel (.xlsx)">
                        <Upload size={18} />
                        Importar
                    </button>
                    <button className="primary-btn" onClick={handleExportExcel} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }} title="Descargar vista actual en Excel">
                        <Download size={18} />
                        Exportar
                    </button>
                    <button className="primary-btn" onClick={() => openModal()} style={{ background: '#3b82f6' }}>
                        <UserPlus size={18} />
                        Nuevo Asistente
                    </button>
                    {selectedPrintAttendees.length > 0 && (
                        <button className="primary-btn" onClick={handlePrintClick} style={{ background: '#8b5cf6' }}>
                            <Printer size={18} />
                            Imprimir Seleccionados ({selectedPrintAttendees.length})
                        </button>
                    )}
                </div>
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
                <div className="stats">
                    {/*  <pan>Llegadas: <strong style={{ color: '#10b981' }}>{safeArrivedCount} / {safeCapacity}</strong> aforo esperado</span--> */}
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
                                {/*} <th style={{ width: '30px', textAlign: 'center' }}>Sel.</th> */}
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
                                    <td colSpan="6" className="empty-state">No se encontraron asistentes para este salón.</td>
                                </tr>
                            ) : (
                                filteredAttendees.map(att => (
                                    <tr key={att.id} style={{ background: selectedPrintAttendees.find(a => a.id === att.id) ? 'rgba(139, 92, 246, 0.1)' : '' }}>
                                        {/*<td style={{textAlign: 'center'}}>
                                            <input 
                                                type="checkbox" 
                                                checked={!!selectedPrintAttendees.find(a => a.id === att.id)}
                                                onChange={() => toggleSelection(att)}
                                                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                            /> 
                                        </td>*/}
                                        <td>
                                            <div className="user-cell">
                                                <div className="avatar">{att.first_name.charAt(0)}{att.last_name.charAt(0)}</div>
                                                <div className="user-name">
                                                    <span className="first-name">{att.first_name} {att.last_name}</span>
                                                    {(att.company && att.company !== 'No Aplica') ? (
                                                        <span className="last-name" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{att.company}</span>
                                                    ) : (
                                                        <span className="last-name"></span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-cell">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Mail size={14} className="cell-icon" /> {att.email || 'N/A'}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#94a3b8' }}><MessageCircle size={14} className="cell-icon" /> {att.phone || 'N/A'}</div>
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
                                                <button className="edit-btn" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }} onClick={() => handleSendWA(att)} title="Enviar por WhatsApp">
                                                    <MessageCircle size={16} />
                                                </button>
                                                <button className="edit-btn" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', opacity: sendingEmailId === att.id ? 0.5 : 1 }} onClick={() => handleSendEmail(att)} disabled={sendingEmailId === att.id} title="Enviar por Correo (Adjuntará QR)">
                                                    <Send size={16} />
                                                </button>
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
                                <label>Teléfono / WhatsApp</label>
                                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Ej. +584141234567" />
                            </div>
                            <div className="form-group">
                                <label>Empresa (Opcional)</label>
                                <input
                                    list="companyListAdmin"
                                    name="company"
                                    value={formData.company}
                                    onChange={handleInputChange}
                                    placeholder="Ej. Mi Empresa C.A."
                                    onFocus={(e) => {
                                        if (e.target.value === 'No Aplica') setFormData({ ...formData, company: '' });
                                    }}
                                />
                                <datalist id="companyListAdmin">
                                    <option value="No Aplica" />
                                    {companies.map((comp, idx) => (
                                        <option key={idx} value={comp} />
                                    ))}
                                </datalist>
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
            {showSlotModal && (
                <div className="modal-overlay" onClick={() => setShowSlotModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', background: '#1e293b', borderRadius: '16px', padding: '2rem' }}>
                        <h2 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Seleccionar Posición</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            Como elegiste solo un asistente, indica en cuál de los 10 espacios de la hoja adhesiva quieres imprimir su gafete. Esto te permite ahorrar hojas que ya están parcialmente usadas.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {Array(10).fill(null).map((_, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        setPrintStartingSlot(idx);
                                        setShowSlotModal(false);
                                        setIsPrinting(true);
                                    }}
                                    style={{
                                        border: '1px dashed rgba(255,255,255,0.2)',
                                        padding: '1.5rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        background: 'rgba(0,0,0,0.2)',
                                        color: '#cbd5e1',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                >
                                    Espacio {idx + 1}
                                </div>
                            ))}
                        </div>
                        <button
                            className="btn-cancel"
                            style={{ width: '100%', marginTop: '1.5rem' }}
                            onClick={() => setShowSlotModal(false)}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {isPrinting && (
                <div className="print-badges-wrapper is-printing">
                    <PrintBadges
                        attendees={selectedPrintAttendees}
                        roomName={roomInfo?.name || 'General'}
                        startingSlot={printStartingSlot}
                        onFinish={() => {
                            setIsPrinting(false);
                            // Opcionalmente mantener la selección, pero la limpiaremos para conveniencia:
                            setSelectedPrintAttendees([]);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default AttendeeList;
