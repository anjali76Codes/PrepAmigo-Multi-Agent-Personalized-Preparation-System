import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageBackground } from '../components/ui/PageBackground';
import { Icon } from '../components/ui/Icon';
import { Mascot } from '../components/ui/Mascot';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Logo } from '../components/ui/Logo';
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL || "";

async function handleGoogleAuth(
  credentialResponse: any,
  navigate: ReturnType<typeof useNavigate>,
  setError: (err: string | null) => void,
  setLoading: (loading: boolean) => void,
  setUser: (user: any) => void,
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
      sessionStorage.removeItem("prepamigo_onboarding_skipped");
      if (data.user) {
        setUser(data.user);
      }
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

const INPUT_SIZE = 'h-12 text-base px-4';

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
        <label htmlFor={id} className="text-sm font-semibold text-carbon-900">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger-600">
          <Icon name="alert-circle-outline" className="text-sm" />
          {error}
        </p>
      )}
    </div>
  );
}

export function Auth() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const { setUser, refreshUser } = useAuth();
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
        sessionStorage.removeItem("prepamigo_onboarding_skipped");
        if (data.user) {
          setUser(data.user);
        } else {
          await refreshUser();
        }
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
    <div className="min-h-screen bg-bg text-carbon-700 relative flex items-center justify-center p-4 sm:p-10 perspective-[2000px]">
      <PageBackground />

      <AnimatePresence mode="wait">
        <motion.div
          key={isLogin ? 'login' : 'signup'}
          initial={{ rotateY: 90, opacity: 0, scale: 0.95 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          exit={{ rotateY: -90, opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="relative z-10 w-full max-w-5xl"
        >
          <Card
            variant="default"
            className="rounded-[2.5rem] shadow-pop overflow-hidden flex flex-col md:flex-row md:min-h-[75vh] min-h-[75vh]"
          >
            {/* Brand Panel */}
            <aside className="hidden md:flex w-1/2 bg-deep-emerald text-on-chrome p-12 lg:p-14 flex-col items-center justify-center text-center">
              <Link to="/" className="mb-8 hover:opacity-80 transition-opacity" aria-label="PrepAmigo home">
                <Logo tone="inverse" />
              </Link>

              <div className="mb-8 w-56 h-56 rounded-full bg-chrome flex items-center justify-center">
                <Mascot
                  size="xl"
                  variant={isLogin ? 'Motivated.png' : 'hi.png'}
                  style={{ width: 180, height: 180 }}
                />
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight mb-3">
                {isLogin ? 'Welcome back!' : 'Ready to ace your interview?'}
              </h2>
              <p className="text-on-chrome-muted text-lg max-w-sm">
                {isLogin
                  ? 'Your personalized prep journey is waiting for you.'
                  : "We'll build a tailored roadmap just for you."}
              </p>
            </aside>

            {/* Form Panel */}
            <main className="w-full md:w-1/2 bg-surface p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
              <div className="w-full max-w-md mx-auto">
                <Link to="/" className="md:hidden inline-block mb-6" aria-label="PrepAmigo home">
                  <Logo />
                </Link>

                <h1 className="text-3xl sm:text-4xl font-extrabold text-carbon-900 mb-2 text-center">
                  {isLogin ? 'Sign In' : 'Create Account'}
                </h1>
                <p className="text-carbon-500 mb-7 font-medium text-center">
                  {isLogin ? 'Enter your details to continue.' : 'Start preparing in seconds.'}
                </p>

                {formError && (
                  <div
                    role="alert"
                    className="mb-6 flex items-start gap-2.5 p-3.5 rounded-control bg-danger-100 border border-danger-600/20 text-danger-600 text-sm font-medium"
                  >
                    <Icon name="warning-outline" className="text-lg shrink-0 mt-px" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <GoogleLogin
                    onSuccess={(res) => handleGoogleAuth(res, navigate, setFormError, setLoading, setUser, initialQuery)}
                    onError={() => setFormError("Google Sign In was cancelled or failed")}
                    shape="pill"
                    text={isLogin ? "signin_with" : "signup_with"}
                  />
                </div>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-carbon-500 uppercase tracking-wider">or with email</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                  {!isLogin && (
                    <Field id="name" label="Name" error={errors.name}>
                      <Input
                        id="name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={!!errors.name}
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                        className={INPUT_SIZE}
                        placeholder="Jane Doe"
                      />
                    </Field>
                  )}

                  <Field id="email" label="Email" error={errors.email}>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      error={!!errors.email}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      className={INPUT_SIZE}
                      placeholder="jane@example.com"
                    />
                  </Field>

                  <Field
                    id="password"
                    label="Password"
                    error={errors.password}
                    aside={
                      isLogin && (
                        <a href="#" className="text-sm text-chrome font-semibold hover:underline">
                          Forgot password?
                        </a>
                      )
                    }
                  >
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={!!errors.password}
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? 'password-error' : undefined}
                        className={`${INPUT_SIZE} pr-12`}
                        placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-carbon-500 hover:text-carbon-900 rounded-r-control focus:outline-none"
                      >
                        <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} className="text-xl" />
                      </button>
                    </div>
                  </Field>

                  <Button type="submit" size="lg" loading={loading} className="w-full text-base font-semibold shadow-pop">
                    {loading
                      ? isLogin ? 'Signing in…' : 'Creating account…'
                      : isLogin ? 'Sign in' : 'Create account'}
                  </Button>
                </form>

                <p className="mt-7 text-sm font-medium text-carbon-500 text-center">
                  {isLogin ? 'New to PrepAmigo? ' : 'Already have an account? '}
                  <Link
                    to={isLogin ? '/signup' : '/login'}
                    className="text-chrome font-bold hover:underline"
                  >
                    {isLogin ? 'Create an account' : 'Sign in'}
                  </Link>
                </p>
              </div>
            </main>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}