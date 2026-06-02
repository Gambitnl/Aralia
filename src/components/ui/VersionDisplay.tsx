/**
 * @file VersionDisplay.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react'
import packageInfo from '../../../package.json';
import './VersionDisplay.css'

interface VersionDisplayProps {
  position?: 'main-menu' | 'game-screen'
}

export const VersionDisplay: React.FC<VersionDisplayProps> = ({
  position = 'game-screen'
}) => {
  const version = packageInfo.version

  const positionClass = position === 'main-menu' ? 'bottom-left-menu' : 'top-left-subtle'

  return (
    <div className={`version-display ${positionClass}`}>
      v{version}
    </div>
  )
}
