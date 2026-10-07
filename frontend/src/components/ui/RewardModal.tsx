import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icon';
import { Button } from './Button';

export interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  xpEarned?: number;
  trophyUnlocked?: {
    name: string;
    tier: string;
    description: string;
  };
  badgeUnlocked?: {
    name: string;
    description: string;
  };
}

export function RewardModal({
  isOpen,
  onClose,
  title,
  subtitle,
  xpEarned,
  trophyUnlocked,
  badgeUnlocked,
}: RewardModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full border border-border shadow-2xl text-center relative overflow-hidden"
          >
            {/* Animated glowing background accent */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-yellow-400/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-chrome/20 rounded-full blur-3xl" />

            {/* Icon showcase */}
            <div className="relative z-10 mx-auto w-24 h-24 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center text-white text-5xl shadow-xl shadow-amber-500/30 mb-5 animate-bounce">
              <Icon name={trophyUnlocked ? 'trophy' : badgeUnlocked ? 'medal' : 'star'} />
            </div>

            <h2 className="text-2xl font-black text-carbon-900 tracking-tight relative z-10">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-carbon-500 mt-1 relative z-10">
                {subtitle}
              </p>
            )}

            {/* XP Earned pill */}
            {xpEarned && (
              <div className="my-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm relative z-10">
                <Icon name="star" className="text-yellow-500 text-xl" />
                <span className="text-lg font-black">+{xpEarned} XP</span>
                <span className="text-xs text-amber-700 font-semibold">
                  ({Math.floor(xpEarned / 10)} AI Credits)
                </span>
              </div>
            )}

            {/* Trophy or Badge Info */}
            {trophyUnlocked && (
              <div className="mb-5 p-4 rounded-2xl bg-lavender-50 border border-chrome-accent/40 text-left relative z-10">
                <span className="text-[10px] font-black tracking-wider uppercase text-chrome">
                  Trophy Unlocked · {trophyUnlocked.tier}
                </span>
                <h4 className="text-base font-bold text-navy-900 mt-0.5">
                  {trophyUnlocked.name}
                </h4>
                <p className="text-xs text-carbon-600 mt-1">
                  {trophyUnlocked.description}
                </p>
              </div>
            )}

            {badgeUnlocked && (
              <div className="mb-5 p-4 rounded-2xl bg-purple-50 border border-purple-200 text-left relative z-10">
                <span className="text-[10px] font-black tracking-wider uppercase text-purple-700">
                  Badge Unlocked
                </span>
                <h4 className="text-base font-bold text-purple-950 mt-0.5">
                  {badgeUnlocked.name}
                </h4>
                <p className="text-xs text-purple-800/80 mt-1">
                  {badgeUnlocked.description}
                </p>
              </div>
            )}

            <div className="relative z-10 pt-2">
              <Button
                variant="primary"
                onClick={onClose}
                className="w-full py-3 rounded-xl font-bold shadow-lg"
              >
                Claim & Continue
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
