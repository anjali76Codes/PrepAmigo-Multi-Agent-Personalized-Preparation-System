import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { Home } from './pages/Home';
import { Auth } from './pages/Auth';
import { AppProvider } from './context/AppContext';
import { StyleProvider } from './components/ui/StyleProvider';
import { StyleGuide } from './pages/StyleGuide';
import { AppHome } from './pages/AppHome';
import { Chat } from './pages/Chat';
import { Preps } from './pages/Preps';
import { PrepDetails } from './pages/PrepDetails';
import { Calendar } from './pages/Calendar';
import { Practice } from './pages/Practice';
import { Progress } from './pages/Progress';
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
          <Route path="/login" element={<PageTransition><Auth /></PageTransition>} />
          <Route path="/signup" element={<PageTransition><Auth /></PageTransition>} />
        </Route>

        {/* App Routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<PageTransition><AppHome /></PageTransition>} />
          <Route path="chat" element={<PageTransition><Chat /></PageTransition>} />
          <Route path="preps" element={<PageTransition><Preps /></PageTransition>} />
          <Route path="preps/:prepId" element={<PageTransition><PrepDetails /></PageTransition>} />
          <Route path="calendar" element={<PageTransition><Calendar /></PageTransition>} />
          <Route path="practice" element={<PageTransition><Practice /></PageTransition>} />
          <Route path="progress" element={<PageTransition><Progress /></PageTransition>} />
          <Route path="notifications" element={<PageTransition><Notifications /></PageTransition>} />
          <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <StyleProvider>
      <AppProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AppProvider>
    </StyleProvider>
  );
}

export default App;
