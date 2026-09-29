import { Link, useLocation } from 'react-router-dom';
import { PageBackground } from '../components/ui/PageBackground';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export function Auth() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-[var(--color-bg)] relative flex items-center justify-center p-6">
      <PageBackground />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-navy-900)] rounded-[var(--radius-card)] shadow-[var(--shadow-pop)] shadow-primary/20 mb-6">
            <Icon name="school" className="text-3xl text-white" />
          </Link>
          <h1 className="text-3xl font-bold text-[var(--color-forest-700)]-text mb-2">
            {isLogin ? 'Sign in to PrepAmigo' : 'Create your PrepAmigo account'}
          </h1>
          <p className="text-[var(--color-navy-500)]">
            {isLogin 
              ? 'Continue your personalized interview prep journey.' 
              : 'Stop planning. Start preparing.'}
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[var(--color-forest-700)]-text mb-2">Name</label>
                <input 
                  type="text" 
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-4 py-3 rounded-[var(--radius-card)] focus:outline-none focus:border-primary/50 text-[var(--color-forest-700)]-text" 
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--color-forest-700)]-text mb-2">Email</label>
              <input 
                type="email" 
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-4 py-3 rounded-[var(--radius-card)] focus:outline-none focus:border-primary/50 text-[var(--color-forest-700)]-text" 
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-[var(--color-forest-700)]-text">Password</label>
                {isLogin && <a href="#" className="text-xs text-[var(--color-forest-700)] font-medium hover:underline">Forgot?</a>}
              </div>
              <input 
                type="password" 
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-4 py-3 rounded-[var(--radius-card)] focus:outline-none focus:border-primary/50 text-[var(--color-forest-700)]-text" 
                placeholder="••••••••"
              />
            </div>

            <Link to="/app" className="block w-full">
              <Button className="w-full py-4 rounded-[var(--radius-card)] text-base">{isLogin ? 'Sign In' : 'Create Account'}</Button>
            </Link>
          </form>

          <div className="mt-8 text-center text-sm text-[var(--color-navy-500)]">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Link to={isLogin ? '/signup' : '/login'} className="text-[var(--color-forest-700)] font-bold hover:underline">
              {isLogin ? 'Sign up' : 'Sign in'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
