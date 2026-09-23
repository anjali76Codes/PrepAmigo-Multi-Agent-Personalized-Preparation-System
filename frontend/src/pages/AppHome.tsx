import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export function AppHome() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.95, y: shouldReduceMotion ? 0 : 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-md w-full space-y-8"
      >
        <div className="space-y-4">
          <motion.div variants={itemVariants} className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary mb-6">
            <Icon name="sparkles" className="text-3xl text-white" />
          </motion.div>
          <motion.h1 variants={itemVariants} className="text-3xl md:text-4xl font-bold tracking-tight">Welcome back.</motion.h1>
          <motion.p variants={itemVariants} className="text-lg text-secondary-text">
            What changed with your trip?
          </motion.p>
        </div>

        <motion.div variants={itemVariants}>
          <Button
            onClick={() => navigate('/app/chat')}
            className="rounded-full h-14 px-8 text-lg w-full max-w-xs shadow-glow-accent"
          >
            Tell kaju
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
