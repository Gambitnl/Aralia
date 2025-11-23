import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const WristsIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M19 5H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H5V7h14v10z"/>
    <rect x="7" y="9" width="2" height="6" />
    <rect x="15" y="9" width="2" height="6" />
  </svg>
);

export default WristsIcon;