import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Clock, User, Plus, X } from 'lucide-react';
import './Schedule.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const Schedule = () => {
    const { eventId } = useParams();
    const [rooms, setRooms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [eventInfo, setEventInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        room_id: '',
        name: '',
        speaker: '',
        start_time: '',
        end_time: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [eventRes, roomsRes, sessionsRes] = await Promise.all([
                axios.get(`${API_URL}/events/${eventId}`),
                axios.get(`${API_URL}/events/${eventId}/rooms`),
                axios.get(`${API_URL}/events/${eventId}/sessions`)
            ]);

            if (eventRes.data.success) {
                setEventInfo(eventRes.data.event);
            }
            if (roomsRes.data.success) {
                setRooms(roomsRes.data.rooms);
            }
            if (sessionsRes.data.success) {
                setSessions(sessionsRes.data.sessions);
            }
        } catch (err) {
            console.error('Error fetching schedule data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/events/${eventId}/rooms/${formData.room_id}/sessions`, formData);
            if (res.data.success) {
                fetchData();
                setIsModalOpen(false);
                setFormData({
                    room_id: '',
                    name: '',
                    speaker: '',
                    start_time: '',
                    end_time: ''
                });
            }
        } catch (err) {
            console.error('Error creating session:', err);
            alert('Error guardando la sesión');
        }
    };

    // Group sessions by room
    const scheduleByRoom = rooms.map(room => {
        const roomSessions = sessions.filter(s => s.room_id === room.id);
        // Sort sessions by start time
        roomSessions.sort((a, b) => a.start_time.localeCompare(b.start_time));
        return {
            ...room,
            courses: roomSessions
        };
    });

    const colors = ['#60a5fa', '#4ade80', '#facc15', '#c084fc', '#f472b6', '#22d3ee', '#fb7185', '#fb923c'];

    return (
        <div className="schedule-container">
            <div className="background-mesh-schedule"></div>

            <header className="schedule-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1>
                        <span className="gradient-text-alt">
                            Cronograma del evento "{eventInfo?.name || '...'}"
                        </span>
                    </h1>
                    <p>Distribución de cursos, horarios y profesores asignados a cada Sala:</p>
                </div>
            </header>

            {loading ? (
                <div style={{ color: 'white', padding: '2rem' }}>Cargando cronograma...</div>
            ) : scheduleByRoom.length === 0 ? (
                <div style={{ color: 'white', padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem' }}>
                    No hay salones disponibles. Agrega salones en el panel de control primero.
                </div>
            ) : (
                <div className="schedule-grid">
                    {scheduleByRoom.map((roomSchedule, idx) => (
                        <div key={roomSchedule.id} className="room-schedule-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                <h2 className="room-title" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>{roomSchedule.name}</h2>
                                <button className="primary-btn" onClick={() => {
                                    setFormData({ ...formData, room_id: roomSchedule.id });
                                    setIsModalOpen(true);
                                }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', margin: 0 }}>
                                    <Plus size={14} />
                                    Agregar Información
                                </button>
                            </div>
                            <div className="courses-list">
                                {roomSchedule.courses.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>Aún no hay charlas para este salón.</p>
                                ) : (
                                    roomSchedule.courses.map((course, cIdx) => (
                                        <div key={course.id} className="course-item" style={{ borderLeftColor: colors[cIdx % colors.length] }}>
                                            <div className="course-info">
                                                <h3>{course.name}</h3>
                                                <p className="teacher">
                                                    <User size={14} /> <span>{course.speaker}</span>
                                                </p>
                                                <p className="time">
                                                    <Clock size={14} /> <span>{course.start_time} - {course.end_time}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '2rem', width: '90%', maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ color: 'white', margin: 0 }}>Agregar Información del Salón</h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '0.5rem' }}>Salón</label>
                                <select
                                    name="room_id"
                                    value={formData.room_id}
                                    onChange={handleInputChange}
                                    required
                                    style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                                >
                                    <option value="" disabled>Selecciona un salón</option>
                                    {rooms.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.conference_name})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '0.5rem' }}>Nombre del Curso / Charla</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Ej. Taller de React"
                                    style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '0.5rem' }}>Conferencista / Profesor</label>
                                <input
                                    type="text"
                                    name="speaker"
                                    value={formData.speaker}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Ej. Ana Ruiz"
                                    style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '0.5rem' }}>Hora de Inicio</label>
                                    <input
                                        type="time"
                                        name="start_time"
                                        value={formData.start_time}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '0.5rem' }}>Hora de Fin</label>
                                    <input
                                        type="time"
                                        name="end_time"
                                        value={formData.end_time}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="primary-btn" style={{ padding: '0.75rem 1.5rem', margin: 0 }}>
                                    Guardar Información
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Schedule;
