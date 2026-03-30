import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, LogIn, CalendarDays, List, KeyRound, X, CheckCircle } from 'lucide-react';
import axios from 'axios';
import './Home.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const Home = () => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [pwdData, setPwdData] = useState({ current: '', new: '' });
    const [status, setStatus] = useState({ loading: false, error: '', success: false });

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setStatus({ loading: true, error: '', success: false });
        
        try {
            const res = await axios.put(`${API_URL}/auth/update-password`, {
                currentPassword: pwdData.current,
                newPassword: pwdData.new
            });
            
            if (res.data.success) {
                setStatus({ loading: false, error: '', success: true });
                setPwdData({ current: '', new: '' });
                setTimeout(() => {
                    setShowModal(false);
                    setStatus({ loading: false, error: '', success: false });
                }, 2000);
            }
        } catch (err) {
            setStatus({ 
                loading: false, 
                error: err.response?.data?.message || 'Error al actualizar contraseña', 
                success: false 
            });
        }
    };

    return (
        <div className="home-container">
            <div className="home-background">
                <div className="glow glow-1"></div>
                <div className="glow glow-2"></div>
                <div className="glow glow-3"></div>
            </div>
            
            <div className="home-content">
                <div className="home-header">
                    <div className="logo-container">
                        <CalendarDays size={48} className="logo-icon" />
                    </div>
                    <h1 className="home-title">Gestión de <span className="gradient-text">Eventos</span></h1>
                    <p className="home-subtitle">
                        La plataforma definitiva para administrar tus foros, conferencias y asistencia en tiempo real.
                    </p>
                </div>

                <div className="home-actions">
                    <button className="action-card create-card glass-panel" onClick={() => navigate('/create-event')}>
                        <div className="card-icon-wrapper">
                            <PlusCircle size={40} className="card-icon" />
                        </div>
                        <h3>Crear Evento</h3>
                        <p>Diseña un nuevo evento, asigna salones y genera un código de acceso único.</p>
                    </button>

                    <button className="action-card access-card glass-panel" onClick={() => navigate('/access-event')}>
                        <div className="card-icon-wrapper">
                            <LogIn size={40} className="card-icon" />
                        </div>
                        <h3>Acceder a Evento</h3>
                        <p>Ingresa el código de tu evento para gestionar asistentes y marcar asistencias con QR.</p>
                    </button>

                    <button className="action-card list-card glass-panel" onClick={() => navigate('/admin/events')}>
                        <div className="card-icon-wrapper">
                            <List size={40} className="card-icon" />
                        </div>
                        <h3>Lista de Eventos</h3>
                        <p>Dashboard de administrador. Visualiza todos los eventos y sus estadísticas globales.</p>
                    </button>

                    <button className="action-card pwd-card glass-panel" onClick={() => setShowModal(true)}>
                        <div className="card-icon-wrapper">
                            <KeyRound size={40} className="card-icon" />
                        </div>
                        <h3>Actualizar Clave</h3>
                        <p>Cambia la contraseña maestra de administrador utilizada para crear eventos.</p>
                    </button>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="pwd-modal-container">
                        <button className="close-modal-btn" onClick={() => setShowModal(false)}>
                            <X size={24} />
                        </button>
                        
                        {status.success ? (
                            <div className="success-content fade-in" style={{ textAlign: 'center', padding: '2rem' }}>
                                <CheckCircle size={64} className="icon-green hover-scale" style={{ color: '#10b981', marginBottom: '1rem', margin: '0 auto' }} />
                                <h2 style={{ color: '#f8fafc', marginBottom: '1rem' }}>¡Clave Actualizada!</h2>
                                <p style={{ color: '#94a3b8' }}>La contraseña maestra ha sido cambiada de manera segura.</p>
                            </div>
                        ) : (
                            <>
                                <h2>Actualizar Contraseña</h2>
                                <p style={{ color: '#94a3b8', marginBottom: '1.5rem', textAlign: 'center' }}>Ingresa la contraseña maestra actual para establecer una nueva.</p>
                                
                                <form onSubmit={handlePasswordUpdate} className="add-room-form">
                                    <div className="form-group">
                                        <label>Contraseña Actual</label>
                                        <input 
                                            type="password" 
                                            required 
                                            value={pwdData.current}
                                            onChange={(e) => setPwdData({...pwdData, current: e.target.value})}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Nueva Contraseña</label>
                                        <input 
                                            type="password" 
                                            required 
                                            value={pwdData.new}
                                            onChange={(e) => setPwdData({...pwdData, new: e.target.value})}
                                        />
                                    </div>
                                    
                                    {status.error && <p className="error-text" style={{ color: '#ef4444', textAlign: 'center', margin: '0.5rem 0' }}>{status.error}</p>}
                                    
                                    <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#cbd5e1' }}>Cancelar</button>
                                        <button type="submit" className="btn-submit" disabled={status.loading} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', background: '#3b82f6', border: 'none', color: '#fff' }}>
                                            {status.loading ? 'Actualizando...' : 'Actualizar Clave'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
