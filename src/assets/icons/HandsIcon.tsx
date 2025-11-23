
import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const HandsIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M17 2h-1v2h-2V2h-1v3h-2V2h-1v4H8v10h1v4h2v2h2v-2h2v-4h1V6h-1V2zm-2 17h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4H9v-2h2v2zm0-4H9v-2h2v2z"/>
  </svg>
);

export default HandsIcon;
