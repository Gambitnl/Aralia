import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const RingIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 2.76 7.71 6.5 8.81V22h1v-4.19c3.74-1.1 6.5-4.64 6.5-8.81 0-3.87-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    <circle cx="12" cy="9" r="3" opacity="0.5" />
  </svg>
);

export default RingIcon;