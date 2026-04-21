import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './PrintBadges.css';

const PrintBadges = ({ attendees, roomName, eventName, startingSlot = 0, onFinish }) => {

    useEffect(() => {
        // Trigger print dialog when component is mounted
        // Timeout to ensure rendering is complete, especially for QR codes
        const timer = setTimeout(() => {
            window.print();
            if (onFinish) onFinish();
        }, 500);

        return () => clearTimeout(timer);
    }, [onFinish]);

    // Construct the 10 slots (2 columns x 5 rows)
    const slots = Array(10).fill(null);
    
    // Fill the slots starting from the chosen index.
    // E.g., if startingSlot is 4 (the 5th slot) and we have 1 attendee, 
    // it will be placed at index 4.
    let currentAttIdx = 0;
    for (let i = startingSlot; i < 10; i++) {
        if (currentAttIdx < attendees.length) {
            slots[i] = attendees[currentAttIdx];
            currentAttIdx++;
        }
    }

    return (
        <div className="print-badges-container">
            <div className="print-page carta-page">
                <div className="badges-grid">
                    {slots.map((att, idx) => (
                        <div key={idx} className="badge-slot">
                            {att ? (
                                <div className="badge-content">
                                    <div className="qr-wrapper">
                                        <QRCodeSVG 
                                            value={`${window.location.origin}/show/${att.qr_code}`}
                                            size={120}
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="badge-text-container">
                                        <div className="badge-name">
                                            {att.first_name} {att.last_name}
                                        </div>
                                        <div className="badge-room">
                                            {roomName || 'Sala General'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-slot"></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PrintBadges;
