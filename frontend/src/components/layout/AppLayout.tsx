import { Outlet, NavLink } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Avatar } from '../ui/Avatar';

export function AppLayout() {
  const navItems = [
    { to: '/app/chat', icon: 'chatbubbles-outline', label: 'kaju' },
    { to: '/app/trips', icon: 'map-outline', label: 'Trips' },
    { to: '/app/bookings', icon: 'ticket-outline', label: 'Bookings' },
    { to: '/app/budget', icon: 'wallet-outline', label: 'Budget' },
  ];

  return (
    <div className="flex h-screen bg-background text-primary-text overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-surface/50">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Logo />
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-secondary-text hover:text-primary-text hover:bg-surface-elevated'
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-secondary-text hover:text-primary-text hover:bg-surface-elevated transition-colors"
          >
            <Avatar size="sm" />
            <span className="font-medium text-sm">My Account</span>
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center md:hidden">
            <Logo compact />
          </div>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-2">
            <NavLink to="/app/notifications">
              <IconButton icon="notifications-outline" variant="ghost" />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-surface flex items-center justify-around px-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-secondary-text'
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
