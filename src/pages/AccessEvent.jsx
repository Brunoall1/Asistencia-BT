import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ScanFace, ArrowRight, ArrowLeft } from 'lucide-react';
import './CreateEvent.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const AccessEvent = () => {
    const navigate = useNavigate();
    const [accessCode, setAccessCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAccess = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        try {
            const res = await axios.post(`${API_URL}/auth/access-event`, { accessCode: accessCode.toUpperCase() });
            if (res.data.success) {
                // Navigate to the event dashboard
                navigate(`/event/${res.data.event.id}`);
            }
        } catch (err) {
            setError('Código de acceso inválido. Por favor verifica e intenta de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="create-event-container">
            <button className="back-button glass-btn" onClick={() => navigate('/')}>
                <ArrowLeft size={18} />
                Volver
            </button>
            
            <div className="create-event-card glass-panel">
                <div className="step-content">
                    <div className="icon-wrapper circle-icon">
                        <ScanFace size={40} className="icon-blue" style={{color: '#c084fc'}} />
                    </div>
                    <h2>Acceder a Evento</h2>
                    <p>Ingresa el código que se te proporcionó para administrar la asistencia de este evento.</p>
                    
                    <form onSubmit={handleAccess} className="auth-form">
                        <div className="form-group" style={{textAlign: 'center'}}>
                            <input 
                                type="text" 
                                placeholder="X X X X X X" 
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                required
                                style={{
                                    fontSize: '2rem', 
                                    letterSpacing: '8px', 
                                    textAlign: 'center', 
                                    textTransform: 'uppercase',
                                    fontWeight: 'bold',
                                    padding: '1.5rem 1rem'
                                }}
                            />
                        </div>
                        {error && <p className="error-text" style={{textAlign: 'center'}}>{error}</p>}
                        
                        <button type="submit" className="primary-btn full-width mt-4" disabled={isLoading || accessCode.length < 6}>
                            {isLoading ? 'Verificando...' : 'Acceder'}
                            <ArrowRight size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AccessEvent;
