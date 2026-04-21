import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Key, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import './CreateEvent.css'; // Will create this
import Flatpickr from 'react-flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import 'flatpickr/dist/themes/dark.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const CreateEvent = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Password, 2: Details, 3: Success
    const [masterPassword, setMasterPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [eventData, setEventData] = useState({
        name: '',
        expected_forum: '',
        rooms_count: '',
        dates: '',
        logo: '',
        custom_message: ''
    });

    const [createdEvent, setCreatedEvent] = useState(null);

    const verifyPassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setAuthError('');
        try {
            const res = await axios.post(`${API_URL}/auth/verify-master`, { password: masterPassword });
            if (res.data.success) {
                setStep(2);
            }
        } catch (err) {
            setAuthError('Clave incorrecta. Intentalo de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEventData({ ...eventData, logo: reader.result });
            };
            reader.readAsDataURL(file);
        } else {
            setEventData({ ...eventData, logo: '' });
        }
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await axios.post(`${API_URL}/events`, eventData);
            if (res.data.success) {
                setCreatedEvent(res.data.event);
                setStep(3);
            }
        } catch (err) {
            console.error('Error creating event:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="create-event-container">
            <button className="back-button glass-btn" onClick={() => step > 1 && step < 3 ? setStep(step - 1) : navigate('/')}>
                <ArrowLeft size={18} />
                Volver
            </button>

            <div className="create-event-card glass-panel">
                {step === 1 && (
                    <div className="step-content">
                        <div className="icon-wrapper circle-icon">
                            <Shield size={40} className="icon-blue" />
                        </div>
                        <h2>Autorización Requerida</h2>
                        <p>Ingresa la clave maestra para poder crear un nuevo evento.</p>

                        <form onSubmit={verifyPassword} className="auth-form">
                            <div className="input-group">
                                <Key size={20} className="input-icon" />
                                <input
                                    type="password"
                                    placeholder="Clave de administrador"
                                    value={masterPassword}
                                    onChange={(e) => setMasterPassword(e.target.value)}
                                    required
                                />
                            </div>
                            {authError && <p className="error-text">{authError}</p>}
                            <button type="submit" className="primary-btn full-width" disabled={isLoading}>
                                {isLoading ? 'Verificando...' : 'Verificar y Continuar'}
                                <ArrowRight size={18} />
                            </button>
                        </form>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content fade-in">
                        <h2>Detalles del Evento</h2>
                        <p>Completa la información básica para inicializar el evento.</p>

                        <form onSubmit={handleCreateEvent} className="event-form">
                            <div className="form-group">
                                <label>Nombre del Evento</label>
                                <input
                                    type="text"
                                    placeholder="Ej. Congreso de Tecnología 2026"
                                    value={eventData.name}
                                    onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Aforo Esperado</label>
                                    <input
                                        type="number"
                                        placeholder="Ej. 500"
                                        min="1"
                                        value={eventData.expected_forum}
                                        onChange={(e) => setEventData({ ...eventData, expected_forum: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Cantidad de Salones</label>
                                    <input
                                        type="number"
                                        placeholder="Ej. 5"
                                        min="1"
                                        value={eventData.rooms_count}
                                        onChange={(e) => setEventData({ ...eventData, rooms_count: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label>Día / Días del Evento</label>
                                <Flatpickr
                                    options={{
                                        mode: "range",
                                        locale: Spanish,
                                        dateFormat: "d/m/Y",
                                        showMonths: 2
                                    }}
                                    value={eventData.dates}
                                    onChange={(selectedDates, dateStr) => {
                                        setEventData({ ...eventData, dates: dateStr });
                                    }}
                                    placeholder="Selecciona 1 día o un rango de días..."
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label>Logo del Evento (Opcional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    style={{ padding: '0.6rem', border: '1px dashed rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.2)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label>Mensaje Personalizado (Opcional)</label>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 0.5rem 0' }}>
                                    Usa <strong>{'{nombre}'}</strong>, <strong>{'{sala}'}</strong> o <strong>{'{qr}'}</strong> para que el asistente reciba el mensaje adaptado a él.
                                </p>
                                <textarea
                                    placeholder="Ej. ¡Hola {nombre}! Recuerda presentar este código {qr} en la puerta de {sala}."
                                    rows="3"
                                    value={eventData.custom_message}
                                    onChange={(e) => setEventData({ ...eventData, custom_message: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', resize: 'vertical' }}
                                />
                            </div>

                            <button type="submit" className="primary-btn full-width mt-4" disabled={isLoading}>
                                {isLoading ? 'Creando...' : 'Crear Evento'}
                            </button>
                        </form>
                    </div>
                )}

                {step === 3 && createdEvent && (
                    <div className="step-content success-content fade-in">
                        <div className="icon-wrapper circle-icon success-icon">
                            <CheckCircle size={48} />
                        </div>
                        <h2>¡Evento Creado Exitosamente!</h2>
                        <p>Comparte este código con tu staff para que puedan acceder a la gestión de este evento.</p>

                        <div className="access-code-box">
                            <span className="code-label">CÓDIGO DE ACCESO</span>
                            <span className="code-value">{createdEvent.access_code}</span>
                        </div>

                        <button
                            className="primary-btn full-width"
                            onClick={() => navigate(`/event/${createdEvent.id}`)}
                        >
                            Ir al Panel del Evento
                            <ArrowRight size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateEvent;
