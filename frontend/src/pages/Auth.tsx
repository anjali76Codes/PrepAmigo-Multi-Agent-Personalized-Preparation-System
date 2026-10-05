import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageBackground } from '../components/ui/PageBackground';
import { Icon } from '../components/ui/Icon';
import { Mascot } from '../components/ui/Mascot';
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL || "";

async function handleGoogleAuth(
  credentialResponse: any,
  navigate: ReturnType<typeof useNavigate>,
  setError: (err: string | null) => void,
  setLoading: (loading: boolean) => void,
  initialQuery?: string
) {
  setError(null);
  setLoading(true);
  try {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken: credentialResponse.credential }),
    });

    const data = await res.json();
    if (res.ok) {
      navigate("/dashboard/chat", {
        state: initialQuery ? { initialQuery } : undefined,
      });
    } else {
      setError(data.error || "Google authentication failed");
    }
  } catch {
    setError("Network error. Please try again.");
  } finally {
    setLoading(false);
  }
}

type Errors = Partial<Record<'name' | 'email' | 'password', string>>;

const inputClass = (hasError: boolean) =>
  [
    'w-full bg-white border-2 px-4 py-3 rounded-card text-navy-900 transition-colors',
    'placeholder:text-navy-500/50',
    'focus:outline-none',
    hasError
      ? 'border-red-500/70 focus:border-red-500'
      : 'border-white hover:border-chrome-accent/40 focus:border-chrome-accent',
  ].join(' ');

function Field({
  id,
  label,
  error,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="text-sm font-bold text-navy-900">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Auth() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const isLogin = pathname === '/login';

  const initialQuery =
    (state as { initialQuery?: string })?.initialQuery ||
    sessionStorage.getItem("prepamigo_pending_query") ||
    undefined;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!isLogin && !name.trim()) next.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    else if (!isLogin && password.length < 8) next.password = 'Use at least 8 characters.';
    return next;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const body = isLogin
        ? { email, password }
        : { name, email, password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        navigate("/dashboard/chat", {
          state: initialQuery ? { initialQuery } : undefined,
        });
      } else {
        setFormError(data.error || (isLogin ? "Login failed" : "Signup failed"));
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-carbon-700 relative flex items-center justify-center p-6 sm:p-10 perspective-[2000px]">
      <PageBackground />

      <AnimatePresence mode="wait">
        <motion.div
          key={isLogin ? 'login' : 'signup'}
          initial={{ rotateY: 90, opacity: 0, scale: 0.95 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          exit={{ rotateY: -90, opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="relative z-10 w-full max-w-[64rem] bg-lavender-100 rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col md:flex-row border border-white/50"
        >
          {/* Brand Panel */}
          <aside className="w-full md:w-1/2 bg-navy-900 text-white p-10 lg:p-16 flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-navy-800 to-navy-900 pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-chrome-accent/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-chrome-accent/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <Link to="/" className="inline-flex items-center gap-3 w-fit mb-12 hover:opacity-80 transition-opacity">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-white/10 shadow-sm border border-white/10">
                  <Icon name="school" className="text-2xl text-white" />
                </span>
                <span className="text-2xl font-bold tracking-tight">PrepAmigo</span>
              </Link>

              <div className="mb-10 p-6 bg-white/5 rounded-full border border-white/10 shadow-lg backdrop-blur-sm relative">
                <div className="absolute inset-0 bg-chrome-accent/10 rounded-full animate-pulse" />
                <Mascot
                  size="lg"
                  variant={isLogin ? 'OK.png' : 'Thinking.png'}
                  className="relative z-10"
                />
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold leading-[1.2] tracking-tight mb-4">
                {isLogin ? "Welcome back!" : "Ready to ace your interview?"}
              </h2>
              <p className="text-white/70 text-lg max-w-sm">
                {isLogin
                  ? "Your personalized prep journey is waiting for you."
                  : "We'll build a tailored roadmap just for you."}
              </p>
            </div>
          </aside>

          {/* Form Panel */}
          <main className="w-full md:w-1/2 p-10 lg:p-16 flex flex-col justify-center bg-white">
            <div className="w-full max-w-md mx-auto">
              <Link
                to="/"
                className="lg:hidden inline-flex items-center justify-center w-12 h-12 bg-navy-900 rounded-card shadow-pop mb-8"
                aria-label="PrepAmigo home"
              >
                <Icon name="school" className="text-2xl text-white" />
              </Link>

              <h1 className="text-4xl font-extrabold text-navy-900 tracking-tight mb-2">
                {isLogin ? 'Sign In' : 'Create Account'}
              </h1>
              <p className="text-navy-700 mb-8 font-medium">
                {isLogin
                  ? 'Enter your details to continue.'
                  : 'Start preparing in seconds.'}
              </p>

              {formError && (
                <div className="mb-6 p-3 rounded-card bg-red-500/10 border border-red-500/20 text-red-600 text-sm font-medium text-center">
                  {formError}
                </div>
              )}

              <div className="mb-6 flex flex-col items-center">
                <GoogleLogin
                  onSuccess={(res) => handleGoogleAuth(res, navigate, setFormError, setLoading, initialQuery)}
                  onError={() => setFormError("Google Sign In was cancelled or failed")}
                  shape="pill"
                  text={isLogin ? "signin_with" : "signup_with"}
                />
              </div>

              <div className="relative my-6 flex items-center justify-center">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="bg-white px-3 text-xs font-bold text-navy-500 uppercase tracking-wider absolute">
                  or with email
                </span>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                {!isLogin && (
                  <Field id="name" label="Name" error={errors.name}>
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      className={inputClass(!!errors.name)}
                      placeholder="Jane Doe"
                    />
                  </Field>
                )}

                <Field id="email" label="Email" error={errors.email}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={inputClass(!!errors.email)}
                    placeholder="jane@example.com"
                  />
                </Field>

                <Field
                  id="password"
                  label="Password"
                  error={errors.password}
                  aside={
                    isLogin && (
                      <a href="#" className="text-sm text-navy-500 font-bold hover:text-chrome-accent transition-colors">
                        Forgot password?
                      </a>
                    )
                  }
                >
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      className={`${inputClass(!!errors.password)} pr-12`}
                      placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-navy-500 hover:text-navy-900 rounded-r-card focus:outline-none"
                    >
                      <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} className="text-xl" />
                    </button>
                  </div>
                </Field>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 text-base font-bold bg-slate-900 text-white rounded-card hover:bg-black transition-colors shadow-pop"
                >
                  {loading
                    ? isLogin
                      ? 'Signing in…'
                      : 'Creating account…'
                    : isLogin
                      ? 'Sign in'
                      : 'Create account'}
                </button>
              </form>

              <p className="mt-8 text-sm font-medium text-navy-700">
                {isLogin ? 'New to PrepAmigo? ' : 'Already have an account? '}
                <Link
                  to={isLogin ? '/signup' : '/login'}
                  className="text-chrome-accent font-extrabold hover:underline drop-shadow-sm"
                >
                  {isLogin ? 'Create an account' : 'Sign in'}
                </Link>
              </p>
            </div>
          </main>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}