import React from 'react';
import { cn } from '../../lib/utils';

export interface MarbleBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: 'high' | 'medium' | 'low';
  /** turn the slow drift off, e.g. for a static screenshot */
  animate?: boolean;
}

export function MarbleBackground({ intensity = 'medium', animate = true, className, ...props }: MarbleBackgroundProps) {
  const getOpacity = () => {
    switch (intensity) {
      case 'high':
        return 0.8;
      case 'medium':
        return 0.4;
      case 'low':
        return 0.15;
      default:
        return 0.4;
    }
  };

  return (
    <div
      className={cn('fixed inset-0 w-full h-full pointer-events-none -z-20 overflow-hidden bg-background', className)}
      {...props}
    >
      {/*
        Only the transform/opacity of each layer is animated below — never the
        SVG filter attributes themselves. feTurbulence/feDisplacementMap are
        rasterized once, then the browser just moves the resulting layer on
        the GPU, which is what keeps this smooth instead of janky.
      */}
      <style>{`
        @keyframes marble-drift-a {
          0%   { transform: translate3d(-4%, -3%, 0) scale(1.05) rotate(0deg); }
          50%  { transform: translate3d(3%, 4%, 0) scale(1.15) rotate(3deg); }
          100% { transform: translate3d(-4%, -3%, 0) scale(1.05) rotate(0deg); }
        }
        @keyframes marble-drift-b {
          0%   { transform: translate3d(4%, 3%, 0) scale(1.1) rotate(0deg); }
          50%  { transform: translate3d(-3%, -4%, 0) scale(1.2) rotate(-3deg); }
          100% { transform: translate3d(4%, 3%, 0) scale(1.1) rotate(0deg); }
        }
        @keyframes marble-drift-c {
          0%   { transform: translate3d(0%, 2%, 0) scale(1); }
          50%  { transform: translate3d(2%, -2%, 0) scale(1.08); }
          100% { transform: translate3d(0%, 2%, 0) scale(1); }
        }
        @keyframes marble-texture-drift {
          0%   { transform: translate3d(-1.5%, -1%, 0) scale(1.06); }
          50%  { transform: translate3d(1.5%, 1%, 0) scale(1.1); }
          100% { transform: translate3d(-1.5%, -1%, 0) scale(1.06); }
        }
        .marble-layer {
          will-change: transform;
          backface-visibility: hidden;
        }
        @media (prefers-reduced-motion: reduce) {
          .marble-layer { animation: none !important; }
        }
      `}</style>

      {/* Base colors for the marble depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A0D0B] via-[#050605] to-[#123A2A]" />

      {/* SVG Turbulence for organic vein texture — static filter, drifting layer */}
      <svg
        className="marble-layer absolute inset-0 w-full h-full opacity-60 mix-blend-overlay"
        style={{
          filter: 'contrast(2.5) brightness(1.2)',
          animation: animate ? 'marble-texture-drift 70s ease-in-out infinite' : undefined,
        }}
      >
        <filter id="marble">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.004" numOctaves="4" result="noise" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" in="noise" result="coloredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="coloredNoise" scale="300" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <rect width="100%" height="100%" filter="url(#marble)" fill="none" />
      </svg>

      {/* SVG overlay specifically for colored veins (emerald/forest) */}
      <svg
        className="marble-layer absolute inset-0 w-full h-full mix-blend-color-dodge"
        style={{
          opacity: getOpacity(),
          animation: animate ? 'marble-texture-drift 95s ease-in-out infinite reverse' : undefined,
        }}
      >
        <filter id="veins">
          <feTurbulence type="fractalNoise" baseFrequency="0.003 0.006" numOctaves="3" result="noise2" />
          <feColorMatrix
            type="matrix"
            values="0.1  0    0    0   0 
                    0    0.3  0    0   0 
                    0    0    0.1  0   0 
                    0    0    0    10 -4"
            in="noise2"
            result="greenNoise"
          />
          <feGaussianBlur stdDeviation="2" result="blurredVeins" />
        </filter>
        <rect width="100%" height="100%" filter="url(#veins)" />
      </svg>

      {/* Atmospheric blurred gradients — the slow "moving waves" you actually see */}
      <div
        className="marble-layer absolute top-[-20%] left-[-10%] w-[60%] aspect-square rounded-full bg-[#123A2A]/40 blur-[120px] mix-blend-screen"
        style={{ animation: animate ? 'marble-drift-a 50s ease-in-out infinite' : undefined }}
      />
      <div
        className="marble-layer absolute bottom-[-10%] right-[-10%] w-[70%] aspect-square rounded-full bg-[#2FA36B]/20 blur-[150px] mix-blend-screen"
        style={{ animation: animate ? 'marble-drift-b 65s ease-in-out infinite' : undefined }}
      />
      {/* <div
        className="marble-layer absolute top-[30%] right-[20%] w-[40%] aspect-square rounded-full bg-[#050605]/20 blur-[80px]"
        style={{ animation: animate ? 'marble-drift-c 40s ease-in-out infinite' : undefined }}
      /> */}
    </div>
  );
}