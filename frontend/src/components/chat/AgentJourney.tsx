import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, animate, useTransform } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Mascot } from '../ui/Mascot';
import { cn } from '../../utils/utils';
import { NODE_IMG, NODE_POSITIONS, JOURNEY_PRESETS, MASCOT_VARIANTS, type JourneyVariant, type JourneyConfig } from './AgentJourneyConstants';


export interface JourneyStep {
    agent: string;
    text: string;
}

export interface JourneyAction {
    label: string;
    to?: string;
    onClick?: () => void;
}

export interface AgentJourneyProps extends Partial<JourneyConfig> {
    variant?: JourneyVariant;
    steps?: JourneyStep[];
    activeIndex?: number;
    autoPlay?: boolean;
    stepDuration?: number;
    finishText?: string;
    finalAction?: JourneyAction;
    onComplete?: () => void;
    className?: string;
    onNodeClick?: (levelId: string, index: number) => void;
    nodeStates?: ('completed' | 'current' | 'locked' | 'upcoming')[];
    nodeCount?: number;
    nodePositions?: number[];
    levelIds?: string[];
    levelTitles?: string[];
}

// Math for resampling piecewise linear curve
function getPositionAt(t: number, positions: number[]): number {
    if (t <= 0) return positions[0];
    if (t >= 1) return positions[positions.length - 1];

    const n = positions.length;
    const scaled = t * (n - 1);
    const index = Math.floor(scaled);
    const frac = scaled - index;

    if (index >= n - 1) return positions[n - 1];
    return positions[index] + (positions[index + 1] - positions[index]) * frac;
}

export function AgentJourney(props: AgentJourneyProps) {
    const variant = props.variant || 'chat';
    const config = { ...JOURNEY_PRESETS[variant], ...props };
    const {
        nodeSize,
        labelSize,
        showMascot,
        mascotSize,
        showBubble,
        interactive,
        minHeight,
        maxHeight,
        padding,
        labelFormat,
        steps = [],
        activeIndex,
        autoPlay = false,
        stepDuration = 1800,
        finishText = 'All done! ',
        finalAction,
        onComplete,
        className,
        onNodeClick,
        nodeStates,
        nodeCount: propNodeCount,
        nodePositions,
        levelIds,
        pathD,
        viewW,
        viewH,
        strokeWidth,
        strokeColor,
        strokeTrackColor, roadWidth, roadColor, waypointsPerGap, decorations,
        levelTitles,
    } = config;

    const [internal, setInternal] = useState(0);
    const pathRef = useRef<SVGPathElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [pointsPct, setPointsPct] = useState<{ x: number, y: number, t: number }[]>([]);
    const [waypoints, setWaypoints] = useState<{ x: number; y: number; t: number }[]>([]);
    const [viewBox, setViewBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [mascotHover, setMascotHover] = useState(false);

    const derivedNodeCount = nodeStates
        ? nodeStates.length
        : (propNodeCount ?? Math.max(3, Math.min(steps.length, 7))); // keep the floor for chat only
    const nodeCount = Math.max(1, Math.min(7, derivedNodeCount || 5)); // was Math.max(3, ...)

    const controlled = activeIndex !== undefined;
    const idx = nodeStates ? nodeStates.indexOf('current') : -1;
    const derivedCurrent = nodeStates
        ? (idx !== -1 ? idx : (nodeStates.every(s => s === 'completed') ? nodeCount : 0))
        : -1;
    const current = controlled ? activeIndex! : (derivedCurrent !== -1 ? derivedCurrent : internal);
    const total = nodeStates ? nodeCount : steps.length;
    const finished = current >= total;

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            if (entries[0]) setContainerWidth(entries[0].contentRect.width);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        if (!pathRef.current) return;
        const len = pathRef.current.getTotalLength();

        // Measure bounding box of the visible path (t from 0 to 0.5)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const SAMPLES = 100;
        for (let i = 0; i <= SAMPLES; i++) {
            const p = pathRef.current.getPointAtLength((i / SAMPLES) * 0.5 * len);
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        // Add padding for nodes and labels in viewBox units (approximate mapping)
        const vbPadX = 30; // space for node radius
        const vbPadY = 40; // space for node radius + label at bottom

        const box = {
            x: minX - vbPadX,
            y: minY - vbPadY / 2,
            w: (maxX - minX) + vbPadX * 2,
            h: (maxY - minY) + vbPadY * 1.5
        };
        setViewBox(box);

        const count = Math.max(nodeCount, 2);
        const pts = Array.from({ length: nodeCount }).map((_, i) => {
            const t = i / (count - 1);
            let posFraction = 0;

            if (nodePositions && nodePositions.length === count) {
                posFraction = nodePositions[i];
            } else {
                posFraction = getPositionAt(t, nodePositions || NODE_POSITIONS);
            }

            const fraction = posFraction * 0.5;
            const p = pathRef.current!.getPointAtLength(fraction * len);

            return {
                x: ((p.x - box.x) / box.w) * 100,
                y: ((p.y - box.y) / box.h) * 100,
                t: posFraction
            };
        });
        setPointsPct(pts);
        const per = waypointsPerGap ?? 0;
        const wps: { x: number; y: number; t: number }[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
            for (let k = 1; k <= per; k++) {
                const tt = pts[i].t + ((pts[i + 1].t - pts[i].t) * k) / (per + 1);
                const p = pathRef.current!.getPointAtLength(tt * 0.5 * len);
                wps.push({ x: ((p.x - box.x) / box.w) * 100, y: ((p.y - box.y) / box.h) * 100, t: tt });
            }
        }
        setWaypoints(wps);
    }, [nodeCount, nodePositions, waypointsPerGap]);

    useEffect(() => {
        if (controlled || !autoPlay || internal >= total) return;
        const t = setTimeout(() => setInternal((i) => i + 1), stepDuration);
        return () => clearTimeout(t);
    }, [controlled, autoPlay, internal, total, stepDuration]);

    useEffect(() => {
        if (finished && total > 0) onComplete?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finished]);

    const baseCurrentFraction = finished ? 1 : (pointsPct[current]?.t ?? 0);
    const currentFraction = baseCurrentFraction * 0.5;

    const mascotX = useMotionValue(50);
    const mascotY = useMotionValue(0);
    const fraction = useMotionValue(0);
    const mascotLeft = useTransform(mascotX, (v) => `${v}%`);
    const mascotTop = useTransform(mascotY, (v) => `${v}%`);

    useEffect(() => {
        if (!pathRef.current || !viewBox) return;
        const len = pathRef.current.getTotalLength();
        let cancelled = false;
        const controls = animate(fraction, currentFraction, {
            duration: 1.5,
            ease: 'easeInOut',
            onUpdate: (v) => {
                if (cancelled || !pathRef.current) return;
                const p = pathRef.current.getPointAtLength(v * len);
                mascotX.set(((p.x - viewBox.x) / viewBox.w) * 100);
                mascotY.set(((p.y - viewBox.y) / viewBox.h) * 100);
            }
        });
        return () => {
            cancelled = true;
            controls.stop();
        };
    }, [currentFraction, viewBox, fraction, mascotX, mascotY]);

    const mascotIndex = Math.min(Math.max(current, 0), total - 1);
    const mp = pointsPct[mascotIndex] ?? { x: 50, y: 0, t: 0 };
    const bubbleSide: 'left' | 'right' = mp.x > 50 ? 'left' : 'right';

    const isHappy = mascotHover || (hoverIdx !== null && hoverIdx === mascotIndex);
    const currentMascotVariant = isHappy
        ? "Motivated.png"
        : (MASCOT_VARIANTS[mascotIndex % MASCOT_VARIANTS.length] || "OK.png");
    const bubbleText = finished ? finishText : steps[mascotIndex]?.text ?? '';
    const shouldShowBubble = showBubble && (current >= 0 || finished) && bubbleText;

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

    // Responsive node size logic for sprint map to prevent overlap
    let actualNodeSize = nodeSize;
    if (interactive && containerWidth > 0) {
        // approx width per node if spread evenly, taking 80% of width to be safe
        const maxSafeSize = (containerWidth * 0.8) / nodeCount;
        actualNodeSize = Math.max(44, Math.min(nodeSize, maxSafeSize));
    }

    const vbString = viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` : `0 0 ${viewW} ${viewH}`;

    return (
        <div
            ref={containerRef}
            className={cn('w-full flex justify-center items-center bg-surface border border-border rounded-card overflow-hidden', padding, className)}
        >
            <div
                className="relative w-full"
                style={{
                    height: maxHeight,
                    minHeight
                }}
            >
                {/* Winding pathway SVG */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={vbString}
                    preserveAspectRatio="none"
                >
                    {roadWidth && (
                        <motion.path
                            d={pathD}
                            fill="none"
                            strokeWidth={roadWidth}
                            strokeLinecap="round"
                            stroke={roadColor}
                            vectorEffect="non-scaling-stroke"
                            initial={{ pathLength: 0.5 }}
                        />
                    )}
                    {/* Background path */}
                    <motion.path
                        ref={pathRef}
                        d={pathD}
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        className="text-navy-700/20"
                        stroke={strokeTrackColor}
                        initial={{ pathLength: 0.5 }}
                    />
                    {/* Progress path */}
                    {viewBox && (
                        <motion.path
                            d={pathD}
                            fill="none"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            stroke={strokeColor}
                            // className="text-navy-700"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: currentFraction }}
                            transition={{ duration: 0.8, ease: 'easeInOut' }}
                        />
                    )}
                </svg>

                {decorations && (
                    <>
                        <div
                            className="absolute inset-0 opacity-40 pointer-events-none"
                            style={{
                                backgroundImage: 'radial-gradient(var(--color-chrome-accent) 1.5px, transparent 1.5px)',
                                backgroundSize: '20px 20px',
                            }}
                        />
                        {[
                            { icon: 'cloud-outline', left: '6%', top: '10%', size: 'text-4xl', delay: 0 },
                            { icon: 'star-outline', left: '88%', top: '8%', size: 'text-2xl', delay: 0.6 },
                            { icon: 'leaf-outline', left: '92%', top: '78%', size: 'text-3xl', delay: 1.2 },
                            { icon: 'planet-outline', left: '5%', top: '82%', size: 'text-3xl', delay: 1.8 },
                            { icon: 'sparkles-outline', left: '48%', top: '4%', size: 'text-xl', delay: 0.3 },
                        ].map((d) => (
                            <motion.span
                                key={d.icon}
                                className={cn('absolute text-chrome-accent pointer-events-none', d.size)}
                                style={{ left: d.left, top: d.top }}
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: d.delay }}
                            >
                                <Icon name={d.icon} />
                            </motion.span>
                        ))}
                    </>
                )}

                {viewBox && waypoints.map((w, i) => (
                    <span
                        key={i}
                        className={cn(
                            'absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 border-2 transition-colors duration-500',
                            w.t <= baseCurrentFraction ? 'bg-chrome border-chrome' : 'bg-surface border-chrome-accent'
                        )}
                        style={{ left: `${w.x}%`, top: `${w.y}%` }}
                    />
                ))}

                {/* Nodes + labels - only render when viewBox is measured to prevent flash */}
                {viewBox && pointsPct.map((p, i) => {
                    const isActive = nodeStates ? nodeStates[i] === 'current' : (i === current);
                    const isDone = nodeStates ? nodeStates[i] === 'completed' : (i < current || finished);
                    const isLocked = nodeStates ? nodeStates[i] === 'locked' : false;
                    const isUpcoming = nodeStates ? nodeStates[i] === 'upcoming' : false;

                    const stateName = isDone ? 'completed' : isLocked ? 'locked' : isUpcoming ? 'upcoming' : 'current';
                    const handleNodeClick = (e: React.MouseEvent | React.KeyboardEvent) => {
                        e.stopPropagation();
                        if (!interactive || !onNodeClick) return;
                        const idToPass = levelIds ? (levelIds[i] ?? `level-${i + 1}`) : `level-${i + 1}`;
                        onNodeClick(idToPass, i);
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

                    let labelString = steps[i]?.agent || `Level ${i + 1}`;
                    if (labelFormat) {
                        labelString = labelFormat.replace('{n}', (i + 1).toString());
                    }

                    return (
                        <div
                            key={i}
                            className={cn(
                                "absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 group",
                                interactive && "cursor-pointer focus-visible:ring-2 focus-visible:outline-none ring-chrome ring-offset-4 rounded-full"
                            )}
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            onMouseEnter={() => setHoverIdx(i)}
                            onMouseLeave={() => setHoverIdx(null)}
                            onFocus={() => setHoverIdx(i)}
                            onBlur={() => setHoverIdx(null)}
                            {...interactiveProps}
                        >
                            <div
                                className={cn("relative flex items-center justify-center", isActive && "rounded-full ring-4 ring-chrome-accent")}
                                style={{ width: actualNodeSize, height: actualNodeSize }}
                            >
                                {isActive && [0, 1].map((r) => (
                                    <motion.span
                                        key={r}
                                        aria-hidden
                                        className="absolute inset-0 rounded-full bg-chrome-accent/50 pointer-events-none"
                                        initial={{ scale: 1, opacity: 0.6 }}
                                        animate={{ scale: 1.7, opacity: 0 }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: r }}
                                    />
                                ))}
                                <motion.img
                                    src={NODE_IMG}
                                    alt="Node"
                                    animate={{ scale: isActive ? [1.08, 1.2, 1.08] : 1 }}
                                    transition={isActive
                                        ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                                        : { duration: 0.3 }}
                                    className={cn(
                                        'relative w-full h-full object-contain transition-[filter,opacity] duration-300',
                                        isDone && 'opacity-100 grayscale-0',
                                        isActive && 'opacity-100 grayscale-0',
                                        isUpcoming && 'opacity-80 grayscale',
                                        isLocked && 'opacity-40 grayscale',
                                        (!nodeStates && !isDone && !isActive) && 'opacity-40 grayscale'
                                    )}
                                />
                                {isDone && (
                                    <div className="absolute top-0 right-0 bg-chrome-accent text-white rounded-full p-0.5 z-10 shadow-sm translate-x-1/4 -translate-y-1/4" style={{ transform: `scale(${actualNodeSize / 80}) translate(25%, -25%)` }}>
                                        <Icon name="checkmark-outline" className="w-4 h-4 px-1" />
                                    </div>
                                )}
                                {isLocked && interactive && (
                                    <div className="absolute top-0 right-0 bg-carbon-500 text-white rounded-full p-0.5 z-10 shadow-sm translate-x-1/4 -translate-y-1/4" style={{ transform: `scale(${actualNodeSize / 80}) translate(25%, -25%)` }}>
                                        <Icon name="lock-closed-outline" className="w-4 h-4 px-1" />
                                    </div>
                                )}
                                {isLocked && interactive && (
                                    <div className="absolute top-[-30px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity bg-navy-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-20">
                                        Complete the previous level first
                                    </div>
                                )}

                                {decorations && i === pointsPct.length - 1 && (
                                    <div
                                        className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-chrome text-on-chrome flex items-center justify-center shadow-card z-10"
                                        title="Sprint finish"
                                    >
                                        <Icon name="trophy" className="text-base" />
                                    </div>
                                )}
                            </div>
                            <div
                                className={cn(
                                    'absolute font-bold text-center leading-tight whitespace-nowrap transition-colors duration-300',
                                    'bg-surface border border-border rounded-full shadow-sm',
                                    isActive ? 'text-foreground' : isDone ? 'text-navy-700' : 'text-muted-foreground'
                                )}
                                style={{ top: '100%', marginTop: 3, fontSize: labelSize, padding: '4px 10px' }}
                            >
                                {labelString}
                                {levelTitles?.[i] && (
                                    <span className="block text-[10px] font-medium opacity-70 max-w-[110px] truncate">{levelTitles[i]}</span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Action button on the last node */}
                {viewBox && finalAction && last && (
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
                {viewBox && showMascot && pointsPct.length > 0 && (
                    <motion.div
                        className="absolute z-10 -translate-x-1/2 -translate-y-full mb-6"
                        style={{ left: mascotLeft, top: mascotTop, width: mascotSize, height: mascotSize }}
                        onMouseEnter={() => setMascotHover(true)}
                        onMouseLeave={() => setMascotHover(false)}
                    >
                        <motion.div
                            animate={finished ? { y: [0, -4, 0] } : { rotate: [-2, 2, -2] }}
                            transition={{ duration: finished ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-full h-full flex justify-center items-center"
                        >
                            <Mascot size="md" variant={currentMascotVariant} style={{ width: mascotSize, height: mascotSize }} />
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {shouldShowBubble && (
                                <motion.div
                                    key={`${mascotIndex}-${finished}`}
                                    initial={{ opacity: 0, scale: 0.85 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                                    transition={{ duration: 0.25, delay: 0.45 }}
                                    className="absolute w-max max-w-[210px] bg-navy-700 text-white text-xs font-medium px-3 py-2 rounded-card shadow-sm top-0"
                                    style={{
                                        ...(bubbleSide === 'right'
                                            ? { left: '100%', marginLeft: 10, transformOrigin: 'left center' }
                                            : { right: '100%', marginRight: 10, transformOrigin: 'right center' }),
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

                        {interactive && isHappy && !finished && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                className="absolute top-0 w-max bg-navy-700 text-white text-xs font-bold px-3 py-2 rounded-card shadow-sm pointer-events-none"
                                style={bubbleSide === 'right'
                                    ? { left: '100%', marginLeft: 10 }
                                    : { right: '100%', marginRight: 10 }}
                            >
                                Let's go!
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

export function ChatJourney(props: Omit<AgentJourneyProps, 'variant'>) {
    return <AgentJourney variant="chat" {...props} />;
}

export function SprintMap({ nodeStates, onNodeClick, levelIds, levelTitles, className }: {
    sprintId?: string; nodeStates: ('completed' | 'current' | 'locked' | 'upcoming')[];
    onNodeClick?: (levelId: string, index: number) => void; levelIds?: string[];
    levelTitles?: string[]; className?: string;
}) {
    return <AgentJourney variant="sprint" nodeStates={nodeStates} onNodeClick={onNodeClick} levelIds={levelIds} levelTitles={levelTitles} className={className} />;
}