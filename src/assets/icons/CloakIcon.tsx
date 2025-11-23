import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const CloakIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M6 2a2 2 0 0 0-2 2v15c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4a2 2 0 0 0-2-2H6zm6 2.5c1.38 0 2.5 1.12 2.5 2.5S13.38 9.5 12 9.5 9.5 8.38 9.5 7 10.62 4.5 12 4.5zM7 19V9.13c.86.54 1.88.87 3 .87h4c1.12 0 2.14-.33 3-.87V19H7z"/>
  </svg>
);

export default CloakIcon;