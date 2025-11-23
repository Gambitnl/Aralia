import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const TorsoIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" opacity="0"/>
    <path d="M21 5l-9-4-9 4v7c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5zm-9 17c-4.52-1.09-8-5.52-8-9.97V6.63l8-3.56 8 3.56v5.4c0 4.45-3.48 8.88-8 9.97z" display="none"/>
    <path d="M4 6h16v12h-6v-2h2v-2h-8v2h2v2H4z" display="none"/>
    <path d="M19 3h-2.5c-1.1 0-2 .9-2 2v2h-5V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 16H5V5h2.5v2H10V5h2v14zm7 0h-5v-2h2.5v-2H14v-2h2.5v-2H14V9h2.5V7H19v12z" display="none"/>
    <path d="M12 2L4 6l1.5 11c0 0 2 4 6.5 5 4.5-1 6.5-5 6.5-5l1.5-11L12 2zm0 2.5l4.5 2.25-.75 5.5c0 0-1.25 2.5-3.75 3-2.5-.5-3.75-3-3.75-3l-.75-5.5L12 4.5z" />
  </svg>
);

export default TorsoIcon;