import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { PublicLayout } from "./components/layout/PublicLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { AppLayout } from "./components/layout/AppLayout";
import { Home } from "./pages/Home";
import { Auth } from "./pages/Auth";
import { AppProvider } from "./context/AppContext";
import { StyleProvider } from "./components/ui/StyleProvider";
import { StyleGuide } from "./pages/StyleGuide";
import { AppHome } from "./pages/AppHome";
import { Chat } from "./pages/Chat";
import { Preps } from "./pages/Preps";
import { PrepDetails } from "./pages/PrepDetails";
import { Calendar } from "./pages/Calendar";
import { Roadmap } from "./pages/Roadmap";
import { Progress } from "./pages/Progress";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { InterviewPrep } from "./pages/InterviewPrep";
import { ResourcePackHome } from "./pages/ResourcePackHome";
import { NotesDirectory } from "./pages/NotesDirectory";
import { ResourceChat } from "./pages/ResourceChat";
import { ResourceChatHistory } from "./pages/ResourceChatHistory";
import { LevelDetail } from "./pages/LevelDetail";
import { AnimatePresence, motion } from "framer-motion";


function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full h-full flex flex-col relative"
    >
      {children}
    </motion.div>
  );
}

const APP_LAYOUT_ROOTS = ["dashboard", "resource-pack", "roadmap", "calendar", "assessment"];

function getRouteKey(pathname: string) {
  const first = pathname.split("/")[1] || "root";
  if (["login", "signup"].includes(first)) return "auth";
  if (APP_LAYOUT_ROOTS.includes(first)) return "app";
  return first;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={getRouteKey(location.pathname)}>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/style-guide" element={<PageTransition><StyleGuide /></PageTransition>} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<PageTransition><Auth /></PageTransition>} />
          <Route path="/signup" element={<PageTransition><Auth /></PageTransition>} />
        </Route>

        <Route element={<AppLayout />}>
          <Route path="/dashboard">
            <Route index element={<PageTransition><AppHome /></PageTransition>} />
            <Route path="chat" element={<PageTransition><Chat /></PageTransition>} />
            <Route path="interview-prep" element={<PageTransition><InterviewPrep /></PageTransition>} />
            <Route path="preps" element={<PageTransition><Preps /></PageTransition>} />
            <Route path="preps/:prepId" element={<PageTransition><PrepDetails /></PageTransition>} />
            <Route path="practice" element={<PageTransition><Roadmap /></PageTransition>} />
            <Route path="progress" element={<PageTransition><Progress /></PageTransition>} />
            <Route path="notifications" element={<PageTransition><Notifications /></PageTransition>} />
            <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
            <Route path="roadmap" element={<Navigate to="/roadmap" replace />} />
            <Route path="calendar" element={<Navigate to="/calendar" replace />} />
            <Route path="assessment" element={<Navigate to="/assessment" replace />} />
            <Route path=":sprintId/:levelId" element={<PageTransition><LevelDetail /></PageTransition>} />
          </Route>

          <Route path="/roadmap" element={<PageTransition><Roadmap /></PageTransition>} />
          <Route path="/calendar" element={<PageTransition><Calendar /></PageTransition>} />
          <Route path="/assessment" element={<PageTransition><div className="p-8 text-carbon-900 font-bold text-2xl">Assessment</div></PageTransition>} />

          <Route path="/resource-pack">
            <Route index element={<PageTransition><ResourcePackHome /></PageTransition>} />
            <Route path="notes" element={<PageTransition><NotesDirectory /></PageTransition>} />
            <Route path="chat/history" element={<PageTransition><ResourceChatHistory /></PageTransition>} />
            <Route path="chat" element={<PageTransition><ResourceChat /></PageTransition>} />
            <Route path="chat/:chatId" element={<PageTransition><ResourceChat /></PageTransition>} />
          </Route>
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
