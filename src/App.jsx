import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './Dashboard';
import Schedule from './pages/Schedule';
import AttendeeList from './pages/AttendeeList';
import Home from './pages/Home';
import CreateEvent from './pages/CreateEvent';
import AccessEvent from './pages/AccessEvent';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create-event" element={<CreateEvent />} />
          <Route path="/access-event" element={<AccessEvent />} />
          
          <Route path="/event/:eventId" element={<Outlet />}>
            <Route index element={<Dashboard />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="attendees/:courseId" element={<AttendeeList />} />
          </Route>
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
