import { useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

const R = 'round 2rem';

export const CLIPS = {
    center: [`inset(0% 50% 0% 50% ${R})`, `inset(0% 0% 0% 0% ${R})`],
    bottom: [`inset(100% 0% 0% 0% ${R})`, `inset(0% 0% 0% 0% ${R})`],
    left: [`inset(0% 100% 0% 0% ${R})`, `inset(0% 0% 0% 0% ${R})`],
    right: [`inset(0% 0% 0% 100% ${R})`, `inset(0% 0% 0% 0% ${R})`],
} as const;

export function RevealCard({
    from,
    className,
    children,
}: {
    from: keyof typeof CLIPS;
    className: string;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start end', 'center 70%'],
    });

    const clipPath = useTransform(scrollYProgress, [0, 1], [...CLIPS[from]]);
    const innerScale = useTransform(scrollYProgress, [0, 1], [1.15, 1]);

    return (
        <motion.div
            ref={ref}
            style={reduce ? undefined : { clipPath }}
            className={`relative min-h-[300px] ${className}`}
        >
            <motion.div
                style={reduce ? undefined : { scale: innerScale }}
                className="flex h-full flex-col p-8"
            >
                {children}
            </motion.div>
        </motion.div>
    );
}

export function CardText({ title, desc, muted }: { title: string; desc: string; muted: string }) {
    return (
        <>
            <h3 className="mb-2 text-2xl font-bold">{title}</h3>
            <p className={`mb-6 max-w-sm text-sm leading-relaxed ${muted}`}>{desc}</p>
        </>
    );
}
