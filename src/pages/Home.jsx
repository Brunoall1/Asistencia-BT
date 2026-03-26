import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, LogIn, CalendarDays } from 'lucide-react';
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
                    <button 
                        className="action-card create-card glass-panel"
                        onClick={() => navigate('/create-event')}
                    >
                        <div className="card-icon-wrapper">
                            <PlusCircle size={40} className="card-icon" />
                        </div>
                        <h3>Crear Evento</h3>
                        <p>Diseña un nuevo evento, asigna salones y genera un código de acceso único.</p>
                    </button>

                    <button 
                        className="action-card access-card glass-panel"
                        onClick={() => navigate('/access-event')}
                    >
                        <div className="card-icon-wrapper">
                            <LogIn size={40} className="card-icon" />
                        </div>
                        <h3>Acceder a Evento</h3>
                        <p>Ingresa el código de tu evento para gestionar asistentes y marcar asistencias con QR.</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Home;
