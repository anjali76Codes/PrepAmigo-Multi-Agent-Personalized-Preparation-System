import { Outlet, Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { PageBackground } from '../ui/PageBackground';
import { useState } from 'react';

export function PublicLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen text-[var(--color-forest-700)]-text relative flex flex-col font-sans selection:bg-[var(--color-forest-700)]/30 selection:text-text bg-transparent">
      {/* Organic Background */}
      <PageBackground className="fixed inset-0 z-[-1]" />
      
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[var(--color-bg)]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[var(--radius-control)]">
            <Logo />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex flex-1 items-center justify-end gap-8">
            <Link to="#features" className="text-sm font-medium text-[var(--color-navy-500)] hover:text-[var(--color-forest-700)]-text transition-colors outline-none focus-visible:text-[var(--color-forest-700)]">
              Features
            </Link>
            <Link to="#agents" className="text-sm font-medium text-[var(--color-navy-500)] hover:text-[var(--color-forest-700)]-text transition-colors outline-none focus-visible:text-[var(--color-forest-700)]">
              Agents
            </Link>
            <div className="flex items-center gap-4 border-l border-white/10 pl-8">
              {/* <Link to="/login" className="text-sm font-medium text-[var(--color-navy-500)] hover:text-[var(--color-forest-700)]-text transition-colors outline-none focus-visible:text-[var(--color-forest-700)]">
                Log in
              </Link> */}
              <Link to="/signup" className="outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full">
                <Button className="rounded-full h-10 px-6 font-semibold" variant="primary">
                 Get Started
                </Button>
              </Link>
            </div>
          </nav>

          {/* Mobile menu toggle */}
          <button 
            className="md:hidden p-2 text-[var(--color-navy-500)] hover:text-[var(--color-forest-700)]-text"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <Icon name={isMobileMenuOpen ? "close-outline" : "menu-outline"} className="text-2xl" />
          </button>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] p-6 flex flex-col gap-4 shadow-[var(--shadow-pop)]">
            <Link to="#features" className="text-base font-medium py-2" onClick={() => setIsMobileMenuOpen(false)}>Features</Link>
            <Link to="#agents" className="text-base font-medium py-2" onClick={() => setIsMobileMenuOpen(false)}>Agents</Link>
            <hr className="border-[var(--color-border)] my-2" />
            <Link to="/login" className="text-base font-medium py-2" onClick={() => setIsMobileMenuOpen(false)}>Log in</Link>
            <Link to="/signup" className="mt-2" onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full rounded-full h-12 text-base font-semibold">Sign Up</Button>
            </Link>
          </div>
        )}
      </header>
      
      <main className="flex-1 flex flex-col z-10 w-full relative">
        <Outlet />
      </main>

      <footer className="w-full border-t border-white/5 mt-auto relative z-10 bg-[var(--color-bg)]/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
            <Logo compact />
            <span className="font-semibold text-sm">PrepAmigo</span>
          </div>
          <p className="text-xs text-[var(--color-navy-500)]">
            © {new Date().getFullYear()} PrepAmigo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
