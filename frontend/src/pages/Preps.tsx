import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Reveal, RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { PrepCard } from '../components/preps/PrepCard';
import { useAppContext } from '../context/AppContext';

export function Preps() {
  const { preps } = useAppContext();

  return (
    <div className="flex-1 overflow-y-auto bg-bg h-full text-carbon-700">
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-20">
        <RevealStagger className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-navy-900 rounded-[2rem] p-8 md:p-12 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] text-white">
          <RevealStaggerItem>
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Your Preps</h1>
            <p className="text-navy-100/70 text-lg">Manage your active and completed roadmaps.</p>
          </RevealStaggerItem>
          
          <RevealStaggerItem>
            <Button variant="primary" className="bg-chrome-accent hover:bg-chrome-accent/90 text-chrome border-none rounded-xl shadow-pop">
              <Icon name="add" className="text-xl mr-1" /> New Prep
            </Button>
          </RevealStaggerItem>
        </RevealStagger>

        <RevealStagger className="space-y-6">
          {preps.map((prep) => (
            <RevealStaggerItem key={prep.id}>
              <Link to={`/app/preps/${prep.id}`} className="block group">
                <PrepCard prep={prep} onClick={() => {}} />
              </Link>
            </RevealStaggerItem>
          ))}
        </RevealStagger>
        
        <Reveal>
          <div className="bg-white rounded-[2rem] p-12 text-center text-carbon-500 hover:text-chrome-accent hover:border-chrome-accent transition-colors cursor-pointer border-dashed border-2 border-border flex flex-col items-center justify-center">
            <Icon name="add-circle-outline" className="text-5xl mb-4" />
            <p className="font-semibold text-lg">Create a new Prep</p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
