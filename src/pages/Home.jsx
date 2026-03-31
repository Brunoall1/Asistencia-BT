import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn, CalendarDays } from 'lucide-react';
import './Home.css';

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="home-container">
            <div className="home-background">
                <div className="glow glow-1"></div>
                <div className="glow glow-2"></div>
                <div className="glow glow-3"></div>
            </div>
            
            <div className="home-content" style={{ marginTop: '2rem' }}>
                <div className="home-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <img src="/logo.png" alt="Brandketing Logo" className="home-brand-logo" />
                        <div className="logo-container" style={{ margin: 0 }}>
                            <CalendarDays size={48} className="logo-icon" />
                        </div>
                    </div>
                    <h1 className="home-title">Portal de <span className="gradient-text">Eventos</span></h1>
                    <p className="home-subtitle">
                        Selecciona tu perfil de acceso para continuar.
                    </p>
                </div>

                <div className="home-actions" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="action-card create-card glass-panel" 
                            style={{ flex: '1 1 320px', maxWidth: '380px' }} 
                            onClick={() => navigate('/admin')}>
                        <div className="card-icon-wrapper">
                            <ShieldAlert size={40} className="card-icon" />
                        </div>
                        <h3>Administrador</h3>
                        <p>Gestión global de la plataforma, creación de eventos y configuración maestra.</p>
                    </button>

                    <button className="action-card access-card glass-panel" 
                            style={{ flex: '1 1 320px', maxWidth: '380px' }} 
                            onClick={() => navigate('/access-event')}>
                        <div className="card-icon-wrapper">
                            <LogIn size={40} className="card-icon" />
                        </div>
                        <h3>Acceder a Evento</h3>
                        <p>Portal para el personal y control de asistencia por medio de código QR.</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Home;
