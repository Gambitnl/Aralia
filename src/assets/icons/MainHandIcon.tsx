import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const MainHandIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M6 21l7-18 7 18-2 2-5-4-5 4z"/>
    <path d="M12 14l-1.5 1.5 2.5 2.5-1.5 1.5-2.5-2.5-1.5 1.5V21h6v-2.5l-1.5-1.5z" fill="none"/>
    <path d="M19 3L5 17l4 4L23 7z"/>
  </svg>
);

export default MainHandIcon;