import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { X, CheckCircle, XCircle } from 'lucide-react';
import './QRScannerModal.css'; // Let's style it

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const QRScannerModal = ({ eventId, onClose }) => {
    const [scanResult, setScanResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner("reader", {
            qrbox: { width: 250, height: 250 },
            fps: 5,
        });

        scanner.render(async (decodedText) => {
            // Success handler
            scanner.pause();
            try {
                const res = await axios.put(`${API_URL}/events/${eventId}/attendees/scan`, {
                    qr_code: decodedText
                });

                if (res.data.success) {
                    setScanResult(res.data);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Error procesando el código QR');
                setTimeout(() => {
                    setError(null);
                    scanner.resume();
                }, 3000);
            }
        }, (errorMessage) => {
            // Error handler - ignore for continuous scanning
        });

        return () => {
            scanner.clear().catch(error => {
                console.error("Failed to clear html5QrcodeScanner. ", error);
            });
        };
    }, [eventId]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container scanner-modal" onClick={e => e.stopPropagation()}>
                <button className="close-modal-btn" onClick={onClose}>
                    <X size={24} />
                </button>
                <h2>Escáner de Asistencia</h2>
                <p>Escanea el código QR del asistente para registrar su llegada y ver a qué salón debe dirigirse.</p>
                
                {!scanResult ? (
                    <div className="scanner-wrapper">
                        <div id="reader"></div>
                        {error && (
                            <div className="scan-error">
                                <XCircle size={20} />
                                {error}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="scan-success">
                        <CheckCircle size={64} className="success-icon-large" />
                        <h3>¡Llegada Registrada!</h3>
                        <div className="attendee-info-card">
                            <p><strong>Asistente:</strong> {scanResult.attendee.first_name} {scanResult.attendee.last_name}</p>
                            <p><strong>Hora de llegada:</strong> {scanResult.attendee.arrival_time}</p>
                            
                            <div className="room-direction">
                                <span>Dirigirse a:</span>
                                <h4>{scanResult.room.name}</h4>
                                <p>({scanResult.room.conference_name})</p>
                            </div>
                        </div>
                        <button 
                            className="primary-btn mt-4 full-width"
                            onClick={() => {
                                setScanResult(null);
                                // The scanner hook relies on remount to re-init properly in this simple implementation
                                // or we can force close
                                onClose();
                            }}
                        >
                            Escanear otro asistente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRScannerModal;
