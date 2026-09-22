import React from 'react';
import { getAgentGradient } from '../../utils/agentColors';

interface AgentAvatarProps {
  name: string;
  agentId: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP: Record<string, string> = {
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-24 h-24 text-3xl'
};

export function AgentAvatar({ name, agentId, size = 'md', className = '' }: AgentAvatarProps) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const gradient = getAgentGradient(agentId);

  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center text-white font-medium shadow-sm ${SIZE_MAP[size]} ${className}`}
      style={{ background: gradient }}
    >
      {initial}
    </div>
  );
}
