import { useOutlet, NavLink, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "../ui/Logo";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { PageBackground } from "../ui/PageBackground";
import { SearchBar } from "./SearchBar";
import React from "react";
import { Mascot } from "../ui/Mascot";
import { ErrorState } from "../ui/ErrorState";

class ErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey?: string }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode; resetKey?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-4 gap-6 overflow-y-auto">
          <Mascot size="lg" variant="sad.png" />
          <ErrorState
            title="Oops! Something went wrong."
            description={this.state.error?.message || "An unexpected error occurred."}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}


import { useAuth } from "../../hooks/useAuth";
import { featureFlags } from "../../config/featureFlags";

export function AppLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("prepamigo_sidebar_open");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("prepamigo_sidebar_open", String(isSidebarOpen));
    } catch {
      // Ignore localStorage errors
    }
  }, [isSidebarOpen]);

  // Authentication guard controlled via featureFlags (VITE_ENABLE_AUTH)
  if (featureFlags.enableAuth) {
    if (loading) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-carbon-900 text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-chrome-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-carbon-400">Loading session…</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  }

  const handleLogout = async () => {
    const success = await logout();

    if (success) {
      navigate("/login");
    }
  };

  const navItems = [
    { to: "/dashboard", icon: "home-outline", label: "Dashboard", exact: true },
    { to: "/roadmap", icon: "git-network-outline", label: "Roadmap" },
    { to: "/resource-pack", icon: "folder-open-outline", label: "Resource Pack" },
    { to: "/calendar", icon: "calendar-outline", label: "Calendar" },
    { to: "/assessment", icon: "clipboard-outline", label: "Assessment" },
    { to: "/dashboard/progress", icon: "bar-chart-outline", label: "Progress" },
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
          className={`h-16 flex items-center shrink-0 transition-all ${
            isSidebarOpen ? "px-5 justify-between gap-2" : "justify-center px-2"
          }`}
        >
          {isSidebarOpen ? (
            <>
              <div className="transition-opacity text-sm">
                <Logo tone="inverse" />
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="p-2 text-on-chrome-muted hover:text-on-chrome hover:bg-white/10 rounded-xl transition-all duration-150 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
              >
                {/* Sleek modern sidebar collapse icon (ChatGPT style) */}
                <svg
                  className="w-6 h-6 pointer-events-none select-none shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m16 15-3-3 3-3" />
                </svg>
              </button>
            </>
          ) : (
            /* When collapsed: single mascot icon button that swaps to the expand icon on hover */
            <button
              onClick={() => setIsSidebarOpen(true)}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="group relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 cursor-pointer active:scale-95"
            >
              {/* Mascot image - fades out on hover */}
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-chrome text-chrome shadow-pop overflow-hidden transition-all duration-200 group-hover:opacity-0 group-hover:scale-90">
                <Mascot variant="nosy.png" style={{ width: "auto", height: "auto" }} />
              </div>

              {/* Sleek expand icon overlay - circular and matches the mascot avatar */}
              <div className="absolute inset-0 flex items-center justify-center text-on-chrome opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 border border-white/20 text-on-chrome shadow-md">
                  <svg
                    className="w-6 h-6 pointer-events-none select-none shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m14 9 3 3-3 3" />
                  </svg>
                </div>
              </div>
            </button>
          )}
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
        <div className="flex-1 flex flex-col bg-bg md:rounded-tl-[2rem] overflow-hidden relative shadow-2xl border border-black/5">
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
            <ErrorBoundary resetKey={location.pathname}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  className="flex-1 overflow-y-auto w-full h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {outlet}
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-white/5 bg-carbon-900 flex items-center justify-start gap-1 px-2 z-50 safe-area-bottom overflow-x-auto">
        {[
          { to: "/dashboard", icon: "home-outline", label: "Dashboard", exact: true },
          { to: "/roadmap", icon: "git-network-outline", label: "Roadmap" },
          { to: "/resource-pack", icon: "folder-open-outline", label: "Resources" },
          { to: "/calendar", icon: "calendar-outline", label: "Calendar" },
          { to: "/assessment", icon: "clipboard-outline", label: "Assessment" },
          { to: "/dashboard/progress", icon: "bar-chart-outline", label: "Progress" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 p-2 rounded-control transition-colors min-w-[60px] shrink-0 focus-visible:outline-chrome-accent ${isActive ? "text-on-chrome" : "text-on-chrome-muted"
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
