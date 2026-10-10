import type { SecurityLevel } from '@shared/types';

/**
 * 安全模式四档的唯一定义：ChatInput 的选择器（label + hint）和设置页
 * （label + detail）共用，保证两处文案与顺序一致。图标与配色见 modeIcons。
 */

export interface SecurityModeOption {
  value: SecurityLevel;
  label: string;
  /** 选择器下拉里的一句话提示。 */
  hint: string;
  /** 设置页里的完整说明。 */
  detail: string;
  recommended?: boolean;
}

export const SECURITY_MODES: SecurityModeOption[] = [
  {
    value: 'auto',
    label: '自动审核',
    recommended: true,
    hint: '空间内可写，越界需批准',
    detail:
      '平时可只读访问系统普通文件；项目空间、授权目录和 CocoAgent 数据目录内可自由写入，越界写入与危险 shell 命令会先征求你的批准。'
  },
  {
    value: 'full',
    label: '完整权限',
    hint: '无限制',
    detail: '不限制路径，不弹出确认。Agent 的权限完全由它自己判断。'
  },
  {
    value: 'ask',
    label: '操作前询问',
    hint: '每次操作先确认',
    detail: '每次写入、删除或执行命令都会先弹窗确认，批准才会执行。'
  },
  {
    value: 'readonly',
    label: '只读模式',
    hint: '禁止写入',
    detail: '写入、删除和 shell 调用会被安全层直接拒绝，只有读取类操作可用。'
  }
];
