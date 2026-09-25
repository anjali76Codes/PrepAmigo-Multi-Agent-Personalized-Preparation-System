import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL || "";

async function handleGoogleAuth(
  credentialResponse: any,
  navigate: ReturnType<typeof useNavigate>,
  setError: (err: string | null) => void,
  setLoading: (loading: boolean) => void
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
      navigate("/app/chat");
    } else {
      setError(data.error || "Google authentication failed");
    }
  } catch {
    setError("Network error. Please try again.");
  } finally {
    setLoading(false);
  }
}

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        navigate("/app/chat");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-center">Welcome Back</h1>
      <p className="text-sm text-secondary-text mb-6 text-center">
        Sign in to your TravelAmigo account
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col items-center gap-2">
        <GoogleLogin
          onSuccess={(res) => handleGoogleAuth(res, navigate, setError, setLoading)}
          onError={() => setError("Google Sign In was cancelled or failed")}
          shape="pill"
          theme="filled_black"
          text="continue_with"
        />
      </div>

      <div className="relative my-6 flex items-center justify-center">
        <div className="border-t border-border w-full"></div>
        <span className="bg-surface px-3 text-xs text-secondary-text uppercase tracking-wider absolute">
          or with email
        </span>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium mb-1 text-secondary-text">Email</label>
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-secondary-text">Password</label>
          <Input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button className="w-full mt-2 font-semibold" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-secondary-text">
        Don't have an account?{" "}
        <Link to="/signup" className="text-accent hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        navigate("/app/chat");
      } else {
        setError(data.error || "Signup failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-center">Create an Account</h1>
      <p className="text-sm text-secondary-text mb-6 text-center">
        Join TravelAmigo to coordinate your journeys
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col items-center gap-2">
        <GoogleLogin
          onSuccess={(res) => handleGoogleAuth(res, navigate, setError, setLoading)}
          onError={() => setError("Google Sign In was cancelled or failed")}
          shape="pill"
          theme="filled_black"
          text="signup_with"
        />
      </div>

      <div className="relative my-6 flex items-center justify-center">
        <div className="border-t border-border w-full"></div>
        <span className="bg-surface px-3 text-xs text-secondary-text uppercase tracking-wider absolute">
          or sign up with email
        </span>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium mb-1 text-secondary-text">Name</label>
          <Input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-secondary-text">Email</label>
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-secondary-text">Password</label>
          <Input
            type="password"
            placeholder="Create a password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button className="w-full mt-2 font-semibold" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-secondary-text">
        Already have an account?{" "}
        <Link to="/login" className="text-accent hover:underline font-medium">
          Log in
        </Link>
      </p>
    </div>
  );
}
