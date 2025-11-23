import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const BeltIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M19 9h-2V7H7v2H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2v2h10v-2h2c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zm-5 6h-4v-4h4v4z"/>
  </svg>
);

export default BeltIcon;