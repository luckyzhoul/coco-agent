import React, { useEffect } from 'react';
import { CUSTOM_ICON, builtinIconKey } from '@shared/agentIcons';
import { useAgentIconStore } from '../../stores/useAgentIconStore';
import { getAgentGradient } from '../../utils/agentColors';
import { AGENT_ICONS } from '../agents/agentIcons';

interface AgentAvatarProps {
  name: string;
  agentId: string;
  /** AgentInfo.icon: '' | 'builtin:<key>' | 'custom'. */
  icon?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP: Record<string, string> = {
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-24 h-24 text-3xl'
};

/**
 * Single source of truth for agent avatars: an uploaded image, a built-in
 * illustration, or the name's initial over a per-agent gradient.
 */
export function AgentAvatar({
  name,
  agentId,
  icon = '',
  size = 'md',
  className = ''
}: AgentAvatarProps) {
  const isCustom = icon === CUSTOM_ICON;
  const customIcon = useAgentIconStore((s) => s.icons[agentId]);
  const ensureIcon = useAgentIconStore((s) => s.ensure);

  useEffect(() => {
    if (isCustom) void ensureIcon(agentId);
  }, [isCustom, agentId, ensureIcon]);

  const box = `shrink-0 rounded-full overflow-hidden flex items-center justify-center ${SIZE_MAP[size]} ${className}`;

  if (isCustom && customIcon) {
    return (
      <div className={`${box} shadow-sm`}>
        <img src={customIcon} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  const key = builtinIconKey(icon);
  if (key) {
    const Icon = AGENT_ICONS[key];
    return (
      <div className={`${box} shadow-sm`}>
        <Icon className="w-full h-full" />
      </div>
    );
  }

  return (
    <div
      className={`${box} text-white font-medium shadow-sm`}
      style={{ background: getAgentGradient(agentId) }}
    >
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}
