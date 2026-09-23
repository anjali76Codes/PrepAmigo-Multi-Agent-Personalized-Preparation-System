import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { Home } from './pages/Home';
import { Login, Signup } from './pages/Auth';
import { StyleGuide } from './pages/StyleGuide';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <h2 className="text-2xl font-bold text-secondary-text">{title}</h2>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/style-guide" element={<StyleGuide />} />
        </Route>

        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* App Routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/chat" replace />} />
          <Route path="chat" element={<Placeholder title="kaju Chat Interface" />} />
          <Route path="trips" element={<Placeholder title="Trips Dashboard" />} />
          <Route path="trips/:tripId" element={<Placeholder title="Trip Details" />} />
          <Route path="bookings" element={<Placeholder title="Bookings" />} />
          <Route path="budget" element={<Placeholder title="Budget Planner" />} />
          <Route path="notifications" element={<Placeholder title="Notifications" />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
