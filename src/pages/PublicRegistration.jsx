import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './PublicRegistration.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PublicRegistration = () => {
    const { eventId } = useParams();
    const [eventData, setEventData] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: 'No Aplica',
        payment_method: 'Efectivo',
        room_id: ''
    });
    
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        const fetchEventDetails = async () => {
            try {
                const eventRes = await axios.get(`${API_URL}/events/${eventId}`);
                if (eventRes.data.success) {
                    setEventData(eventRes.data.event);
                }
                const roomsRes = await axios.get(`${API_URL}/events/${eventId}/rooms`);
                if (roomsRes.data.success) {
                    setRooms(roomsRes.data.rooms);
                }
                try {
                    const compRes = await axios.get(`${API_URL}/events/${eventId}/companies`);
                    if (compRes.data && compRes.data.success) {
                        setCompanies(compRes.data.companies);
                    }
                } catch (e) {
                    // Ignorar si falla compañías
                }
            } catch (err) {
                console.error('Error fetching event details', err);
            } finally {
                setLoading(false);
            }
        };

        if (eventId) {
            fetchEventDetails();
        }
    }, [eventId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.room_id) {
            alert('Por favor selecciona una sala cede.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_URL}/public/events/${eventId}/register`, formData);
            if (res.data.success) {
                setSuccessMessage('¡Registro Exitoso! Tu solicitud ha sido enviada al administrador para su aprobación.');
                setFormData({ first_name: '', last_name: '', email: '', phone: '', company: 'No Aplica', payment_method: 'Efectivo', room_id: '' });
            }
        } catch (err) {
            console.error('Registration error', err);
            alert('Ocurrió un error al intentar registrarte. Intenta nuevamente.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="registration-container"><div className="loading-text">Cargando evento...</div></div>;
    }

    if (!eventData) {
        return <div className="registration-container"><div className="error-text">Evento no encontrado. Verifica el enlace.</div></div>;
    }

    if (successMessage) {
        return (
            <div className="registration-container">
                <div className="registration-card success-card">
                    <div className="success-icon">✅</div>
                    <h2>¡Gracias por Registrarte!</h2>
                    <p>{successMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="registration-container">
            <div className="background-mesh registration-bg"></div>
            
            <div className="registration-card">
                <div className="registration-header">
                    <h2>Registro para Evento</h2>
                    <h3 className="gradient-text">{eventData.name}</h3>
                </div>

                <form onSubmit={handleSubmit} className="registration-form">
                    <div className="form-group">
                        <label>Nombre</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="Ej. Juan"
                            value={formData.first_name}
                            onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        />
                    </div>

                    <div className="form-group">
                        <label>Apellido</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="Ej. Pérez"
                            value={formData.last_name}
                            onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        />
                    </div>

                    <div className="form-group">
                        <label>Correo Electrónico</label>
                        <input 
                            type="email" 
                            required 
                            placeholder="Ej. juan@correo.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Número de WhatsApp / Teléfono</label>
                        <input 
                            type="tel" 
                            required 
                            placeholder="Ej. +584141234567"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Empresa (Opcional)</label>
                        <input 
                            list="companyList"
                            name="company"
                            placeholder="Ej. Mi Empresa C.A."
                            value={formData.company}
                            onChange={(e) => setFormData({...formData, company: e.target.value})}
                            onFocus={(e) => {
                                if (e.target.value === 'No Aplica') {
                                    setFormData({...formData, company: ''});
                                }
                            }}
                        />
                        <datalist id="companyList">
                            <option value="No Aplica" />
                            {companies.map((comp, idx) => (
                                <option key={idx} value={comp} />
                            ))}
                        </datalist>
                    </div>

                    <div className="form-group">
                        <label>Sala a la que asistirás</label>
                        <select 
                            required
                            value={formData.room_id}
                            onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                        >
                            <option value="" disabled>Selecciona una sala...</option>
                            {rooms.map(r => (
                                <option key={r.id} value={r.id}>{r.name} - {r.conference_name}</option>
                            ))}
                        </select>
                    </div>

                    <button type="submit" className="submit-btn" disabled={submitting}>
                        {submitting ? 'Enviando...' : 'Completar Registro'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PublicRegistration;
