import React from 'react';
import { useLocation } from 'react-router-dom';
import Navigation from './Navigation';

const Layout = ({ children }) => {
    const location = useLocation();
    const isDashboard = location.pathname.match(/^\/event\/([a-zA-Z0-9-]+)/);
    const isHome = location.pathname === '/' || location.pathname === '/admin';

    return (
        <>
            {(!isDashboard && !isHome) && (
                <div className="global-logo">
                    <img src="/logo.png" alt="Brandketing Logo" />
                </div>
            )}
            <Navigation />
            <main className="main-content">
                {children}
            </main>
        </>
    );
};

export default Layout;
