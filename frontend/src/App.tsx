import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { PublicLayout } from "./components/layout/PublicLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { AppLayout } from "./components/layout/AppLayout";
import { PlanSetupLayout } from "./components/layout/PlanSetupLayout";
import { Home } from "./pages/Home";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { Auth } from "./pages/Auth";
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./hooks/useAuth";
import { StyleProvider } from "./components/ui/StyleProvider";
import { StyleGuide } from "./pages/StyleGuide";
import { AppHome } from "./pages/AppHome";
import { Chat } from "./pages/Chat";
import { Calendar } from "./pages/Calendar";
import { Roadmap } from "./pages/Roadmap";
import { Assessment } from "./pages/Assessment";
import { Progress } from "./pages/Progress";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { Profile } from "./pages/Profile";
import { InterviewPrep } from "./pages/InterviewPrep";
import { ResourcePackHome } from "./pages/ResourcePackHome";
import { NotesDirectory } from "./pages/NotesDirectory";
import { ResourceChat } from "./pages/ResourceChat";
import { ResourceChatHistory } from "./pages/ResourceChatHistory";
import { ResourceNoteEditor } from "./pages/ResourceNoteEditor";
import { LevelDetail } from "./pages/LevelDetail";
import { NotFound } from "./pages/NotFound";
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

const APP_LAYOUT_ROOTS = ["dashboard", "resource-pack", "roadmap", "calendar", "assessment", "notes", "profile"];

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
          <Route path="/privacy-policy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
          <Route path="/terms-of-service" element={<PageTransition><TermsOfService /></PageTransition>} />
          <Route path="/style-guide" element={<PageTransition><StyleGuide /></PageTransition>} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<PageTransition><Auth /></PageTransition>} />
          <Route path="/signup" element={<PageTransition><Auth /></PageTransition>} />
        </Route>

        <Route element={<PlanSetupLayout />}>
          <Route path="/dashboard/chat" element={<PageTransition><Chat /></PageTransition>} />
        </Route>

        <Route element={<AppLayout />}>
          <Route path="/dashboard">
            <Route index element={<AppHome />} />
            <Route path="interview-prep" element={<InterviewPrep />} />
            <Route path="practice" element={<Roadmap />} />
            <Route path="progress" element={<Progress />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            {/* <Route path="roadmap" element={<Navigate to="/roadmap" replace />} />
            <Route path="calendar" element={<Navigate to="/calendar" replace />} /> */}
            <Route path="assessment" element={<Assessment />} />
            <Route path=":sprintId/:levelId" element={<LevelDetail />} />
          </Route>

          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />

          <Route path="/resource-pack">
            <Route index element={<ResourcePackHome />} />
            <Route path="notes" element={<NotesDirectory />} />
            <Route path="notes/:noteId" element={<ResourceNoteEditor />} />
            <Route path="chat/history" element={<ResourceChatHistory />} />
            <Route path="chat" element={<ResourceChat />} />
            <Route path="chat/:chatId" element={<ResourceChat />} />
          </Route>
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <StyleProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </StyleProvider>
  );
}

export default App;
