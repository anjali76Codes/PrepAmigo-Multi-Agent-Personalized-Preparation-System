import { Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background text-primary-text relative overflow-hidden flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-gradient-blob-1 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
