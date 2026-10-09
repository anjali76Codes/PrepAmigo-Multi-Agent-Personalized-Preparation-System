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
    credits?: number;
}

interface GemRewardAnimationProps {
    reward: GemRewardData | null;
    /** Called once per star gem when it lands, with the XP that gem is worth. */
    onGemLand?: (xpPerGem: number) => void;
    /** Called once per credit gem when it lands, with the credits that gem is worth. */
    onCreditGemLand?: (creditsPerGem: number) => void;
    onComplete?: () => void;
}

interface Point {
    x: number;
    y: number;
}

const XP_ICON = "/assets/icons/star.png";
const CREDITS_ICON = "/assets/icons/creds.png";

const XP_COLOR = "195,149,91";
const CREDITS_COLOR = "155,201,225";

const GEM_COUNT = 7;
const MAX_CREDIT_GEMS = 4;
const GEM_SIZE = 36;
const STAR_SIZE = 12;

const FLOAT_DURATION = 0.5;
const GEM_DELAYS = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72];
// Offset from the XP delays so the two streams interleave instead of overlapping
const CREDIT_DELAYS = [0.06, 0.24, 0.42, 0.6];

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
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function findRewardSource(sourceKey: string): Element | null {
    const nodes = document.querySelectorAll("[data-reward-node]");
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute("data-reward-node") === sourceKey) return nodes[i];
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

/* Scroll so the header stats sit near the top of the viewport. */
function scrollTargetIntoView(sourceEl: Element, targetEl: Element) {
    if (!(sourceEl instanceof HTMLElement) || !(targetEl instanceof HTMLElement)) return;

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
   curve and lands exactly on its target icon.
========================================================= */

function FlyingGem({
    index,
    count,
    delay,
    source,
    target,
    flightDuration,
    src,
    color,
}: {
    index: number;
    count: number;
    delay: number;
    source: Point;
    target: Point;
    flightDuration: number;
    src: string;
    color: string;
}) {
    const deltaX = target.x - source.x;
    const deltaY = target.y - source.y;

    const mid = (count - 1) / 2;
    const spreadX = (index - mid) * 12;
    const spreadY = ((index % 3) - 1) * 14;
    const arc = 90 + index * 5;
    const startRotate = index % 2 === 0 ? -15 : 15;

    const controlX = spreadX + deltaX * 0.5 + (index - mid) * 6;
    const controlY = Math.min(spreadY, deltaY) - arc;

    const pop = useMotionValue(0);
    const progress = useMotionValue(0);

    useEffect(() => {
        const popControls = animate(pop, 1, { duration: 0.3, delay, ease: "easeOut" });
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

    const x = useTransform(progress, (p) => quadBezier(p, spreadX, controlX, deltaX));
    const y = useTransform(progress, (p) => quadBezier(p, spreadY, controlY, deltaY));
    const rotate = useTransform(progress, [0, 1], [startRotate, startRotate + 360]);

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
            src={src}
            alt=""
            aria-hidden="true"
            className="absolute object-contain"
            style={{
                left: source.x - GEM_SIZE / 2,
                top: source.y - GEM_SIZE / 2,
                width: GEM_SIZE,
                height: GEM_SIZE,
                filter: `drop-shadow(0 0 12px rgba(${color},0.8))`,
                x,
                y,
                rotate,
                scale,
                opacity,
            }}
        />
    );
}

/* Ring + little stars around an icon when the last gem lands */
function TargetPulse({
    target,
    show,
    color,
    keyPrefix,
}: {
    target: Point;
    show: boolean;
    color: string;
    keyPrefix: string;
}) {
    return (
        <AnimatePresence>
            {show && (
                <>
                    <div
                        key={`${keyPrefix}-ring`}
                        className="fixed pointer-events-none z-[10002]"
                        style={{
                            left: target.x,
                            top: target.y,
                            transform: "translate(-50%, -50%)",
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 2] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            <div
                                className="w-14 h-14 rounded-full border-2"
                                style={{
                                    borderColor: `rgba(${color},0.7)`,
                                    boxShadow: `0 0 25px rgba(${color},0.6)`,
                                }}
                            />
                        </motion.div>
                    </div>

                    {Array.from({ length: 6 }).map((_, index) => {
                        const angle = (index / 6) * Math.PI * 2;
                        const radius = 28;
                        return (
                            <motion.img
                                key={`${keyPrefix}-star-${index}`}
                                src={XP_ICON}
                                alt=""
                                aria-hidden="true"
                                className="fixed w-3 h-3 object-contain pointer-events-none z-[10003]"
                                style={{
                                    left: target.x - STAR_SIZE / 2,
                                    top: target.y - STAR_SIZE / 2,
                                }}
                                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                animate={{
                                    x: Math.cos(angle) * radius,
                                    y: Math.sin(angle) * radius,
                                    opacity: [0, 1, 0],
                                    scale: [0, 1, 0],
                                    rotate: 180,
                                }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                            />
                        );
                    })}
                </>
            )}
        </AnimatePresence>
    );
}

function playGlow(selector: string) {
    const glowElement = document.querySelector(selector);
    if (glowElement instanceof HTMLElement) {
        glowElement.animate(
            [
                { opacity: 0, transform: "scale(0.8)" },
                { opacity: 1, transform: "scale(1.5)" },
                { opacity: 0.85, transform: "scale(1.15)" },
                { opacity: 0, transform: "scale(1.8)" },
            ],
            { duration: 900, easing: "ease-out", fill: "forwards" }
        );
    }
}

export default function GemRewardAnimation({
    reward,
    onGemLand,
    onCreditGemLand,
    onComplete,
}: GemRewardAnimationProps) {
    const [source, setSource] = useState<Point | null>(null);
    const [xpTarget, setXpTarget] = useState<Point | null>(null);
    const [creditsTarget, setCreditsTarget] = useState<Point | null>(null);
    const [xpPulse, setXpPulse] = useState(false);
    const [creditsPulse, setCreditsPulse] = useState(false);

    const onCompleteRef = useRef(onComplete);
    const onGemLandRef = useRef(onGemLand);
    const onCreditGemLandRef = useRef(onCreditGemLand);

    useEffect(() => {
        onCompleteRef.current = onComplete;
        onGemLandRef.current = onGemLand;
        onCreditGemLandRef.current = onCreditGemLand;
    });

    const credits = reward?.credits ?? 0;
    const creditGemCount = credits > 0 ? Math.min(credits, MAX_CREDIT_GEMS) : 0;

    /* Find source + targets after the dashboard has rendered. */
    useEffect(() => {
        if (!reward) {
            setSource(null);
            setXpTarget(null);
            setCreditsTarget(null);
            setXpPulse(false);
            setCreditsPulse(false);
            return;
        }

        let attempts = 0;
        let scrolled = false;
        let timeout: number | null = null;
        let frame: number | null = null;
        const wantsCredits = (reward.credits ?? 0) > 0;

        const findPositions = () => {
            const sourceElement = findRewardSource(reward.sourceKey);
            const xpElement =
                document.querySelector("[data-xp-icon]") ||
                document.querySelector("[data-xp-target]");
            const creditsElement =
                document.querySelector("[data-credits-icon]") ||
                document.querySelector("[data-credits-target]");

            if (sourceElement && xpElement && !scrolled) {
                scrolled = true;
                scrollTargetIntoView(sourceElement, xpElement);
                timeout = window.setTimeout(findPositions, 250);
                return;
            }

            const sourcePoint = getElementPoint(sourceElement);
            const xpPoint = getElementPoint(xpElement);
            const creditsPoint = getElementPoint(creditsElement);

            if (sourcePoint && xpPoint && (!wantsCredits || creditsPoint)) {
                setSource(clampToViewport(sourcePoint));
                setXpTarget(xpPoint);
                setCreditsTarget(wantsCredits ? creditsPoint : null);
                return;
            }

            attempts += 1;
            if (attempts < 30) {
                timeout = window.setTimeout(findPositions, 100);
            }
        };

        frame = requestAnimationFrame(findPositions);

        return () => {
            if (frame !== null) cancelAnimationFrame(frame);
            if (timeout !== null) window.clearTimeout(timeout);
        };
    }, [reward]);

    /* Land each gem individually, pulse each target, then finish. */
    useEffect(() => {
        if (!reward || !source || !xpTarget) return;

        const timers: number[] = [];

        // ---- XP stream ----
        const xpFlight = getFlightDuration(source, xpTarget);
        const xpPerGem = reward.xp / GEM_COUNT;

        GEM_DELAYS.forEach((delay) => {
            const arrival = (FLOAT_DURATION + delay + xpFlight) * 1000;
            timers.push(window.setTimeout(() => onGemLandRef.current?.(xpPerGem), arrival));
        });

        const xpLast =
            (FLOAT_DURATION + GEM_DELAYS[GEM_DELAYS.length - 1] + xpFlight) * 1000;

        timers.push(
            window.setTimeout(() => {
                setXpPulse(true);
                playGlow("[data-xp-icon-glow]");
                timers.push(window.setTimeout(() => setXpPulse(false), 700));
            }, xpLast)
        );

        let lastArrival = xpLast;

        // ---- Credits stream ----
        if (creditsTarget && creditGemCount > 0) {
            const creditFlight = getFlightDuration(source, creditsTarget);
            const creditsPerGem = credits / creditGemCount;

            CREDIT_DELAYS.slice(0, creditGemCount).forEach((delay) => {
                const arrival = (FLOAT_DURATION + delay + creditFlight) * 1000;
                timers.push(
                    window.setTimeout(() => onCreditGemLandRef.current?.(creditsPerGem), arrival)
                );
            });

            const creditsLast =
                (FLOAT_DURATION + CREDIT_DELAYS[creditGemCount - 1] + creditFlight) * 1000;

            timers.push(
                window.setTimeout(() => {
                    setCreditsPulse(true);
                    playGlow("[data-credits-icon-glow]");
                    timers.push(window.setTimeout(() => setCreditsPulse(false), 700));
                }, creditsLast)
            );

            lastArrival = Math.max(lastArrival, creditsLast);
        }

        timers.push(window.setTimeout(() => onCompleteRef.current?.(), lastArrival + 750));

        return () => timers.forEach((id) => window.clearTimeout(id));
    }, [reward, source, xpTarget, creditsTarget, credits, creditGemCount]);

    if (!reward || !source || !xpTarget || typeof document === "undefined") {
        return null;
    }

    const xpFlight = getFlightDuration(source, xpTarget);
    const creditFlight = creditsTarget ? getFlightDuration(source, creditsTarget) : 0;
    const showCredits = Boolean(creditsTarget) && creditGemCount > 0;
    const floatY = -22;

    return createPortal(
        <>
            {/* Floating reward labels above the node */}
            <div className="fixed inset-0 pointer-events-none z-[10000] overflow-hidden">
                <motion.div
                    className="absolute"
                    style={{ left: source.x, top: source.y }}
                    initial={{ x: "-50%", y: -15, opacity: 0, scale: 0.7 }}
                    animate={{
                        x: "-50%",
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
                    <div className="flex items-end gap-5">
                        <div className="flex flex-col items-center gap-1">
                            <img
                                src={XP_ICON}
                                alt=""
                                className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(195,149,91,0.8)]"
                            />
                            <span className="font-extrabold text-base text-[#C3955B] whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
                                +{reward.xp} XP
                            </span>
                        </div>

                        {showCredits && (
                            <div className="flex flex-col items-center gap-1">
                                <img
                                    src={CREDITS_ICON}
                                    alt=""
                                    className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(155,201,225,0.8)]"
                                />
                                <span className="font-extrabold text-base text-[#5aa7cc] whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
                                    +{credits} Credits
                                </span>
                            </div>
                        )}
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
                            src={XP_ICON}
                            alt=""
                            aria-hidden="true"
                            className="absolute w-3 h-3 object-contain"
                            style={{
                                left: source.x - STAR_SIZE / 2,
                                top: source.y - STAR_SIZE / 2,
                            }}
                            initial={{ x: particle.x, y: particle.y, opacity: 0, scale: 0, rotate: 0 }}
                            animate={{
                                x: [particle.x, particle.x * 1.8, particle.x * 0.8],
                                y: [particle.y, particle.y - 30, particle.y - 5],
                                opacity: [0, 1, 0.7, 0],
                                scale: [0, particle.scale, particle.scale * 0.75, 0],
                                rotate: [0, 90, 180],
                            }}
                            transition={{ duration: 1.1, delay, ease: "easeOut" }}
                        />
                    );
                })}
            </div>

            {/* Flying gems */}
            <div className="fixed inset-0 pointer-events-none z-[10001] overflow-hidden">
                {GEM_DELAYS.map((delay, index) => (
                    <FlyingGem
                        key={`xp-gem-${index}`}
                        index={index}
                        count={GEM_COUNT}
                        delay={delay}
                        source={source}
                        target={xpTarget}
                        flightDuration={xpFlight}
                        src={XP_ICON}
                        color={XP_COLOR}
                    />
                ))}

                {showCredits &&
                    creditsTarget &&
                    CREDIT_DELAYS.slice(0, creditGemCount).map((delay, index) => (
                        <FlyingGem
                            key={`credit-gem-${index}`}
                            index={index}
                            count={creditGemCount}
                            delay={delay}
                            source={source}
                            target={creditsTarget}
                            flightDuration={creditFlight}
                            src={CREDITS_ICON}
                            color={CREDITS_COLOR}
                        />
                    ))}
            </div>

            {/* Target pulses */}
            <TargetPulse target={xpTarget} show={xpPulse} color={XP_COLOR} keyPrefix="xp" />
            {creditsTarget && (
                <TargetPulse
                    target={creditsTarget}
                    show={creditsPulse}
                    color={CREDITS_COLOR}
                    keyPrefix="credits"
                />
            )}
        </>,
        document.body
    );
}