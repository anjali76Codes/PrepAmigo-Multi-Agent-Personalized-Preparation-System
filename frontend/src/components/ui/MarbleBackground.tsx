import React from 'react';
import { cn } from '../../lib/utils';

export interface MarbleBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: 'high' | 'medium' | 'low';
}

export function MarbleBackground({ intensity = 'medium', className, ...props }: MarbleBackgroundProps) {
  // SVG-based noise/turbulence for a marble effect
  const getOpacity = () => {
    switch (intensity) {
      case 'high': return 0.8;
      case 'medium': return 0.4;
      case 'low': return 0.15;
      default: return 0.4;
    }
  };

  return (
    <div
      className={cn("fixed inset-0 w-full h-full pointer-events-none -z-20 overflow-hidden bg-background", className)}
      {...props}
    >
      {/* Base colors for the marble depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A0D0B] via-[#050605] to-[#123A2A]" />

      {/* SVG Turbulence for organic vein texture */}
      <svg className="absolute inset-0 w-full h-full opacity-60 mix-blend-overlay" style={{ filter: 'contrast(2.5) brightness(1.2)' }}>
        <filter id="marble">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.004" numOctaves="4" result="noise" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" in="noise" result="coloredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="coloredNoise" scale="300" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <rect width="100%" height="100%" filter="url(#marble)" fill="none" />
      </svg>

      {/* SVG overlay specifically for colored veins (emerald/forest) */}
      <svg className="absolute inset-0 w-full h-full mix-blend-color-dodge" style={{ opacity: getOpacity() }}>
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
          <feGaussianBlur stdDeviation="4" result="blurredVeins" />
        </filter>
        <rect width="100%" height="100%" filter="url(#veins)" />
      </svg>

      {/* Atmospheric blurred gradients to soften edges and create depth */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] aspect-square rounded-full bg-[#123A2A]/40 blur-[120px] mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70%] aspect-square rounded-full bg-[#2FA36B]/20 blur-[150px] mix-blend-screen" />
      <div className="absolute top-[30%] right-[20%] w-[40%] aspect-square rounded-full bg-[#050605]/80 blur-[80px]" />
    </div>
  );
}
