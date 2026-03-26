import React from 'react';
import Navigation from '../components/Navigation';

const Layout = ({ children }) => {
    return (
        <>
            <Navigation />
            <main className="main-content">
                {children}
            </main>
        </>
    );
};

export default Layout;
