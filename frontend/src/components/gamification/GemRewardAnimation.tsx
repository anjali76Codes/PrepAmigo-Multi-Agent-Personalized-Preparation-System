import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    AnimatePresence,
    animate,
    motion,
    useMotionValue,
    useTransform,
} from "framer-motion";

export interface GemRewardData {
    sourceKey: string;
    xp: number;
}

interface GemRewardAnimationProps {
    reward: GemRewardData | null;
    /** Called once per gem when it reaches the XP icon, with the XP that gem is worth. */
    onGemLand?: (xpPerGem: number) => void;
    onComplete?: () => void;
}

interface Point {
    x: number;
    y: number;
}

const GEM_COUNT = 7;
const GEM_SIZE = 36; // px, must match the gem's rendered size
const STAR_SIZE = 12; // px, matches w-3 h-3

const FLOAT_DURATION = 0.5;
const GEM_DELAYS = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72];

const DUST_OFFSETS = [
    { x: -42, y: -12, scale: 0.8 },
    { x: -30, y: 18, scale: 0.55 },
    { x: -18, y: -28, scale: 0.7 },
    { x: -5, y: 22, scale: 0.5 },
    { x: 12, y: -20, scale: 0.75 },
    { x: 28, y: 12, scale: 0.6 },
    { x: 42, y: -8, scale: 0.8 },
    { x: 55, y: 20, scale: 0.5 },
    { x: -50, y: 42, scale: 0.45 },
    { x: -35, y: -45, scale: 0.55 },
    { x: -10, y: 48, scale: 0.65 },
    { x: 15, y: -42, scale: 0.5 },
    { x: 35, y: 38, scale: 0.7 },
    { x: 52, y: -35, scale: 0.45 },
    { x: 65, y: 5, scale: 0.6 },
    { x: -65, y: 4, scale: 0.5 },
    { x: 20, y: 32, scale: 0.45 },
    { x: -25, y: -5, scale: 0.55 },
];

function getElementPoint(element: Element | null): Point | null {
    if (!(element instanceof HTMLElement)) return null;

    const rect = element.getBoundingClientRect();

    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
}

function findRewardSource(sourceKey: string): Element | null {
    const nodes = document.querySelectorAll("[data-reward-node]");

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (node.getAttribute("data-reward-node") === sourceKey) {
            return node;
        }
    }

    return null;
}

function getFlightDuration(source: Point, target: Point): number {
    const distance = Math.hypot(target.x - source.x, target.y - source.y);
    return Math.min(Math.max(distance / 500, 1.2), 2.2);
}

function getScrollParent(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;

    while (parent) {
        const overflowY = getComputedStyle(parent).overflowY;
        const scrollable =
            (overflowY === "auto" || overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight;

        if (scrollable) return parent;

        parent = parent.parentElement;
    }

    return null;
}

/*
 * The XP stat lives inside the same scroll container as the sprint map,
 * so scrolling the node to the center would push the XP icon off-screen.
 * Instead, scroll so the XP icon sits near the top of the viewport.
 * The node is then visible whenever it fits below it.
 */
function scrollTargetIntoView(sourceEl: Element, targetEl: Element) {
    if (!(sourceEl instanceof HTMLElement) || !(targetEl instanceof HTMLElement)) {
        return;
    }

    const scrollParent = getScrollParent(targetEl);
    if (!scrollParent) return;

    const parentTop = scrollParent.getBoundingClientRect().top;
    const targetTop = targetEl.getBoundingClientRect().top;
    const margin = 90;

    scrollParent.scrollTo({
        top: Math.max(0, scrollParent.scrollTop + targetTop - (parentTop + margin)),
        behavior: "auto",
    });
}


function clampToViewport(point: Point, padding = 24): Point {
    return {
        x: Math.min(Math.max(point.x, padding), window.innerWidth - padding),
        y: Math.min(Math.max(point.y, padding), window.innerHeight - padding),
    };
}

function quadBezier(p: number, start: number, control: number, end: number) {
    const inv = 1 - p;
    return inv * inv * start + 2 * inv * p * control + p * p * end;
}

/* =========================================================
   One gem: pops in at the node, hovers, then flies along a
   curve and lands exactly on the XP icon.
========================================================= */

function FlyingGem({
    index,
    delay,
    source,
    target,
    flightDuration,
}: {
    index: number;
    delay: number;
    source: Point;
    target: Point;
    flightDuration: number;
}) {
    const deltaX = target.x - source.x;
    const deltaY = target.y - source.y;

    const spreadX = (index - 3) * 12;
    const spreadY = ((index % 3) - 1) * 14;
    const arc = 90 + index * 5;
    const startRotate = index % 2 === 0 ? -15 : 15;

    // Control point of the curve: above both ends so the gem arcs upward
    const controlX = spreadX + deltaX * 0.5 + (index - 3) * 6;
    const controlY = Math.min(spreadY, deltaY) - arc;

    const pop = useMotionValue(0); // 0 -> 1: appear at the node
    const progress = useMotionValue(0); // 0 -> 1: flight to the icon

    useEffect(() => {
        const popControls = animate(pop, 1, {
            duration: 0.3,
            delay,
            ease: "easeOut",
        });

        const flyControls = animate(progress, 1, {
            duration: flightDuration,
            delay: delay + FLOAT_DURATION,
            ease: [0.4, 0, 0.6, 1],
        });

        return () => {
            popControls.stop();
            flyControls.stop();
        };
    }, [pop, progress, delay, flightDuration]);

    const x = useTransform(progress, (p) =>
        quadBezier(p, spreadX, controlX, deltaX)
    );
    const y = useTransform(progress, (p) =>
        quadBezier(p, spreadY, controlY, deltaY)
    );
    const rotate = useTransform(progress, [0, 1], [startRotate, startRotate + 360]);

    // Shrink slightly on approach, then vanish only once it is on the icon
    const scale = useTransform([pop, progress], ([p, q]: number[]) => {
        const popScale = 0.35 + 0.65 * p;
        const landing = q > 0.85 ? 1 - ((q - 0.85) / 0.15) * 0.4 : 1;
        return popScale * landing;
    });
    const opacity = useTransform([pop, progress], ([p, q]: number[]) => {
        const fadeOut = q > 0.95 ? 1 - (q - 0.95) / 0.05 : 1;
        return p * fadeOut;
    });

    return (
        <motion.img
            src="/assets/icons/star.png"
            alt=""
            aria-hidden="true"
            className="absolute object-contain drop-shadow-[0_0_12px_rgba(195,149,91,0.8)]"
            style={{
                // Offset by half the size so the gem's CENTER is on the point
                left: source.x - GEM_SIZE / 2,
                top: source.y - GEM_SIZE / 2,
                width: GEM_SIZE,
                height: GEM_SIZE,
                x,
                y,
                rotate,
                scale,
                opacity,
            }}
        />
    );
}

export default function GemRewardAnimation({
    reward,
    onGemLand,
    onComplete,
}: GemRewardAnimationProps) {
    const [source, setSource] = useState<Point | null>(null);
    const [target, setTarget] = useState<Point | null>(null);
    const [targetPulse, setTargetPulse] = useState(false);

    /*
     * Keep the latest callbacks in refs so parent re-renders
     * (new inline functions) never restart the animation timers.
     */
    const onCompleteRef = useRef(onComplete);
    const onGemLandRef = useRef(onGemLand);

    useEffect(() => {
        onCompleteRef.current = onComplete;
        onGemLandRef.current = onGemLand;
    });

    /*
     * Find source + target after the dashboard has rendered.
     * Scrolls once so the XP icon is on screen, then measures both.
     */
    useEffect(() => {
        if (!reward) {
            setSource(null);
            setTarget(null);
            setTargetPulse(false);
            return;
        }

        let attempts = 0;
        let scrolled = false;
        let timeout: number | null = null;
        let frame: number | null = null;

        const findPositions = () => {
            const sourceElement = findRewardSource(reward.sourceKey);
            const targetElement =
                document.querySelector("[data-xp-icon]") ||
                document.querySelector("[data-xp-target]");

            if (sourceElement && targetElement && !scrolled) {
                scrolled = true;
                scrollTargetIntoView(sourceElement, targetElement);
                // Re-measure after the scroll has settled
                timeout = window.setTimeout(findPositions, 250);
                return;
            }

            const sourcePoint = getElementPoint(sourceElement);
            const targetPoint = getElementPoint(targetElement);

            if (sourcePoint && targetPoint) {
                // If the node is still off-screen, start from the nearest screen edge
                setSource(clampToViewport(sourcePoint));
                setTarget(targetPoint);
                return;
            }

            attempts += 1;

            if (attempts < 30) {
                timeout = window.setTimeout(findPositions, 100);
            }
        };

        frame = requestAnimationFrame(findPositions);

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }

            if (timeout !== null) {
                window.clearTimeout(timeout);
            }
        };
    }, [reward]);

    /*
     * Land each gem individually, then pulse the target and finish.
     * No callbacks in deps, so this only re-runs when the reward/positions change.
     */
    useEffect(() => {
        if (!reward || !source || !target) return;

        const flightDuration = getFlightDuration(source, target);
        const xpPerGem = reward.xp / GEM_COUNT;
        const timers: number[] = [];


        GEM_DELAYS.forEach((delay) => {
            const arrival = (FLOAT_DURATION + delay + flightDuration) * 1000;

            timers.push(
                window.setTimeout(() => {
                    onGemLandRef.current?.(xpPerGem);
                }, arrival)
            );
        });

        const lastArrival =
            (FLOAT_DURATION +
                GEM_DELAYS[GEM_DELAYS.length - 1] +
                flightDuration) *
            1000;


        timers.push(
            window.setTimeout(() => {
                setTargetPulse(true);

                const glowElement =
                    document.querySelector("[data-xp-icon-glow]");

                if (glowElement instanceof HTMLElement) {
                    glowElement.animate(
                        [
                            { opacity: 0, transform: "scale(0.8)" },
                            { opacity: 1, transform: "scale(1.5)" },
                            { opacity: 0.85, transform: "scale(1.15)" },
                            { opacity: 0, transform: "scale(1.8)" },
                        ],
                        {
                            duration: 900,
                            easing: "ease-out",
                            fill: "forwards",
                        }
                    );
                }

                timers.push(
                    window.setTimeout(() => {
                        setTargetPulse(false);
                    }, 700)
                );
            }, lastArrival)
        );

        timers.push(
            window.setTimeout(() => {
                onCompleteRef.current?.();
            }, lastArrival + 750)
        );

        return () => {
            timers.forEach((id) => window.clearTimeout(id));
        };
    }, [reward, source, target]);

    if (!reward || !source || !target || typeof document === "undefined") {
        return null;
    }

    const flightDuration = getFlightDuration(source, target);

    // Height where the floating "+XP" label hovers above the node
    const floatY = -22;

    /*
     * Rendered in a portal on document.body so `position: fixed`
     * is always relative to the viewport, even if a parent
     * (like RevealStagger) has a CSS transform applied.
     */
    return createPortal(
        <>
            {/* Floating reward above completed node */}
            <div className="fixed inset-0 pointer-events-none z-[10000] overflow-hidden">
                <motion.div
                    className="absolute"
                    style={{
                        left: source.x,
                        top: source.y,
                    }}
                    initial={{
                        x: -30,
                        y: -15,
                        opacity: 0,
                        scale: 0.7,
                    }}
                    animate={{
                        x: -30,
                        y: [floatY - 8, floatY, floatY - 8],
                        opacity: [0, 1, 1, 0],
                        scale: [0.7, 1, 1, 1],
                    }}
                    transition={{
                        duration: FLOAT_DURATION + 0.35,
                        times: [0, 0.25, 0.65, 1],
                        ease: "easeOut",
                    }}
                >
                    <div className="flex flex-col items-center gap-1">
                        <img
                            src="/assets/icons/star.png"
                            alt=""
                            className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(195,149,91,0.8)]"
                        />

                        <span className="font-extrabold text-base text-[#C3955B] whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
                            +{reward.xp} XP
                        </span>
                    </div>
                </motion.div>
            </div>

            {/* Pixie dust burst */}
            <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
                {DUST_OFFSETS.map((particle, index) => {
                    const delay = FLOAT_DURATION + index * 0.035;

                    return (
                        <motion.img
                            key={`dust-${index}`}
                            src="/assets/icons/star.png"
                            alt=""
                            aria-hidden="true"
                            className="absolute w-3 h-3 object-contain"
                            style={{
                                left: source.x - STAR_SIZE / 2,
                                top: source.y - STAR_SIZE / 2,
                            }}
                            initial={{
                                x: particle.x,
                                y: particle.y,
                                opacity: 0,
                                scale: 0,
                                rotate: 0,
                            }}
                            animate={{
                                x: [
                                    particle.x,
                                    particle.x * 1.8,
                                    particle.x * 0.8,
                                ],
                                y: [
                                    particle.y,
                                    particle.y - 30,
                                    particle.y - 5,
                                ],
                                opacity: [0, 1, 0.7, 0],
                                scale: [
                                    0,
                                    particle.scale,
                                    particle.scale * 0.75,
                                    0,
                                ],
                                rotate: [0, 90, 180],
                            }}
                            transition={{
                                duration: 1.1,
                                delay,
                                ease: "easeOut",
                            }}
                        />
                    );
                })}
            </div>

            {/* Flying gems */}
            <div className="fixed inset-0 pointer-events-none z-[10001] overflow-hidden">
                {GEM_DELAYS.map((delay, index) => (
                    <FlyingGem
                        key={`gem-${index}`}
                        index={index}
                        delay={delay}
                        source={source}
                        target={target}
                        flightDuration={flightDuration}
                    />
                ))}
            </div>

            {/* Target pulse */}
            <AnimatePresence>
                {targetPulse && (
                    <>
                        {/* Outer ring: the wrapper centers it, motion only animates the inner element */}
                        <div
                            key="pulse-ring"
                            className="fixed pointer-events-none z-[10002]"
                            style={{
                                left: target.x,
                                top: target.y,
                                transform: "translate(-50%, -50%)",
                            }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    scale: [0.5, 1.4, 2],
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                            >
                                <div className="w-14 h-14 rounded-full border-2 border-[#C3955B]/70 shadow-[0_0_25px_rgba(195,149,91,0.6)]" />
                            </motion.div>
                        </div>

                        {/* Little stars around XP icon */}
                        {Array.from({ length: 6 }).map((_, index) => {
                            const angle = (index / 6) * Math.PI * 2;
                            const radius = 28;

                            return (
                                <motion.img
                                    key={`target-star-${index}`}
                                    src="/assets/icons/star.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="fixed w-3 h-3 object-contain pointer-events-none z-[10003]"
                                    style={{
                                        left: target.x - STAR_SIZE / 2,
                                        top: target.y - STAR_SIZE / 2,
                                    }}
                                    initial={{
                                        x: 0,
                                        y: 0,
                                        opacity: 0,
                                        scale: 0,
                                    }}
                                    animate={{
                                        x: Math.cos(angle) * radius,
                                        y: Math.sin(angle) * radius,
                                        opacity: [0, 1, 0],
                                        scale: [0, 1, 0],
                                        rotate: 180,
                                    }}
                                    transition={{
                                        duration: 0.7,
                                        ease: "easeOut",
                                    }}
                                />
                            );
                        })}
                    </>
                )}
            </AnimatePresence>
        </>,
        document.body
    );
}