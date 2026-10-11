import React from 'react';
import { Film, Gamepad2, Music, HelpCircle, Layers } from 'lucide-react';
import './PlatformBadge.scss';

export const PLATFORM_META = {
  ALL: {
    code: 'ALL',
    name: 'All Platforms',
    shortName: 'Multi-Platform',
    category: 'Consolidated Portal',
    icon: Layers,
    accentColor: '#FFCC00',
    badgeClass: 'badge-all'
  },
  GHSNAPFLIX: {
    code: 'GHSNAPFLIX',
    name: 'GHSnapflix',
    shortName: 'Snapflix',
    category: 'Video Streaming',
    icon: Film,
    accentColor: '#FFCC00',
    badgeClass: 'badge-snapflix'
  },
  GHGAMEZONE: {
    code: 'GHGAMEZONE',
    name: 'GHGameZone',
    shortName: 'GameZone',
    category: 'Cloud Gaming',
    icon: Gamepad2,
    accentColor: '#00E5FF',
    badgeClass: 'badge-gamezone'
  },
  GHMUSIC: {
    code: 'GHMUSIC',
    name: 'GHMusic',
    shortName: 'Music Hub',
    category: 'Music & Audio',
    icon: Music,
    accentColor: '#FF6B00',
    badgeClass: 'badge-music'
  },
  GHQUIZ: {
    code: 'GHQUIZ',
    name: 'GHQuiz',
    shortName: 'Quiz Portal',
    category: 'Trivia & Prizes',
    icon: HelpCircle,
    accentColor: '#00E676',
    badgeClass: 'badge-quiz'
  }
};

export const PlatformLogo = ({ platformCode = 'ALL', size = 'md', className = '' }) => {
  const code = (platformCode || 'ALL').toUpperCase();
  const meta = PLATFORM_META[code] || PLATFORM_META.ALL;
  const IconComponent = meta.icon;

  return (
    <div className={`platform-logo-badge ${meta.badgeClass} size-${size} ${className}`} title={meta.name}>
      <IconComponent className="platform-logo-icon" />
    </div>
  );
};
