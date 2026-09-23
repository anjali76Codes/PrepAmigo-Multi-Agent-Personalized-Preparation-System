import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export function AppHome() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-700">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary mb-6">
            <Icon name="sparkles" className="text-3xl text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Welcome back.</h1>
          <p className="text-lg text-secondary-text">
            What changed with your trip?
          </p>
        </div>

        <Button 
          onClick={() => navigate('/app/chat')}
          className="rounded-full h-14 px-8 text-lg w-full max-w-xs shadow-glow-accent"
        >
          Tell kaju
        </Button>
      </div>
    </div>
  );
}
