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
    <div className="flex h-screen bg-bg text-carbon-700 overflow-hidden font-sans selection:bg-forest-100 selection:text-forest-800 relative z-0">
      <PageBackground />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-bg/50 backdrop-blur-md">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Logo />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-control transition-colors ${
                  isActive
                    ? "bg-surface-muted text-forest-700 font-medium shadow-card"
                    : "text-carbon-500 hover:text-carbon-900 hover:bg-surface-muted"
                }`
              }
            >
              <Icon name={item.icon} className="text-xl" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <NavLink
            to="/app/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-control text-carbon-500 hover:text-carbon-900 hover:bg-surface-muted transition-colors"
          >
            <Avatar size="sm" />
            <span className="font-medium text-sm">My Account</span>
          </NavLink>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-control text-carbon-500 hover:text-carbon-900 hover:bg-surface-muted transition-colors"
          >
            <Icon name="log-out-outline" className="text-xl" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-transparent">
        <header className="md:hidden h-16 border-b border-border bg-bg flex items-center justify-between px-4 z-10">
          <div className="flex items-center">
            <Logo compact />
          </div>

          <div className="flex items-center gap-2">
            <NavLink to="/app/notifications">
              <IconButton icon="notifications-outline" variant="ghost" />
            </NavLink>

            {/* Mobile Logout */}
            <IconButton
              icon="log-out-outline"
              variant="ghost"
              onClick={handleLogout}
            />
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col z-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-bg flex items-center justify-around px-2 z-50 safe-area-bottom">
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
              `flex flex-col items-center justify-center gap-1 p-2 rounded-control transition-colors min-w-[64px] ${
                isActive ? "text-forest-700" : "text-carbon-500"
              }`
            }
          >
            <Icon name={item.icon} className="text-xl" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
