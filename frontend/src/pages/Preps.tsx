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
        <RevealStagger className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <RevealStaggerItem>
            <h1 className="text-3xl font-bold text-carbon-900">Your Preps</h1>
            <p className="text-carbon-500">Manage your active and completed roadmaps.</p>
          </RevealStaggerItem>
          
          <RevealStaggerItem>
            <Button variant="primary" className="shadow-pop">
              <Icon name="add" className="text-lg" /> New Prep
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
          <Card variant="dashed" className="p-12 text-center text-carbon-500 hover:text-carbon-900 hover:border-carbon-900 transition-colors cursor-pointer border-dashed border-2">
            <Icon name="add-circle-outline" className="text-4xl mb-2" />
            <p className="font-medium">Create a new Prep</p>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
