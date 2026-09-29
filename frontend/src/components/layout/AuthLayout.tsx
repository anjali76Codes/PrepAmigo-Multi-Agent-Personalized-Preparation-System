import { Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-forest-700)]-text relative overflow-hidden flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-gradient-blob-1 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-8 shadow-[var(--shadow-pop)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
