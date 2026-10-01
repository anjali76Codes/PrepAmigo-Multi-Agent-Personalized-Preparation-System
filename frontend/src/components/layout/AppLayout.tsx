import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "../ui/Logo";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { PageBackground } from "../ui/PageBackground";
import { SearchBar } from "./SearchBar";

import { useAuth } from "../../lib/useAuth";

export function AppLayout() {
  const { loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (loading) return null; // or a spinner

  // if (!user) return <Navigate to="/login" replace />;

  const handleLogout = async () => {
    const success = await logout();

    if (success) {
      navigate("/login");
    }
  };

  const navItems = [
    { to: "/dashboard", icon: "home-outline", label: "Home", exact: true },
    { to: "/dashboard/chat", icon: "chatbubbles-outline", label: "PrepAmigo" },
    {
      to: "/dashboard/interview-prep",
      icon: "briefcase-outline",
      label: "Interview Prep",
    },
    { to: "/dashboard/preps", icon: "map-outline", label: "Preps" },
    { to: "/dashboard/calendar", icon: "calendar-outline", label: "Calendar" },
    { to: "/dashboard/roadmap", icon: "git-network-outline", label: "Roadmap" },
    { to: "/dashboard/progress", icon: "bar-chart-outline", label: "Progress" },
    {
      to: "/dashboard/notifications",
      icon: "notifications-outline",
      label: "Notifications",
    },
  ];

  return (
    <div className="flex h-screen bg-carbon-900 text-carbon-700 overflow-hidden font-sans selection:bg-chrome-accent selection:text-chrome relative z-0">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ width: 256 }}
        animate={{ width: isSidebarOpen ? 256 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col bg-carbon-900 text-on-chrome relative overflow-hidden z-10"
      >
        <div
          className={`h-16 flex items-center shrink-0 transition-all ${isSidebarOpen ? "px-6 justify-between" : "justify-center"}`}
        >
          {isSidebarOpen && (
            <div className="overflow-hidden transition-opacity">
              <Logo tone="inverse" />
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center"
          >
            <Icon name="menu" tone="inverse" className="text-2xl" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              title={!isSidebarOpen ? item.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 py-2 rounded-xl transition-colors relative focus-visible:outline-chrome-accent ${isActive
                  ? "text-on-chrome font-medium"
                  : "text-on-chrome-muted hover:text-on-chrome"
                } ${isSidebarOpen ? "px-3" : "justify-center"}`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-xl transition-colors ${isActive ? "bg-chrome-accent text-white shadow-[0_0_15px_rgba(var(--chrome-accent),0.5)]" : "bg-white/5 group-hover:bg-white/10"}`}
                  >
                    <Icon
                      name={item.icon}
                      className="text-xl text-inherit"
                      tone={isActive ? "default" : "inverse"}
                    />
                  </div>
                  <AnimatePresence>
                    {isSidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="ml-3 whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 flex flex-col gap-2 shrink-0">
          <NavLink
            to="/dashboard/settings"
            title={!isSidebarOpen ? "Settings" : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 py-2 rounded-xl transition-colors relative focus-visible:outline-chrome-accent ${isActive
                ? "text-on-chrome font-medium"
                : "text-on-chrome-muted hover:text-on-chrome"
              } ${isSidebarOpen ? "px-3" : "justify-center"}`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-xl transition-colors ${isActive ? "bg-chrome-accent text-white shadow-[0_0_15px_rgba(var(--chrome-accent),0.5)]" : "bg-white/5 group-hover:bg-white/10"}`}
                >
                  <Icon
                    name="settings-outline"
                    className="text-xl text-inherit"
                    tone={isActive ? "default" : "inverse"}
                  />
                </div>
                <AnimatePresence>
                  {isSidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="ml-3 font-medium text-sm whitespace-nowrap overflow-hidden"
                    >
                      Settings
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>

          <button
            onClick={handleLogout}
            title={!isSidebarOpen ? "Logout" : undefined}
            className={`group w-full flex items-center gap-3 py-2 rounded-xl text-on-chrome-muted hover:text-on-chrome transition-colors focus-visible:outline-chrome-accent ${isSidebarOpen ? "px-3" : "justify-center"}`}
          >
            <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
              <Icon name="log-out-outline" className="text-xl" tone="inverse" />
            </div>
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="ml-3 font-medium text-sm whitespace-nowrap overflow-hidden"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative md:pl-0">
        <SearchBar />
        <div className="flex-1 flex flex-col bg-bg md:rounded-t-[2rem] overflow-hidden relative shadow-2xl border border-black/5">
          <PageBackground />

          <header className="md:hidden h-16 border-b border-white/5 bg-carbon-900 text-on-chrome flex items-center justify-between px-4 z-10 relative">
            <div className="flex items-center">
              <Logo compact tone="inverse" />
            </div>

            <div className="flex items-center gap-2">
              <NavLink
                to="/dashboard/notifications"
                className="focus-visible:outline-chrome-accent rounded-control"
              >
                <IconButton
                  icon="notifications-outline"
                  variant="ghost"
                  tone="inverse"
                />
              </NavLink>

              {/* Mobile Logout */}
              <div className="focus-visible:outline-chrome-accent rounded-control">
                <IconButton
                  icon="log-out-outline"
                  variant="ghost"
                  onClick={handleLogout}
                  tone="inverse"
                />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col z-10 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                className="flex-1 overflow-y-auto w-full h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-white/5 bg-carbon-900 flex items-center justify-around px-2 z-50 safe-area-bottom">
        {[
          { to: "/dashboard", icon: "home-outline", label: "Home", exact: true },
          { to: "/dashboard/chat", icon: "chatbubbles-outline", label: "PrepAmigo" },
          {
            to: "/dashboard/interview-prep",
            icon: "briefcase-outline",
            label: "Interview Prep",
          },
          { to: "/dashboard/preps", icon: "map-outline", label: "Preps" },
          { to: "/dashboard/calendar", icon: "calendar-outline", label: "Calendar" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 p-2 rounded-control transition-colors min-w-[64px] focus-visible:outline-chrome-accent ${isActive ? "text-on-chrome" : "text-on-chrome-muted"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.icon}
                  className="text-xl"
                  tone={isActive ? "inverse" : "default"}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
