import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { X, CheckCircle, XCircle, Camera, RefreshCcw } from 'lucide-react';
import './QRScannerModal.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const QRScannerModal = ({ eventId, onClose, onScanSuccess }) => {
    const [scanResult, setScanResult] = useState(null);
    const [error, setError] = useState(null);
    const [cameras, setCameras] = useState([]);
    const [activeCameraId, setActiveCameraId] = useState(null);
    
    // We use a ref to hold the scanner instance so it survives re-renders
    const scannerRef = useRef(null);

    useEffect(() => {
        // Initialize scanner
        scannerRef.current = new Html5Qrcode("reader");

        // Request cameras
        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length) {
                setCameras(devices);
                // Try to find the back camera by default
                const backCam = devices.find(d => 
                    d.label.toLowerCase().includes('back') || 
                    d.label.toLowerCase().includes('environment') || 
                    d.label.toLowerCase().includes('trasera')
                );
                setActiveCameraId(backCam ? backCam.id : devices[0].id);
            }
        }).catch(err => {
            console.error("Camera permissions failed", err);
            setError("No se detectaron cámaras o faltan permisos.");
        });

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, []);

    useEffect(() => {
        if (activeCameraId && scannerRef.current) {
            const startScanning = () => {
                scannerRef.current.start(
                    activeCameraId,
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText) => {
                        handleScan(decodedText);
                    },
                    (errorMessage) => {
                        // ignore continous errors
                    }
                ).catch(err => {
                    console.error("Error starting camera", err);
                    setError("Error al iniciar cámara.");
                });
            };

            if (scannerRef.current.isScanning) {
                scannerRef.current.stop()
                    .then(() => startScanning())
                    .catch(console.error);
            } else {
                startScanning();
            }
        }
    }, [activeCameraId]);

    const handleScan = async (decodedText) => {
        // Stop scanning to prevent multiple hits
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.pause(true); // Pause if supported, or we just rely on state
        }

        if (onScanSuccess) {
            onScanSuccess(decodedText);
            return;
        }

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
                if (scannerRef.current) scannerRef.current.resume();
            }, 3000);
        }
    };

    const switchCamera = () => {
        if (cameras.length > 1) {
            const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
            const nextIndex = (currentIndex + 1) % cameras.length;
            setActiveCameraId(cameras[nextIndex].id);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container scanner-modal" onClick={e => e.stopPropagation()}>
                <button className="close-modal-btn" onClick={onClose}>
                    <X size={24} />
                </button>
                <h2>Escáner de Asistencia</h2>
                <p>Apunta el código QR con la cámara de tu dispositivo.</p>

                {!scanResult ? (
                    <div className="scanner-wrapper">
                        {cameras.length > 1 && (
                            <button className="switch-camera-btn" onClick={switchCamera}>
                                <RefreshCcw size={18} />
                                Cambiar Cámara
                            </button>
                        )}
                        <div id="reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>
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
