import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PrepCard } from '../components/preps/PrepCard';
import { useAppContext } from '../context/AppContext';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';

export function Preps() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const { preps: mockPreps } = useAppContext();
  if (mockPreps.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
          <Icon name="rocket-outline" className="text-4xl" />
        </div>
        <h2 className="text-2xl font-bold text-primary-text mb-2">No Preps Yet</h2>
        <p className="text-secondary-text mb-8 text-center max-w-md">
          Tell PrepAmigo where you want to go. It figures out what you need to learn next.
        </p>
        <Button onClick={() => navigate('/app/chat')} size="lg" className="rounded-full shadow-md hover:shadow-lg">
          Start a new prep
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background safe-area-bottom">
      <div className="max-w-4xl mx-auto space-y-12 pb-24 md:pb-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary-text mb-2">Your Preps</h1>
              <p className="text-secondary-text">Track your learning journeys.</p>
            </div>
            <Button onClick={() => navigate('/app/chat')} className="rounded-full hidden md:flex">
              New Prep
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {mockPreps.map(prep => (
              <motion.div key={prep.id} variants={itemVariants}>
                <PrepCard prep={prep} onClick={(id) => navigate(`/app/preps/${id}`)} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
