import { Outlet, NavLink } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Avatar } from '../ui/Avatar';
import { MarbleBackground } from '../ui/MarbleBackground';

export function AppLayout() {
  const navItems = [
    { to: '/app', icon: 'add-circle-outline', label: 'New Trip', exact: true },
    { to: '/app/chat', icon: 'chatbubbles-outline', label: 'Chat' },
    { to: '/app/trips', icon: 'map-outline', label: 'Trips' },
    { to: '/app/bookings', icon: 'ticket-outline', label: 'Bookings' },
    { to: '/app/budget', icon: 'wallet-outline', label: 'Budget' },
  ];

  return (
    <div className="flex h-screen bg-background text-primary-text overflow-hidden font-sans selection:bg-accent/30 selection:text-text relative z-0">
      <MarbleBackground animate={true} intensity="medium" className="fixed inset-0 z-[-1]" />
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-background/50 backdrop-blur-md">
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive
                  ? 'bg-elevated/80 text-accent font-medium shadow-sm'
                  : 'text-secondary-text hover:text-primary-text hover:bg-elevated/40'
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-secondary-text hover:text-primary-text hover:bg-elevated/40 transition-colors"
          >
            <Avatar size="sm" />
            <span className="font-medium text-sm">My Account</span>
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-transparent">

        <header className="md:hidden h-16 border-b border-border bg-background flex items-center justify-between px-4 z-10">
          <div className="flex items-center">
            <Logo compact />
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/app/notifications">
              <IconButton icon="notifications-outline" variant="ghost" />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col z-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-background flex items-center justify-around px-2 z-50 safe-area-bottom">
        {[
          { to: '/app', icon: 'home-outline', label: 'Home', exact: true },
          { to: '/app/chat', icon: 'chatbubbles-outline', label: 'Chat' },
          { to: '/app/trips', icon: 'map-outline', label: 'Trips' },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-colors min-w-[64px] ${isActive ? 'text-accent' : 'text-secondary-text'
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
