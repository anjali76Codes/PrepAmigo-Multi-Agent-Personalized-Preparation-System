import { useEffect } from "react";
import confetti from "canvas-confetti";

interface LevelCompleteCelebrationProps {
    active: boolean;
    onStop?: () => void;
}

const fireLevelCompleteConfetti = () => {
    const colors = [
        "#9bc9e1",
        "#f17954",
        "#f7b970",
        "#173F35",
        "#C3955B",
    ];

    let stopped = false;
    let animationFrame: number | null = null;

    const end = Date.now() + 2200;

    const frame = () => {
        if (stopped) return;

        confetti({
            particleCount: 12,
            angle: 65,
            spread: 90,
            startVelocity: 55,
            origin: { x: 0, y: 1 },
            colors,
            gravity: 0.7,
            scalar: 1,
            ticks: 220,
        });

        confetti({
            particleCount: 12,
            angle: 115,
            spread: 90,
            startVelocity: 55,
            origin: { x: 1, y: 1 },
            colors,
            gravity: 0.7,
            scalar: 1,
            ticks: 220,
        });

        if (Date.now() < end && !stopped) {
            animationFrame = requestAnimationFrame(frame);
        }
    };

    // Center burst
    confetti({
        particleCount: 110,
        spread: 90,
        startVelocity: 38,
        origin: { x: 0.5, y: 0.55 },
        colors,
        gravity: 0.5,
        scalar: 0.9,
        ticks: 190,
        shapes: ["circle", "square", "star"],
        drift: 0,
    });

    frame();

    return () => {
        stopped = true;

        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
        }

        confetti.reset();
    };
};

export default function LevelCompleteCelebration({
    active,
    onStop,
}: LevelCompleteCelebrationProps) {
    useEffect(() => {
        if (!active) return;

        const cleanup = fireLevelCompleteConfetti();

        return () => {
            cleanup();
            onStop?.();
        };
    }, [active, onStop]);

    return null;
}