import type { CSSProperties } from 'react';

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

function cn(defaultClass: string, override?: string): string {
  return override ? `${defaultClass} ${override}` : defaultClass;
}

/** Panel glyph with the divider on the left — toggles the session sidebar. */
export function SidebarLeftIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 16 16" fill="none" className={cn('h-4 w-4', className)} aria-hidden>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6 2.75v10.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/** Panel glyph with the divider on the right — toggles the space panel. */
export function SidebarRightIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 16 16" fill="none" className={cn('h-4 w-4', className)} aria-hidden>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" stroke="currentColor" strokeWidth="1.1" />
      <path d="M10 2.75v10.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

// --- 24x24 stroke 风格图标集，与"助手活动"导航图标保持一致 ---

export function PlusIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[15px] h-[15px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[15px] h-[15px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[14px] h-[14px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-2.5 h-2.5', className)} aria-hidden stroke="currentColor" strokeWidth="2.5">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-3 h-3', className)} aria-hidden stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronUpIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-3 h-3', className)} aria-hidden stroke="currentColor" strokeWidth="2">
      <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaperclipIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[14px] h-[14px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 助手活动 — 八向射线/太阳形 */
export function ActivityIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[15px] h-[15px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 任务计划 — 时钟 */
export function ClockIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[15px] h-[15px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

/** Skills — 扳手 */
export function WrenchIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[15px] h-[15px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-[13px] h-[13px]', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

/** 置顶 — 图钉 */
export function PinIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-3 h-3', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 关闭/删除 — X */
export function CloseIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-3 h-3', className)} aria-hidden stroke="currentColor" strokeWidth="1.8">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

/** MCP — 插头 */
export function PlugIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-3.5 h-3.5', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M9 2v6M15 2v6" strokeLinecap="round" />
      <path d="M6 8h12v4a6 6 0 0 1-12 0V8z" strokeLinejoin="round" />
      <path d="M12 18v4" strokeLinecap="round" />
    </svg>
  );
}

/** 通用设置 — 齿轮 */
export function CogIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Agent — 用户/人脸 */
export function UserIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

/** 安全 — 盾牌 */
export function ShieldIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z" strokeLinejoin="round" />
    </svg>
  );
}

/** 模型 — 大脑 */
export function BrainIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M9 4.5c-1.5 0-2.5 1-2.5 2.5 0 .5.2 1 .5 1.5C5.5 8.5 4.5 9.5 4.5 11c0 1.5 1 2.5 2 2.5 0 1.5 1 2.5 2.5 2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5c1.5 0 2.5 1 2.5 2.5 0 .5-.2 1-.5 1.5 1.5 0 2.5 1 2.5 2.5 0 1.5-1 2.5-2 2.5 0 1.5-1 2.5-2.5 2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 4.5v11.5M15 4.5v11.5" strokeLinecap="round" />
      <path d="M9 16c0 1.5 1 3 3 3s3-1.5 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 更新 — 向上箭头 */
export function UploadIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M12 19V5" strokeLinecap="round" />
      <path d="m5 12 7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 拼图（技能tab用）— 拼图块 */
export function PuzzleIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M10 4h4v2.5a2.5 2.5 0 0 0 5 0V4h2v4h-2.5a2.5 2.5 0 0 0 0 5H21v4h-4v-2.5a2.5 2.5 0 0 0-5 0V17H8v-2.5a2.5 2.5 0 0 0-5 0H3v-4h2.5a2.5 2.5 0 0 0 0-5H3V4h4v2.5a2.5 2.5 0 0 0 3 0V4z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 勾选 — 对号 */
export function CheckIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="2">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 复制 — 两个叠加的圆角矩形 */
export function CopyIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" />
    </svg>
  );
}

/** 刷新 — 环形箭头 */
export function RefreshCwIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 警告 — 三角感叹号 */
export function AlertIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3 2 21h20L12 3z" strokeLinejoin="round" />
      <path d="M12 9v5M12 17v.01" strokeLinecap="round" />
    </svg>
  );
}

/** 星星/闪烁 — 空状态装饰 */
export function SparkleIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-6 h-6', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 下载/向下箭头 — 拖拽安装区 */
export function DownloadIcon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3v12" strokeLinecap="round" />
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" strokeLinecap="round" />
    </svg>
  );
}

/** 文件夹 */
export function Folder2Icon({ className, style }: IconProps) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" className={cn('w-4 h-4', className)} aria-hidden stroke="currentColor" strokeWidth="1.5">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
