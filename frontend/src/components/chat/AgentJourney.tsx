import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, animate, useTransform } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Mascot, type MascotVariant } from '../ui/Mascot';
import { cn } from '../../lib/utils';
import { VIEW_W, VIEW_H, PATH_D, NODE_IMG } from './AgentJourneyConstants';

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
    interactive?: boolean;
    onNodeClick?: (levelId: string, index: number) => void;
    nodeStates?: ('completed' | 'current' | 'locked' | 'upcoming')[];
    nodeCount?: number;
    showMascot?: boolean;
    minHeight?: string;
}

const NODE_SIZE = 80;
const MASCOT_SIZE = 90;
const BUBBLE_GAP = 10;

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
    interactive = false,
    onNodeClick,
    nodeStates,
    nodeCount: propNodeCount,
    showMascot = true,
    minHeight = '300px',
}: AgentJourneyProps) {
    const [internal, setInternal] = useState(0);
    const pathRef = useRef<SVGPathElement>(null);
    const [pointsPct, setPointsPct] = useState<{ x: number, y: number }[]>([]);

    const derivedNodeCount = nodeStates ? nodeStates.length : (propNodeCount ?? Math.max(3, Math.min(steps.length, 7)));
    const nodeCount = Math.max(3, Math.min(7, derivedNodeCount || 5));

    const controlled = activeIndex !== undefined;
    const idx = nodeStates ? nodeStates.indexOf('current') : -1;
    const derivedCurrent = nodeStates
        ? (idx !== -1 ? idx : (nodeStates.every(s => s === 'completed') ? nodeCount : 0))
        : -1;
    const current = controlled ? activeIndex! : (derivedCurrent !== -1 ? derivedCurrent : internal);
    const total = nodeStates ? nodeCount : steps.length;
    const finished = current >= total;

    useLayoutEffect(() => {
        if (!pathRef.current) return;
        const len = pathRef.current.getTotalLength();
        const count = Math.max(nodeCount, 2);
        const pts = Array.from({ length: nodeCount }).map((_, i) => {
            // The SVG is a traced outline (a loop), so the visual "end" of the path is at exactly 50% (0.5) of the total length.
            const baseFraction = i / (count - 1);
            const fraction = baseFraction * 0.5; // Scale down to max 0.5
            const p = pathRef.current!.getPointAtLength(fraction * len);

            return {
                x: (p.x / VIEW_W) * 100,
                y: (p.y / VIEW_H) * 100
            };
        });
        setPointsPct(pts);
    }, [nodeCount]);

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
    const baseCurrentFraction = finished ? 1 : Math.min(current / Math.max(nodeCount - 1, 1), 1);
    const currentFraction = baseCurrentFraction * 0.5;

    const mascotX = useMotionValue(50);
    const mascotY = useMotionValue(0);
    const fraction = useMotionValue(0);
    const mascotLeft = useTransform(mascotX, (v) => `${v}%`);
    const mascotTop = useTransform(mascotY, (v) => `${v}%`);

    useEffect(() => {
        if (!pathRef.current) return;
        const len = pathRef.current.getTotalLength();
        let cancelled = false;
        const controls = animate(fraction, currentFraction, {
            duration: 1.5,
            ease: 'easeInOut',
            onUpdate: (v) => {
                if (cancelled || !pathRef.current) return;
                const p = pathRef.current.getPointAtLength(v * len);
                mascotX.set((p.x / VIEW_W) * 100);
                mascotY.set((p.y / VIEW_H) * 100);
            }
        });
        return () => {
            cancelled = true;
            controls.stop();
        };
    }, [currentFraction]);

    const mascotIndex = Math.min(Math.max(current, 0), total - 1);
    const mp = pointsPct[mascotIndex] ?? { x: 50, y: 0 };
    const bubbleSide: 'left' | 'right' = mp.x > 50 ? 'left' : 'right';

    const MASCOT_VARIANTS: MascotVariant[] = ["Chilling.png", "Chilling.png", "thinking.gif", "working.gif", "Thinking.png", "Motivated.png"];
    const currentMascotVariant = MASCOT_VARIANTS[mascotIndex] || "OK.png";
    const bubbleText = finished ? finishText : steps[mascotIndex]?.text ?? '';
    const showBubble = (current >= 0 || finished) && bubbleText;

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
            className={cn('w-full flex justify-center items-center bg-surface border border-border rounded-card p-4 overflow-hidden', className, interactive && 'pb-8')}
        >
            <div className="relative w-full" style={{ height: maxHeight, minHeight }}>
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
                    const isActive = nodeStates ? nodeStates[i] === 'current' : (i === current);
                    const isDone = nodeStates ? nodeStates[i] === 'completed' : (i < current || finished);
                    const isLocked = nodeStates ? nodeStates[i] === 'locked' : false;
                    const isUpcoming = nodeStates ? nodeStates[i] === 'upcoming' : false;

                    const stateName = isDone ? 'completed' : isLocked ? 'locked' : isUpcoming ? 'upcoming' : 'current';
                    const handleNodeClick = (e: React.MouseEvent | React.KeyboardEvent) => {
                        e.stopPropagation();
                        if (!interactive || !onNodeClick) return;
                        if (isLocked) {
                            // alert replaced by just returning for now, or could use toast
                            return;
                        }
                        onNodeClick(`level-${i + 1}`, i);
                    };

                    const interactiveProps = interactive ? {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": `Level ${i + 1}, ${stateName}`,
                        onClick: handleNodeClick,
                        onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleNodeClick(e);
                            }
                        }
                    } : {};

                    const currentSize = interactive ? 56 : NODE_SIZE;

                    return (
                        <div
                            key={i}
                            className={cn(
                                "absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 group",
                                interactive && "cursor-pointer focus-visible:ring-2 focus-visible:outline-none ring-chrome-accent ring-offset-4 rounded-full"
                            )}
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            {...interactiveProps}
                        >
                            <div className="relative flex items-center justify-center" style={{ width: currentSize, height: currentSize }}>
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
                                        isUpcoming && 'opacity-80 grayscale',
                                        isLocked && 'opacity-40 grayscale',
                                        (!nodeStates && !isDone && !isActive) && 'opacity-40 grayscale'
                                    )}
                                />
                                {isDone && (
                                    <div className="absolute top-0 right-0 bg-chrome-accent text-white rounded-full p-0.5 z-10 shadow-sm translate-x-1/4 -translate-y-1/4">
                                        <Icon name="checkmark-outline" className="w-4 h-4 px-1" />
                                    </div>
                                )}
                                {isLocked && interactive && (
                                    <div className="absolute top-0 right-0 bg-carbon-500 text-white rounded-full p-0.5 z-10 shadow-sm translate-x-1/4 -translate-y-1/4">
                                        <Icon name="lock-closed-outline" className="w-4 h-4 px-1" />
                                    </div>
                                )}
                                {isLocked && interactive && (
                                    <div className="absolute top-[-30px] opacity-0 group-hover:opacity-100 transition-opacity bg-navy-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-20">
                                        Complete the previous level first
                                    </div>
                                )}
                            </div>
                            <div
                                className={cn(
                                    'absolute font-bold text-center leading-tight whitespace-nowrap transition-colors duration-300',
                                    'bg-surface border border-border rounded-full shadow-sm',
                                    interactive ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1',
                                    isActive ? 'text-foreground' : isDone ? 'text-navy-700' : 'text-muted-foreground'
                                )}
                                style={{ top: '100%', marginTop: 3 }}
                            >
                                {interactive ? `Level ${i + 1}` : (steps[i]?.agent || `Level ${i + 1}`)}
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
                {showMascot && pointsPct.length > 0 && (
                    <motion.div
                        className="absolute z-10 -translate-x-1/2 -translate-y-full mb-6"
                        style={{ left: mascotLeft, top: mascotTop, width: MASCOT_SIZE, height: MASCOT_SIZE }}
                    >
                        <motion.div
                            animate={finished ? { y: [0, -4, 0] } : { rotate: [-2, 2, -2] }}
                            transition={{ duration: finished ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-full h-full flex justify-center items-center"
                        >
                            <Mascot size="md" variant={currentMascotVariant} style={{ width: MASCOT_SIZE, height: MASCOT_SIZE }} />
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