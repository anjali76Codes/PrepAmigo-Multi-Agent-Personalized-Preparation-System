import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, animate, useTransform } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Mascot } from '../ui/Mascot';
import { cn } from '../../lib/utils';
import { VIEW_W, VIEW_H, PATH_D, NODE_IMG, NODE_POSITIONS } from './AgentJourneyConstants';

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

const NODE_SIZE = 70;
const MASCOT_SIZE = 56;
const BUBBLE_GAP = 8;

export function AgentJourney({
    steps,
    activeIndex,
    autoPlay = false,
    stepDuration = 1800,
    finishText = 'All done! ',
    maxHeight = '65vh',
    finalAction,
    onComplete,
    className,
}: AgentJourneyProps) {
    const [internal, setInternal] = useState(0);
    const pathRef = useRef<SVGPathElement>(null);
    const [pointsPct, setPointsPct] = useState<{ x: number, y: number }[]>([]);

    const controlled = activeIndex !== undefined;
    const current = controlled ? activeIndex! : internal;
    const total = steps.length;
    const finished = current >= total;

    useLayoutEffect(() => {
        if (!pathRef.current) return;
        const len = pathRef.current.getTotalLength();
        const pts = steps.map((_, i) => {
            // The SVG is a traced outline (a loop), so the visual "end" of the path is at exactly 50% (0.5) of the total length.
            const baseFraction = NODE_POSITIONS[i] ?? Math.min(i / Math.max(steps.length - 1, 1), 1);
            const fraction = baseFraction * 0.5; // Scale down to max 0.5
            const p = pathRef.current!.getPointAtLength(fraction * len);

            // Apply the transform values from the original SVG path
            // (No transform needed for this new SVG)
            const transformedX = p.x;
            const transformedY = p.y;

            return {
                x: (transformedX / VIEW_W) * 100,
                y: (transformedY / VIEW_H) * 100
            };
        });
        setPointsPct(pts);
    }, [steps.length]);

    useEffect(() => {
        if (controlled || !autoPlay || internal >= total) return;
        const t = setTimeout(() => setInternal((i) => i + 1), stepDuration);
        return () => clearTimeout(t);
    }, [controlled, autoPlay, internal, total, stepDuration]);

    useEffect(() => {
        if (finished && total > 0) onComplete?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finished]);

    // calculate current path fraction for progress, capped at 0.5 because it's a loop
    const baseCurrentFraction = finished ? 1 : (NODE_POSITIONS[current] ?? Math.min(current / Math.max(total - 1, 1), 1));
    const currentFraction = baseCurrentFraction * 0.5;

    const mascotX = useMotionValue(50);
    const mascotY = useMotionValue(0);
    const mascotLeft = useTransform(mascotX, (v) => `${v}%`);
    const mascotTop = useTransform(mascotY, (v) => `${v}%`);

    useEffect(() => {
        if (!pathRef.current) return;
        const len = pathRef.current.getTotalLength();
        const controls = animate(mascotX.get() === 50 && mascotY.get() === 0 ? 0 : currentFraction, currentFraction, {
            duration: 0.8,
            ease: 'easeInOut',
            onUpdate: (v) => {
                const p = pathRef.current!.getPointAtLength(v * len);
                mascotX.set((p.x / VIEW_W) * 100);
                mascotY.set((p.y / VIEW_H) * 100);
            }
        });
        return controls.stop;
    }, [currentFraction]);

    const mascotIndex = Math.min(Math.max(current, 0), total - 1);
    const mp = pointsPct[mascotIndex] ?? { x: 50, y: 0 };
    const bubbleSide: 'left' | 'right' = mp.x > 50 ? 'left' : 'right';

    const mood = finished ? 'cheer' : current < 0 ? 'idle' : 'think';
    const bubbleText = finished ? finishText : steps[mascotIndex]?.text ?? '';
    const showBubble = current >= 0 || finished;

    const last = pointsPct[total - 1];

    const actionClasses = cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-300',
        finished
            ? 'bg-navy-700 text-white shadow-md hover:bg-navy-800 cursor-pointer'
            : 'bg-muted text-muted-foreground border border-border pointer-events-none'
    );

    const actionContent = (
        <>
            {finalAction?.label}
            <Icon name={finished ? 'arrow-forward-outline' : 'lock-closed-outline'} />
        </>
    );

    return (
        <div
            className={cn('w-full flex justify-center items-center bg-surface border border-border rounded-card p-4 overflow-hidden', className)}
        >
            <div className="relative w-full" style={{ height: maxHeight, minHeight: '300px' }}>
                {/* Winding pathway SVG */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                    preserveAspectRatio="none"
                >
                    {/* Background path (capped to 0.5 so it only draws the forward line of the outline loop) */}
                    <motion.path
                        ref={pathRef}
                        d={PATH_D}
                        fill="none"
                        strokeWidth={2}
                        strokeLinecap="round"
                        className="text-navy-700/20"
                        stroke="currentColor"
                        initial={{ pathLength: 0.5 }}
                    />
                    {/* Progress path */}
                    <motion.path
                        d={PATH_D}
                        fill="none"
                        strokeWidth={2}
                        strokeLinecap="round"
                        stroke="currentColor"
                        className="text-navy-700"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: currentFraction }}
                        transition={{ duration: 0.8, ease: 'easeInOut' }}
                    />
                </svg>

                {/* Nodes + labels */}
                {pointsPct.map((p, i) => {
                    const isActive = i === current;
                    const isDone = i < current || finished;

                    return (
                        <div
                            key={steps[i]?.agent + i}
                            className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                        >
                            <div className="relative flex items-center justify-center" style={{ width: NODE_SIZE, height: NODE_SIZE }}>
                                {isActive && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-navy-700/30"
                                        animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                                    />
                                )}
                                <motion.img
                                    src={NODE_IMG}
                                    alt="Node"
                                    animate={{ scale: isActive ? 1.2 : 1 }}
                                    className={cn(
                                        'relative w-full h-full object-contain transition-all duration-300',
                                        isDone && 'opacity-100 grayscale-0',
                                        isActive && 'opacity-100 grayscale-0',
                                        !isDone && !isActive && 'opacity-40 grayscale'
                                    )}
                                />
                                {isDone && (
                                    <div className="absolute top-0 right-0 bg-chrome-accent text-white rounded-full p-0.5 z-10 shadow-sm translate-x-1/4 -translate-y-1/4">
                                        <Icon name="checkmark-outline" className="w-4 h-4 px-1" />
                                    </div>
                                )}
                            </div>
                            <div
                                className={cn(
                                    'absolute text-[11px] font-bold text-center leading-tight whitespace-nowrap transition-colors duration-300',
                                    'bg-surface border border-border px-2.5 py-1 rounded-full shadow-sm',
                                    isActive ? 'text-foreground' : isDone ? 'text-navy-700' : 'text-muted-foreground'
                                )}
                                style={{ top: '100%', marginTop: 3 }}
                            >
                                {steps[i]?.agent}
                            </div>
                        </div>
                    );
                })}

                {/* Action button on the last node */}
                {finalAction && last && (
                    <motion.div
                        className="absolute z-10 flex justify-center -translate-x-1/2 mt-[68px]"
                        style={{ left: `${last.x}%`, top: `${last.y}%` }}
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
                {pointsPct.length > 0 && (
                    <motion.div
                        className="absolute z-10 -translate-x-1/2 -translate-y-full mb-6"
                        style={{ left: mascotLeft, top: mascotTop, width: MASCOT_SIZE, height: MASCOT_SIZE }}
                    >
                        <motion.div
                            animate={finished ? { y: [0, -8, 0] } : { rotate: [-4, 4, -4] }}
                            transition={{ duration: finished ? 0.6 : 1.6, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-full h-full flex justify-center items-center"
                        >
                            <Mascot size="md" mood={mood} className="shadow-sm" style={{ width: MASCOT_SIZE, height: MASCOT_SIZE }} />
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {showBubble && (
                                <motion.div
                                    key={`${mascotIndex}-${finished}`}
                                    initial={{ opacity: 0, scale: 0.85 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                                    transition={{ duration: 0.25, delay: 0.45 }}
                                    className="absolute w-max max-w-[210px] bg-navy-700 text-white text-xs font-medium px-3 py-2 rounded-card shadow-sm top-0"
                                    style={{
                                        ...(bubbleSide === 'right'
                                            ? { left: '100%', marginLeft: BUBBLE_GAP, transformOrigin: 'left center' }
                                            : { right: '100%', marginRight: BUBBLE_GAP, transformOrigin: 'right center' }),
                                    }}
                                >
                                    <span
                                        className={cn(
                                            'absolute top-4 w-2 h-2 rotate-45 bg-navy-700',
                                            bubbleSide === 'right' ? '-left-1 border-l border-b' : '-right-1 border-r border-t'
                                        )}
                                    />
                                    {bubbleText}
                                    {!finished && (
                                        <span className="inline-flex ml-1 gap-0.5 align-middle">
                                            {[0, 1, 2].map((d) => (
                                                <motion.span
                                                    key={d}
                                                    className="w-1 h-1 rounded-full bg-white"
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
                )}
            </div>
        </div>
    );
}