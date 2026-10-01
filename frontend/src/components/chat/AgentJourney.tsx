import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Mascot } from '../ui/Mascot'; // adjust path if needed
import { cn } from '../../lib/utils';

export interface JourneyStep {
    agent: string;
    text: string;
}

export interface JourneyAction {
    label: string;
    to?: string;          // renders a router Link
    onClick?: () => void; // or a plain click handler
}

interface AgentJourneyProps {
    steps: JourneyStep[];
    activeIndex?: number;
    autoPlay?: boolean;
    stepDuration?: number;
    finishText?: string;
    maxHeight?: string;
    finalAction?: JourneyAction; // NEW: button shown under the last node
    onComplete?: () => void;
    className?: string;
}

const NODE = 36;
const MASCOT = 56;
const TOP_PAD = MASCOT + 22;
const BOTTOM_PAD = 34;
const ACTION_EXTRA = 48;       // NEW: extra room under the last node for the button
const ACTION_TOP_GAP = 24;     // NEW: distance from node bottom to button top
const SIDE_PAD = 40;
const BUBBLE_GAP = 8;
const MAX_ROW = 100;
const CARD_PAD = 24;

const WIGGLE = [0.08, 0.55, 0.95, 0.5, 0.06, 0.5];

export function AgentJourney({
    steps,
    activeIndex,
    autoPlay = false,
    stepDuration = 1800,
    finishText = 'All done! ',
    maxHeight = '70vh',
    finalAction,
    onComplete,
    className,
}: AgentJourneyProps) {
    const [internal, setInternal] = useState(0);
    const [size, setSize] = useState({ w: 320, h: 380 });
    const mapRef = useRef<HTMLDivElement>(null);

    const controlled = activeIndex !== undefined;
    const current = controlled ? activeIndex! : internal;
    const total = steps.length;
    const finished = current >= total;

    useLayoutEffect(() => {
        const el = mapRef.current;
        if (!el) return;
        const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (controlled || !autoPlay || internal >= total) return;
        const t = setTimeout(() => setInternal((i) => i + 1), stepDuration);
        return () => clearTimeout(t);
    }, [controlled, autoPlay, internal, total, stepDuration]);

    useEffect(() => {
        if (finished && total > 0) onComplete?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finished]);

    const { w: width, h: height } = size;

    const bottomPad = BOTTOM_PAD + (finalAction ? ACTION_EXTRA : 0);
    const rows = Math.max(total - 1, 1);
    const ROW = Math.min(MAX_ROW, Math.max((height - TOP_PAD - bottomPad) / rows, 34));
    const naturalHeight = TOP_PAD + rows * MAX_ROW + bottomPad + CARD_PAD;

    const usable = Math.max(width - SIDE_PAD * 2, 1);
    const points = steps.map((_, i) => ({
        x: SIDE_PAD + WIGGLE[i % WIGGLE.length] * usable,
        y: TOP_PAD + i * ROW,
    }));

    const segment = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        const k = ROW * 0.6;
        return `M ${a.x} ${a.y} C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`;
    };

    const mascotIndex = Math.min(Math.max(current, 0), total - 1);
    const mp = points[mascotIndex] ?? { x: 0, y: 0 };
    const mascotX = Math.min(Math.max(mp.x - MASCOT / 2, 0), Math.max(width - MASCOT, 0));
    const mascotY = mp.y - 10 - MASCOT;
    const bubbleSide: 'left' | 'right' = mp.x > width / 2 ? 'left' : 'right';
    const spaceRight = width - (mascotX + MASCOT + BUBBLE_GAP) - 4;
    const spaceLeft = mascotX - BUBBLE_GAP - 4;
    const bubbleMax = Math.max(Math.min(bubbleSide === 'right' ? spaceRight : spaceLeft, 210), 90);

    const mood = finished ? 'cheer' : current < 0 ? 'idle' : 'think';
    const bubbleText = finished ? finishText : steps[mascotIndex]?.text ?? '';
    const showBubble = current >= 0 || finished;

    // NEW: button position under the last node (clamped so it never overflows)
    const last = points[total - 1];
    const actionX = last ? Math.min(Math.max(last.x, 80), Math.max(width - 80, 80)) : 0;
    const actionY = last ? last.y + NODE / 2 + ACTION_TOP_GAP : 0;

    const actionClasses = cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-300',
        finished
            ? 'bg-navy-700 text-white shadow-md hover:bg-navy-700/90 cursor-pointer'
            : 'bg-carbon-500/10 text-carbon-500/50 border border-carbon-500/20 pointer-events-none'
    );

    const actionContent = (
        <>
            {finalAction?.label}
            <Icon name={finished ? 'arrow-forward-outline' : 'lock-closed-outline'} />
        </>
    );

    return (
        <div
            className={cn('w-full flex flex-col bg-surface border border-border rounded-card p-3', className)}
            style={{ height: `min(${maxHeight}, ${naturalHeight}px)` }}
        >
            <div ref={mapRef} className="relative w-full flex-1 min-h-0">
                {/* Winding pathway */}
                <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
                    {points.slice(0, -1).map((p, i) => {
                        const d = segment(p, points[i + 1]);
                        return (
                            <g key={i}>
                                <path
                                    d={d}
                                    fill="none"
                                    strokeWidth={4}
                                    strokeLinecap="round"
                                    strokeDasharray="2 10"
                                    className="text-carbon-500/40"
                                    stroke="currentColor"
                                />
                                <motion.path
                                    d={d}
                                    fill="none"
                                    strokeWidth={4}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    className="text-navy-700"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: i < current ? 1 : 0 }}
                                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                                />
                            </g>
                        );
                    })}
                </svg>

                {/* Nodes + labels */}
                {steps.map((step, i) => {
                    const p = points[i];
                    const isActive = i === current;
                    const isDone = i < current || finished;

                    return (
                        <div key={step.agent + i}>
                            <div
                                className="absolute"
                                style={{ left: p.x - NODE / 2, top: p.y - NODE / 2, width: NODE, height: NODE }}
                            >
                                {isActive && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-navy-700/30"
                                        animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
                                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                                    />
                                )}
                                <motion.div
                                    animate={{ scale: isActive ? 1.1 : 1 }}
                                    className={cn(
                                        'relative w-full h-full rounded-full border-2 flex items-center justify-center transition-colors duration-300 shadow-[0_4px_0_0_rgba(0,0,0,0.12)]',
                                        isDone && 'bg-navy-700 border-navy-700 text-white',
                                        isActive && 'bg-white border-navy-700 text-navy-700',
                                        !isDone && !isActive && 'bg-carbon-500/10 border-carbon-500/20 text-carbon-500/50'
                                    )}
                                >
                                    {isDone ? (
                                        <Icon name="checkmark-outline" />
                                    ) : (
                                        <span className="text-xs font-bold">{i + 1}</span>
                                    )}
                                </motion.div>
                            </div>

                            <div
                                className={cn(
                                    'absolute text-[10px] font-semibold text-center leading-tight truncate transition-colors duration-300',
                                    isActive ? 'text-carbon-900' : isDone ? 'text-navy-700' : 'text-carbon-500/50'
                                )}
                                style={{ left: p.x - 55, width: 110, top: p.y + NODE / 2 + 6 }}
                            >
                                {step.agent}
                            </div>
                        </div>
                    );
                })}

                {/* NEW: action button on the 6th node */}
                {finalAction && last && (
                    <motion.div
                        className="absolute z-10"
                        style={{ left: actionX, top: actionY, x: '-50%' }}
                        animate={finished ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        {finalAction.to ? (
                            <Link
                                to={finalAction.to}
                                onClick={finalAction.onClick}
                                aria-disabled={!finished}
                                tabIndex={finished ? 0 : -1}
                                className={actionClasses}
                            >
                                {actionContent}
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={finalAction.onClick}
                                disabled={!finished}
                                className={actionClasses}
                            >
                                {actionContent}
                            </button>
                        )}
                    </motion.div>
                )}

                {/* Mascot + its bubble */}
                <motion.div
                    className="absolute top-0 left-0 z-10"
                    style={{ width: MASCOT, height: MASCOT }}
                    initial={false}
                    animate={{ x: mascotX, y: mascotY }}
                    transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                >
                    <motion.div
                        animate={finished ? { y: [0, -8, 0] } : { rotate: [-4, 4, -4] }}
                        transition={{ duration: finished ? 0.6 : 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Mascot size="md" mood={mood} className="shadow-sm" style={{ width: MASCOT, height: MASCOT }} />
                    </motion.div>

                    <AnimatePresence mode="wait">
                        {showBubble && (
                            <motion.div
                                key={`${mascotIndex}-${finished}`}
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                                transition={{ duration: 0.25, delay: 0.45 }}
                                className="absolute w-max bg-navy-100 text-navy-700 text-xs font-medium px-3 py-2 rounded-card border border-navy-700/10 shadow-sm"
                                style={{
                                    top: 4,
                                    maxWidth: bubbleMax,
                                    ...(bubbleSide === 'right'
                                        ? { left: MASCOT + BUBBLE_GAP, transformOrigin: 'left center' }
                                        : { right: MASCOT + BUBBLE_GAP, transformOrigin: 'right center' }),
                                }}
                            >
                                <span
                                    className={cn(
                                        'absolute top-4 w-2 h-2 rotate-45 bg-navy-100 border-navy-700/10',
                                        bubbleSide === 'right' ? '-left-1 border-l border-b' : '-right-1 border-r border-t'
                                    )}
                                />
                                {bubbleText}
                                {!finished && (
                                    <span className="inline-flex ml-1 gap-0.5 align-middle">
                                        {[0, 1, 2].map((d) => (
                                            <motion.span
                                                key={d}
                                                className="w-1 h-1 rounded-full bg-navy-700"
                                                animate={{ opacity: [0.2, 1, 0.2] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                                            />
                                        ))}
                                    </span>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}