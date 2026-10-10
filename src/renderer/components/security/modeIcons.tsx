import type { SecurityLevel } from '@shared/types';

/**
 * 安全模式四档的图标与配色，对齐设计稿：
 * 自动审核=盾牌 / 完整权限=终端 `>_` / 操作前询问=问号 / 只读模式=书。
 * ChatInput 选择器与设置页共用，保证两处观感一致。
 */

export const SECURITY_MODE_STYLES: Record<SecurityLevel, string> = {
  auto: 'text-muted-foreground',
  full: 'text-amber-500',
  ask: 'text-sky-500',
  readonly: 'text-emerald-500'
};

export function SecurityModeIcon({
  mode,
  className = 'w-4 h-4'
}: {
  mode: SecurityLevel;
  className?: string;
}) {
  switch (mode) {
    case 'auto': // 盾牌
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'full': // 终端 >_
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    case 'ask': // 问号圆圈
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'readonly': // 打开的书
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
  }
}
