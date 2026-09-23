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
import { Bookings } from './pages/Bookings';
import { Budget } from './pages/Budget';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

function PageTransition({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
      transition={{ duration: 0.2 }}
      className="w-full h-full flex flex-col relative"
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/style-guide" element={<PageTransition><StyleGuide /></PageTransition>} />
        </Route>

        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
          <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
        </Route>

        {/* App Routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<PageTransition><AppHome /></PageTransition>} />
          <Route path="chat" element={<PageTransition><Chat /></PageTransition>} />
          <Route path="trips" element={<PageTransition><Trips /></PageTransition>} />
          <Route path="trips/:tripId" element={<PageTransition><TripDetails /></PageTransition>} />
          <Route path="bookings" element={<PageTransition><Bookings /></PageTransition>} />
          <Route path="budget" element={<PageTransition><Budget /></PageTransition>} />
          <Route path="notifications" element={<PageTransition><Notifications /></PageTransition>} />
          <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
