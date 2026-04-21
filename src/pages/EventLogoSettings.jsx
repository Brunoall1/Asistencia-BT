import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Image as ImageIcon, Upload, Trash2, ArrowLeft } from 'lucide-react';
import '../Dashboard.css'; // Reutilizar estilos del dashboard

const API_URL = import.meta.env.VITE_API_URL || '/api';

const EventLogoSettings = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [eventInfo, setEventInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [logoPreview, setLogoPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchEventData = async () => {
            try {
                const res = await axios.get(`${API_URL}/events/${eventId}`);
                if (res.data.success) {
                    setEventInfo(res.data.event);
                    if (res.data.event.logo) {
                        setLogoPreview(res.data.event.logo);
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await axios.put(`${API_URL}/events/${eventId}/logo`, {
                logo: logoPreview
            });
            if (res.data.success) {
                alert('¡Logo actualizado exitosamente!');
                setEventInfo({ ...eventInfo, logo: logoPreview });
            }
        } catch (err) {
            alert('Error al guardar el logo. Verifica el tamaño de la imagen.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Seguro que deseas eliminar el logo actual del evento?')) return;
        
        setSaving(true);
        try {
            const res = await axios.put(`${API_URL}/events/${eventId}/logo`, {
                logo: null
            });
            if (res.data.success) {
                alert('Logo eliminado exitosamente.');
                setLogoPreview(null);
                setEventInfo({ ...eventInfo, logo: null });
            }
        } catch (err) {
            alert('Error al eliminar el logo.');
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
                    <h1 className="gradient-text">Logo del Evento</h1>
                    <p style={{ color: '#94a3b8' }}>Gestiona el logotipo o imagen de portada que será enviado a los asistentes por correo.</p>
                </div>
            </header>

            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{ marginBottom: '2rem' }}>
                    {logoPreview ? (
                        <div style={{ 
                            background: '#0f172a', 
                            padding: '1rem', 
                            borderRadius: '12px', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            display: 'inline-block',
                            position: 'relative'
                        }}>
                            <img 
                                src={logoPreview} 
                                alt="Logo Preview" 
                                style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }} 
                            />
                        </div>
                    ) : (
                        <div style={{
                            background: '#0f172a',
                            padding: '3rem',
                            borderRadius: '12px',
                            border: '2px dashed rgba(255,255,255,0.2)',
                            color: '#94a3b8',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1rem'
                        }}>
                            <ImageIcon size={48} style={{ opacity: 0.5 }} />
                            <span>Ningún logo registrado aún.</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                    <div className="form-group" style={{ width: '100%', textAlign: 'left' }}>
                        <label style={{ marginBottom: '0.5rem', display: 'block' }}>Subir una nueva imagen (PNG, JPG)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ 
                                width: '100%',
                                padding: '0.75rem', 
                                border: '1px dashed rgba(255,255,255,0.3)', 
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
                        <button 
                            className="primary-btn full-width" 
                            disabled={saving || !logoPreview}
                            onClick={handleSave}
                        >
                            <Upload size={18} />
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>

                        <button 
                            className="primary-btn full-width" 
                            disabled={saving || (!eventInfo?.logo && !logoPreview)}
                            onClick={handleDelete}
                            style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}
                        >
                            <Trash2 size={18} />
                            Borrar Logo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventLogoSettings;
