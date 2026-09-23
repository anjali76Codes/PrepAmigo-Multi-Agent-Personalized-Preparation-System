import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { Home } from './pages/Home';
import { Login, Signup } from './pages/Auth';
import { StyleGuide } from './pages/StyleGuide';
import { AppHome } from './pages/AppHome';
import { Chat } from './pages/Chat';
import { Trips } from './pages/Trips';
import { TripDetails } from './pages/TripDetails';

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
          <Route index element={<AppHome />} />
          <Route path="chat" element={<Chat />} />
          <Route path="trips" element={<Trips />} />
          <Route path="trips/:tripId" element={<TripDetails />} />
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
