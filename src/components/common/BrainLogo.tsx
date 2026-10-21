import React from 'react';

interface BrainLogoProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Custom BlueMind Cares Logo:
 * HeartPulse ECG heartbeat nested seamlessly inside an anatomical/stylized brain outline.
 */
export const BrainLogo: React.FC<BrainLogoProps> = ({
  size = 24,
  color = 'currentColor',
  className = '',
  style = {},
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Outer Brain Outline - Left & Right Hemispheres */}
      {/* Left Hemisphere */}
      <path
        d="M 16 6.5 C 13.5 3.5 8.5 4 6.5 7.5 C 4 9 3 12.5 4.5 15.5 C 3.2 18 4.5 22 7.5 23.5 C 9.5 24.5 12.5 24 14 22.5 C 15 23.5 16 24.5 16 25.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Hemisphere */}
      <path
        d="M 16 6.5 C 18.5 3.5 23.5 4 25.5 7.5 C 28 9 29 12.5 27.5 15.5 C 28.8 18 27.5 22 24.5 23.5 C 22.5 24.5 19.5 24 18 22.5 C 17 23.5 16 24.5 16 25.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Brain Top Midline Fissure */}
      <path
        d="M 16 6.5 V 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Heart Outline inside Brain */}
      <path
        d="M 16 19.8 L 12.2 16 C 10.3 14.1 10.3 11 12.2 9.2 C 14 7.4 15.5 8.2 16 9.5 C 16.5 8.2 18 7.4 19.8 9.2 C 21.7 11 21.7 14.1 19.8 16 Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />

      {/* Heart Pulse ECG Line crossing horizontally inside the heart and brain */}
      <path
        d="M 8.5 15 H 12 L 13.5 11.5 L 15.5 18.5 L 17.5 12 L 19 16 H 23.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
