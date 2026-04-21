import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './Dashboard';
import Schedule from './pages/Schedule';
import AttendeeList from './pages/AttendeeList';
import Home from './pages/Home';
import CreateEvent from './pages/CreateEvent';
import AccessEvent from './pages/AccessEvent';
import AdminEventsList from './pages/AdminEventsList';
import AdminEventDetails from './pages/AdminEventDetails';
import AdminHome from './pages/AdminHome';
import PublicCheckIn from './pages/PublicCheckIn';
import PublicRegistration from './pages/PublicRegistration';
import PendingList from './pages/PendingList';
import EventLogoSettings from './pages/EventLogoSettings';
import EventMessageSettings from './pages/EventMessageSettings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/create-event" element={<CreateEvent />} />
          <Route path="/access-event" element={<AccessEvent />} />
          
          <Route path="/admin/events" element={<AdminEventsList />} />
          <Route path="/admin/events/:eventId" element={<AdminEventDetails />} />
          
          <Route path="/show/:qrCode" element={<PublicCheckIn />} />
          <Route path="/register/:eventId" element={<PublicRegistration />} />

          <Route path="/event/:eventId" element={<Outlet />}>
            <Route index element={<Dashboard />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="attendees/:courseId" element={<AttendeeList />} />
            <Route path="pending" element={<PendingList />} />
            <Route path="logo" element={<EventLogoSettings />} />
            <Route path="message" element={<EventMessageSettings />} />
          </Route>
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
