import { Link, useLocation } from 'react-router-dom';
import { PageBackground } from '../components/ui/PageBackground';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Card } from '../components/ui/Card';

export function Auth() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-bg text-carbon-700 relative flex items-center justify-center p-6">
      <PageBackground />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-navy-900 rounded-card shadow-pop mb-6">
            <Icon name="school" className="text-3xl text-white" />
          </Link>
          <h1 className="text-3xl font-bold text-carbon-900 mb-2">
            {isLogin ? 'Sign in to PrepAmigo' : 'Create your PrepAmigo account'}
          </h1>
          <p className="text-carbon-500">
            {isLogin 
              ? 'Continue your personalized interview prep journey.' 
              : 'Stop planning. Start preparing.'}
          </p>
        </div>

        <Card variant="default" className="p-8 shadow-card">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-carbon-900 mb-2">Name</label>
                <input 
                  type="text" 
                  className="w-full bg-bg border border-border px-4 py-3 rounded-card focus:outline-none focus:border-forest-700/50 text-carbon-900" 
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-carbon-900 mb-2">Email</label>
              <input 
                type="email" 
                className="w-full bg-bg border border-border px-4 py-3 rounded-card focus:outline-none focus:border-forest-700/50 text-carbon-900" 
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-carbon-900">Password</label>
                {isLogin && <a href="#" className="text-xs text-forest-700 font-medium hover:underline">Forgot?</a>}
              </div>
              <input 
                type="password" 
                className="w-full bg-bg border border-border px-4 py-3 rounded-card focus:outline-none focus:border-forest-700/50 text-carbon-900" 
                placeholder="••••••••"
              />
            </div>

            <Link to="/app" className="block w-full">
              <Button variant="primary" className="w-full py-4 text-base">
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </Link>
          </form>

          <div className="mt-8 text-center text-sm text-carbon-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Link to={isLogin ? '/signup' : '/login'} className="text-forest-700 font-bold hover:underline">
              {isLogin ? 'Sign up' : 'Sign in'}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
