import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface RevealStaggerProps {
  children: ReactNode;
  className?: string;
  delayOffset?: number;
}

export function RevealStagger({ children, className, delayOffset = 0.1 }: RevealStaggerProps) {
  const shouldReduceMotion = useReducedMotion();

  const container = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : delayOffset,
      },
    },
  };

  // We need to pass variants to children, assuming children are motion components,
  // but to keep it simple and compatible with normal children, we just wrap them in motion.div if we map them.
  // Actually, standard framer-motion stagger requires children to have variants.
  // Instead, let's just make RevealStagger a context or require children to be <RevealStaggerItem>.

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealStaggerItem({ children, className }: { children: ReactNode, className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  const item = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0, scale: shouldReduceMotion ? 1 : 0.95 },
    show: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 260,
        damping: 20,
      },
    },
  };

  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}
