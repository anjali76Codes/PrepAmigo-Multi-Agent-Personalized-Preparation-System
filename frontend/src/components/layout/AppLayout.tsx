import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Logo } from "../ui/Logo";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Avatar } from "../ui/Avatar";
import { PageBackground } from "../ui/PageBackground";

import { useAuth } from "../../lib/useAuth";

export function AppLayout() {
  const { loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return null; // or a spinner

  // if (!user) return <Navigate to="/login" replace />;

  const handleLogout = async () => {
    const success = await logout();

    if (success) {
      navigate("/login");
    }
  };

  const navItems = [
    { to: "/app", icon: "home-outline", label: "Home", exact: true },
    { to: "/app/chat", icon: "chatbubbles-outline", label: "PrepAmigo" },
    { to: "/app/preps", icon: "map-outline", label: "Preps" },
    { to: "/app/calendar", icon: "calendar-outline", label: "Calendar" },
    { to: "/app/practice", icon: "clipboard-outline", label: "Practice" },
    { to: "/app/progress", icon: "bar-chart-outline", label: "Progress" },
    { to: "/app/notifications", icon: "notifications-outline", label: "Notifications" },
    { to: "/app/settings", icon: "settings-outline", label: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-bg text-carbon-700 overflow-hidden font-sans selection:bg-chrome-accent selection:text-chrome relative z-0">
      <PageBackground />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-chrome-border bg-chrome text-on-chrome">
        <div className="h-16 flex items-center px-6 border-b border-chrome-border">
          <Logo tone="inverse" />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-control transition-colors relative overflow-hidden focus-visible:outline-chrome-accent ${
                  isActive
                    ? "bg-lavender-100/15 text-on-chrome font-medium"
                    : "text-on-chrome-muted hover:text-on-chrome hover:bg-chrome-hover"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 bg-chrome-accent rounded-r-full" />}
                  <Icon name={item.icon} className="text-xl" tone="inverse" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-chrome-border">
          <NavLink
            to="/app/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-control text-on-chrome-muted hover:text-on-chrome hover:bg-chrome-hover transition-colors focus-visible:outline-chrome-accent"
          >
            <Avatar size="sm" tone="inverse" />
            <span className="font-medium text-sm">My Account</span>
          </NavLink>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-control text-on-chrome-muted hover:text-on-chrome hover:bg-chrome-hover transition-colors focus-visible:outline-chrome-accent"
          >
            <Icon name="log-out-outline" className="text-xl" tone="inverse" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-transparent">
        <header className="md:hidden h-16 border-b border-chrome-border bg-chrome text-on-chrome flex items-center justify-between px-4 z-10">
          <div className="flex items-center">
            <Logo compact tone="inverse" />
          </div>

          <div className="flex items-center gap-2">
            <NavLink to="/app/notifications" className="focus-visible:outline-chrome-accent rounded-control">
              <IconButton icon="notifications-outline" variant="ghost" tone="inverse" />
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

        <main className="flex-1 overflow-hidden flex flex-col z-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-chrome-border bg-chrome flex items-center justify-around px-2 z-50 safe-area-bottom">
        {[
          { to: "/app", icon: "home-outline", label: "Home", exact: true },
          { to: "/app/chat", icon: "chatbubbles-outline", label: "PrepAmigo" },
          { to: "/app/preps", icon: "map-outline", label: "Preps" },
          { to: "/app/calendar", icon: "calendar-outline", label: "Calendar" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 p-2 rounded-control transition-colors min-w-[64px] focus-visible:outline-chrome-accent ${
                isActive ? "text-on-chrome" : "text-on-chrome-muted"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} className="text-xl" tone={isActive ? "inverse" : "default"} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
