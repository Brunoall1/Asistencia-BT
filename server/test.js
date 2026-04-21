const db = require('./database');
(async () => {
  const att = await db.all("SELECT a.qr_code, a.first_name, a.event_id, a.room_id FROM attendees a LIMIT 5");
  console.log("Attendees:", att);
  if(att.length > 0) {
      const q = att[0].qr_code;
      const joined = await db.get(`
            SELECT a.first_name, r.name as room_name, e.name as event_name, e.access_code as event_access_code
            FROM attendees a
            JOIN rooms r ON a.room_id = r.id
            JOIN events e ON a.event_id = e.id
            WHERE a.qr_code = ?
        `, [q]);
      console.log("Joined:", joined);
  }
})();
