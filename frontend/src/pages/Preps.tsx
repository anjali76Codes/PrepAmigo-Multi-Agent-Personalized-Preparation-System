import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { PrepCard } from '../components/preps/PrepCard';
import { useAppContext } from '../context/AppContext';
import { Mascot } from '../components/ui/Mascot';

export function Preps() {
  const { preps } = useAppContext();

  return (
    <div className="flex-1 overflow-y-auto bg-bg h-full text-carbon-700">
      <div className="p-4 md:p-8 max-w-[85vw] mx-auto space-y-8 pb-20">
        <RevealStagger className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-navy-900 rounded-[2rem] p-8 md:p-12 shadow-pop text-white relative overflow-hidden">
          <div className="relative z-10 hidden sm:block shrink-0 opacity-20 absolute right-0 bottom-0 pointer-events-none translate-x-4 translate-y-4">
            <Mascot size="lg" variant="OK.png" />
          </div>
          <RevealStaggerItem className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">Your Preps</h1>
            <p className="text-navy-100/70 text-base md:text-lg">Manage your active and completed roadmaps.</p>
          </RevealStaggerItem>

          <RevealStaggerItem>
            <Link to="/dashboard/chat">
              <Button variant="primary" className="bg-chrome-accent hover:bg-chrome-accent/90 text-chrome border-none rounded-full shadow-pop">
                <Icon name="add" className="text-xl mr-1" /> New Prep
              </Button>
            </Link>
          </RevealStaggerItem>
        </RevealStagger>

        <RevealStagger className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {preps.map((prep) => (
            <RevealStaggerItem key={prep.id}>
              <Link to={`/dashboard/preps/${prep.id}`} className="block group">
                <PrepCard prep={prep} onClick={() => { }} />
              </Link>
            </RevealStaggerItem>
          ))}
        </RevealStagger>


      </div>
    </div>
  );
}
