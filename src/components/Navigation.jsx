import React, { useState } from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import { Menu, X, Home, Calendar, ArrowLeft, ListChecks, Image, MessageSquare } from 'lucide-react';
import './Navigation.css';

const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    // In React Router v6, useParams inside a component that is OUTSIDE the Routes wrapper 
    // won't work correctly. We need to parse eventId from location instead if it's rendered in Layout over everything.
    const location = useLocation();
    const eventMatch = location.pathname.match(/^\/event\/([a-zA-Z0-9-]+)/);
    const eventId = eventMatch ? eventMatch[1] : null;

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const closeMenu = () => {
        setIsOpen(false);
    };

    // If not in an event, we don't show the side navigation
    if (!eventId) return null;

    return (
        <>
            <button
                className={`hamburger-btn ${isOpen ? 'open' : ''}`}
                onClick={toggleMenu}
                aria-label="Toggle menu"
            >
                {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>

            <div className={`nav-overlay ${isOpen ? 'visible' : ''}`} onClick={closeMenu}></div>

            <nav className={`side-nav ${isOpen ? 'open' : ''}`}>
                <div className="nav-header">
                    <h2>Panel del Evento</h2>
                </div>

                <ul className="nav-links">
                    <li>
                        <NavLink
                            to={`/event/${eventId}`}
                            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                            onClick={closeMenu}
                            end
                        >
                            <Home size={20} />
                            <span>Dashboard</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to={`/event/${eventId}/schedule`}
                            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                            onClick={closeMenu}
                        >
                            <Calendar size={20} />
                            <span>Cronograma</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to={`/event/${eventId}/pending`}
                            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                            onClick={closeMenu}
                        >
                            <ListChecks size={20} />
                            <span>Aprobaciones</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to={`/event/${eventId}/logo`}
                            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                            onClick={closeMenu}
                        >
                            <Image size={20} />
                            <span>Logo del Evento</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            to={`/event/${eventId}/message`}
                            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                            onClick={closeMenu}
                        >
                            <MessageSquare size={20} />
                            <span>Msj. Personalizado</span>
                        </NavLink>
                    </li>
                    <li style={{ marginTop: 'auto' }}>
                        <NavLink
                            to="/"
                            className="nav-link"
                            style={{ color: '#ef4444' }}
                            onClick={closeMenu}
                        >
                            <ArrowLeft size={20} />
                            <span>Salir Evento</span>
                        </NavLink>
                    </li>
                </ul>

                <div className="nav-footer">
                    <p>© 2026 Admin Panel</p>
                </div>
            </nav>
        </>
    );
};

export default Navigation;
