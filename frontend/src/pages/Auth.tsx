import { Link, useLocation } from 'react-router-dom';
import { PageBackground } from '../components/ui/PageBackground';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export function Auth() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-6">
      <PageBackground />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-xl shadow-primary/20 mb-6">
            <Icon name="school" className="text-3xl text-white" />
          </Link>
          <h1 className="text-3xl font-bold text-primary-text mb-2">
            {isLogin ? 'Sign in to PrepAmigo' : 'Create your PrepAmigo account'}
          </h1>
          <p className="text-secondary-text">
            {isLogin 
              ? 'Continue your personalized interview prep journey.' 
              : 'Stop planning. Start preparing.'}
          </p>
        </div>

        <div className="bg-surface border border-border p-8 rounded-3xl shadow-sm">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">Name</label>
                <input 
                  type="text" 
                  className="w-full bg-background border border-border px-4 py-3 rounded-xl focus:outline-none focus:border-primary/50 text-primary-text" 
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-primary-text mb-2">Email</label>
              <input 
                type="email" 
                className="w-full bg-background border border-border px-4 py-3 rounded-xl focus:outline-none focus:border-primary/50 text-primary-text" 
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-primary-text">Password</label>
                {isLogin && <a href="#" className="text-xs text-primary font-medium hover:underline">Forgot?</a>}
              </div>
              <input 
                type="password" 
                className="w-full bg-background border border-border px-4 py-3 rounded-xl focus:outline-none focus:border-primary/50 text-primary-text" 
                placeholder="••••••••"
              />
            </div>

            <Link to="/app" className="block w-full">
              <Button className="w-full py-4 rounded-xl text-base">{isLogin ? 'Sign In' : 'Create Account'}</Button>
            </Link>
          </form>

          <div className="mt-8 text-center text-sm text-secondary-text">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Link to={isLogin ? '/signup' : '/login'} className="text-primary font-bold hover:underline">
              {isLogin ? 'Sign up' : 'Sign in'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
