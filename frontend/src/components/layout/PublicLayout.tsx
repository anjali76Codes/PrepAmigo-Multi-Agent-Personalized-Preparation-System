import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { PageBackground } from '../ui/PageBackground';
import { useState, useEffect } from 'react';


export function PublicLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const navigate = useNavigate();
  const { pathname } = useLocation();

  const goTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (pathname === '/') scroll();
    else {
      navigate('/');
      setTimeout(scroll, 100); // wait for Home to mount
    }
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen text-carbon-700 relative flex flex-col font-sans selection:bg-navy-100 selection:text-navy-800 bg-transparent">
      {/* Organic Background */}
      <PageBackground className="fixed inset-0 z-[-1]" />

      {/* Navigation */}
      <header className="fixed top-0 z-50 transition-all duration-300 w-full px-4 pt-4 md:px-8 md:pt-5">
        <div className={`mx-auto flex items-center justify-between transition-all duration-300 ${isScrolled
          ? 'max-w-4xl h-16 px-6 rounded-full border border-border bg-surface/90 backdrop-blur-xl shadow-pop text-carbon-700'
          : 'max-w-7xl h-18 md:h-20 px-6 md:px-8 rounded-2xl md:rounded-full border border-white/15 bg-carbon-900/90 backdrop-blur-xl shadow-2xl text-white'
          }`}>
          <Link to="/" className="flex items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-navy-700 rounded-control">
            <Logo tone={isScrolled ? "default" : "inverse"} />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex flex-1 items-center justify-end gap-8">
            <a href="#features" onClick={goTo('features')} className={`text-sm font-medium transition-colors outline-none focus-visible:text-navy-700 ${isScrolled ? 'text-carbon-500 hover:text-carbon-900' : 'text-white/70 hover:text-white'}`}>
              Features
            </a>
            <a href="#agents" onClick={goTo('agents')} className={`text-sm font-medium transition-colors outline-none focus-visible:text-navy-700 ${isScrolled ? 'text-carbon-500 hover:text-carbon-900' : 'text-white/70 hover:text-white'}`}>
              Agents
            </a>
            <div className={`flex items-center gap-4 border-l pl-8 ${isScrolled ? 'border-border' : 'border-white/20'}`}>
              {/* <Link to="/login" className="text-sm font-medium text-carbon-500 hover:text-carbon-900 transition-colors outline-none focus-visible:text-navy-700">
                Log in
              </Link> */}
              <Link to="/signup" className="outline-none focus-visible:ring-2 focus-visible:ring-navy-700 rounded-control">
                <Button className="rounded-control h-10 px-6 font-semibold" variant="primary">
                  Get Started
                </Button>
              </Link>
            </div>
          </nav>

          {/* Mobile menu toggle */}
          <button
            className={`md:hidden p-2 transition-colors ${isScrolled ? 'text-carbon-500 hover:text-carbon-900' : 'text-white/70 hover:text-white'}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <Icon name={isMobileMenuOpen ? "close-outline" : "menu-outline"} className="text-2xl" />
          </button>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-surface border-b border-border p-6 flex flex-col gap-4 shadow-pop">
            <a href="#features" className="text-base font-medium py-2" onClick={goTo('features')}>Features</a>
            <a href="#agents" className="text-base font-medium py-2" onClick={goTo('agents')}>Agents</a>
            <hr className="border-border my-2" />
            <Link to="/login" className="text-base font-medium py-2" onClick={() => setIsMobileMenuOpen(false)}>Log in</Link>
            <Link to="/signup" className="mt-2" onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full h-12 text-base font-semibold">Sign Up</Button>
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col z-10 w-full relative">
        <Outlet />
      </main>

      <footer className="w-full border-t border-border mt-auto relative z-10 bg-bg/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-90 grayscale-70 hover:grayscale-0 hover:opacity-100 transition-all text-carbon-900">
            <Logo />
            {/* <span className="font-semibold text-sm">PrepAmigo</span> */}
          </div>
          <p className="text-xs text-carbon-500">
            © {new Date().getFullYear()} PrepAmigo. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-carbon-500">
            <Link to="/privacy-policy" className="transition-colors hover:text-carbon-900">
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" className="transition-colors hover:text-carbon-900">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
