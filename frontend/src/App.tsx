import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PublicLayout } from "./components/layout/PublicLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { AppLayout } from "./components/layout/AppLayout";
import { PlanSetupLayout } from "./components/layout/PlanSetupLayout";
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./hooks/useAuth";
import { StyleProvider } from "./components/ui/StyleProvider";
import { PlatformLoader } from "./components/ui/PlatformLoader";

const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("./pages/TermsOfService").then((m) => ({ default: m.TermsOfService })));
const Auth = lazy(() => import("./pages/Auth").then((m) => ({ default: m.Auth })));
const StyleGuide = lazy(() => import("./pages/StyleGuide").then((m) => ({ default: m.StyleGuide })));
const Chat = lazy(() => import("./pages/Chat").then((m) => ({ default: m.Chat })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

const AppHome = lazy(() => import("./pages/AppHome").then((m) => ({ default: m.AppHome })));
const Calendar = lazy(() => import("./pages/Calendar").then((m) => ({ default: m.Calendar })));
const Roadmap = lazy(() => import("./pages/Roadmap").then((m) => ({ default: m.Roadmap })));
const Assessment = lazy(() => import("./pages/Assessment").then((m) => ({ default: m.Assessment })));
const Progress = lazy(() => import("./pages/Progress").then((m) => ({ default: m.Progress })));
const Notifications = lazy(() => import("./pages/Notifications").then((m) => ({ default: m.Notifications })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const InterviewPrep = lazy(() => import("./pages/InterviewPrep").then((m) => ({ default: m.InterviewPrep })));
const ResourcePackHome = lazy(() => import("./pages/ResourcePackHome").then((m) => ({ default: m.ResourcePackHome })));
const NotesDirectory = lazy(() => import("./pages/NotesDirectory").then((m) => ({ default: m.NotesDirectory })));
const ResourceChat = lazy(() => import("./pages/ResourceChat").then((m) => ({ default: m.ResourceChat })));
const ResourceChatHistory = lazy(() => import("./pages/ResourceChatHistory").then((m) => ({ default: m.ResourceChatHistory })));
const ResourceNoteEditor = lazy(() => import("./pages/ResourceNoteEditor").then((m) => ({ default: m.ResourceNoteEditor })));
const LevelDetail = lazy(() => import("./pages/LevelDetail").then((m) => ({ default: m.LevelDetail })));
const StatusPreview = lazy(() => import("./pages/StatusPreview").then((m) => ({ default: m.StatusPreview })));

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

const APP_LAYOUT_ROOTS = [
  "dashboard",
  "resource-pack",
  "roadmap",
  "calendar",
  "assessment",
  "progress",
  "notes",
  "profile",
  "status-preview", // TEMP
];

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
          {/* TEMP: remove when done testing */}
          <Route path="/status-preview" element={<StatusPreview />} />

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
            <Suspense fallback={<PlatformLoader />}>
              <AnimatedRoutes />
            </Suspense>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </StyleProvider>
  );
}

export default App;