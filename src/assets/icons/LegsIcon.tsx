
import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const LegsIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M6 2h12v4h-1v16h-4v-8h-2v8H7V6H6V2zm3 3h6V4H9v1z"/>
  </svg>
);

export default LegsIcon;
