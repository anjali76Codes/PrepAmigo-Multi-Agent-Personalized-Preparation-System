import { Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-primary-text relative overflow-hidden flex flex-col">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-blob-1 pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-blob-2 pointer-events-none" />
      
      <header className="relative z-10 w-full h-16 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-6">
        <Logo />
      </header>
      
      <main className="relative z-10 flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
