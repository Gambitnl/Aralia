import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const OffHandIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M12 2L4 5v11c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-8-3zm0 2.18l6.86 2.86C18.18 11.74 15.67 16.18 12 17.78 8.33 16.18 5.82 11.74 5.14 7.04L12 4.18z" />
  </svg>
);

export default OffHandIcon;