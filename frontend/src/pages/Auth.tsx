import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const navigate = useNavigate();
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-center">Welcome Back</h1>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); navigate('/app/chat'); }}>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" placeholder="Enter your email" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <Input type="password" placeholder="Enter your password" />
        </div>
        <Button className="w-full" type="submit">Sign In</Button>
      </form>
    </div>
  );
}

export function Signup() {
  const navigate = useNavigate();
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-center">Create an Account</h1>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); navigate('/app/chat'); }}>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input type="text" placeholder="Enter your name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" placeholder="Enter your email" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <Input type="password" placeholder="Create a password" />
        </div>
        <Button className="w-full" type="submit">Sign Up</Button>
      </form>
    </div>
  );
}
