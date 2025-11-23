import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {}

const NeckIcon: React.FC<SvgIconProps> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" {...props}>
    <path d="M12 1C7.03 1 3 5.03 3 10c0 3.98 2.58 7.35 6.16 8.54C9.83 19.17 10.84 20 12 20c1.16 0 2.17-.83 2.84-1.46C18.42 17.35 21 13.98 21 10c0-4.97-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
    <circle cx="12" cy="16" r="2" />
  </svg>
);

export default NeckIcon;