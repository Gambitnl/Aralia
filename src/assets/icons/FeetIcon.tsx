import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const FeetIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M19 19v-8c0-1.66-1.34-3-3-3h-2v2h2c.55 0 1 .45 1 1v8H5v-6c0-1.66 1.34-3 3-3h2V8H8c-2.76 0-5 2.24-5 5v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"/>
    <path d="M13 5h-2v10h2V5z"/>
  </svg>
);

export default FeetIcon;