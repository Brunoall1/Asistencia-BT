import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageSquare, Save, Trash2, ArrowLeft } from 'lucide-react';
import '../Dashboard.css'; 

const API_URL = import.meta.env.VITE_API_URL || '/api';

const EventMessageSettings = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [eventInfo, setEventInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messageDraft, setMessageDraft] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchEventData = async () => {
            try {
                const res = await axios.get(`${API_URL}/events/${eventId}`);
                if (res.data.success) {
                    setEventInfo(res.data.event);
                    if (res.data.event.custom_message) {
                        setMessageDraft(res.data.event.custom_message);
                    }
                }
            } catch (err) {
                console.error('Error fetching event data:', err);
                alert('No se pudo cargar la información del evento.');
            } finally {
                setLoading(false);
            }
        };

        fetchEventData();
    }, [eventId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await axios.put(`${API_URL}/events/${eventId}/message`, {
                custom_message: messageDraft
            });
            if (res.data.success) {
                alert('¡Mensaje actualizado exitosamente!');
                setEventInfo({ ...eventInfo, custom_message: messageDraft });
            }
        } catch (err) {
            alert('Error al guardar el mensaje.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Seguro que deseas borrar el mensaje personalizado y volver al de por defecto?')) return;
        
        setSaving(true);
        try {
            const res = await axios.put(`${API_URL}/events/${eventId}/message`, {
                custom_message: null
            });
            if (res.data.success) {
                alert('Mensaje vaciado. Se usará la plantilla por defecto.');
                setMessageDraft('');
                setEventInfo({ ...eventInfo, custom_message: null });
            }
        } catch (err) {
            alert('Error al borrar el mensaje.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="dashboard-container"><div className="loading-state">Cargando...</div></div>;

    return (
        <div className="dashboard-container fade-in">
            <header className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="gradient-text">Mensaje Personalizado</h1>
                    <p style={{ color: '#94a3b8' }}>Edita el mensaje que acompaña el código QR al enviar la invitación por WhatsApp o Correo.</p>
                </div>
            </header>

            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
                
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '1rem', borderRadius: '4px', marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageSquare size={18} /> Etiquetas Dinámicas Disponibles
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                        Usa <strong>{'{nombre}'}</strong> para el nombre del asistente, <strong>{'{sala}'}</strong> para la sala asignada, o <strong>{'{qr}'}</strong> para mostrar el enlace de la entrada. El sistema los reemplazará al enviar el mensaje.
                    </p>
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label style={{ fontSize: '1rem', marginBottom: '1rem', display: 'block' }}>Escribe tu nueva plantilla aquí:</label>
                    <textarea
                        placeholder="Ej. ¡Hola {nombre}! Recuerda presentar este código en la puerta de la sala {sala}. Enlace: {qr}"
                        rows="7"
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        style={{ 
                            width: '100%', 
                            padding: '1.2rem', 
                            borderRadius: '12px', 
                            border: '1px solid #334155', 
                            background: '#0f172a', 
                            color: 'white', 
                            resize: 'vertical',
                            fontSize: '1rem',
                            lineHeight: '1.5'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                    <button 
                        className="primary-btn" 
                        disabled={saving || !messageDraft}
                        onClick={handleSave}
                        style={{ flex: 2 }}
                    >
                        <Save size={18} />
                        {saving ? 'Guardando...' : 'Guardar Mensaje'}
                    </button>

                    <button 
                        className="primary-btn" 
                        disabled={saving || (!eventInfo?.custom_message && !messageDraft)}
                        onClick={handleDelete}
                        style={{ flex: 1, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
                    >
                        <Trash2 size={18} />
                        Vaciar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventMessageSettings;
