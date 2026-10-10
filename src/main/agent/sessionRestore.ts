/**
 * 会话历史回放：把应用 SQLite 里的消息映射成 Pi SDK 的消息列表，
 * 在 switchSession 时经 sessionManager.appendMessage 重建模型上下文。
 *
 * 纯函数、无 Electron 依赖（覆盖于 scripts/test-session-restore.ts）。
 *
 * 注意：应用侧不持久化 assistant 的 api/provider/model/usage，这里用当前激活
 * 模型合成占位值（usage 全 0）——它们不影响上下文重建与 token 估算的正确性。
 */
import type { Message, MessagePart, ToolCall } from '../../shared/types';

/** pi-ai 的消息类型（结构性声明，避免运行时依赖 SDK 内部路径） */
export interface PiMessage {
  role: 'user' | 'assistant' | 'toolResult';
  /** user 为 string 或内容块数组；assistant/toolResult 为内容块数组 */
  content: unknown;
  timestamp: number;
  [key: string]: unknown;
}

export interface ModelInfo {
  api: string;
  provider: string;
  id: string;
}

const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };

/** 有结果可回放的 toolCall（被中断的 pending/running 没有结果，跳过） */
function hasResult(call: ToolCall): boolean {
  return call.status === 'success' || call.status === 'error';
}

function toolCallBlocks(call: ToolCall): { block: Record<string, unknown> | null; result: Record<string, unknown> | null } {
  // 被中断的调用（pending/running）块和结果一起丢：多数 API 要求
  // 每个 tool_use 必须有配对的 tool_result，留着块会让请求被拒。
  if (!hasResult(call)) {
    return { block: null, result: null };
  }
  const block = { type: 'toolCall', id: call.id, name: call.name, arguments: call.input ?? {} };
  const isError = call.status === 'error';
  const text = isError ? (call.error ?? '') : (call.output ?? '');
  const result = {
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: 'text', text }],
    isError,
    timestamp: 0, // 由调用方按宿主消息时间回填
  };
  return { block, result };
}

function mapAssistantParts(parts: MessagePart[], timestamp: number): PiMessage[] {
  const content: Record<string, unknown>[] = [];
  const results: Record<string, unknown>[] = [];
  let hasToolCall = false;

  for (const part of parts) {
    if (part.type === 'text') {
      if (part.content) content.push({ type: 'text', text: part.content });
    } else if (part.type === 'thinking') {
      if (part.content) content.push({ type: 'thinking', thinking: part.content });
    } else if (part.type === 'tool_call') {
      const { block, result } = toolCallBlocks(part.toolCall);
      if (block) {
        content.push(block);
        hasToolCall = true;
      }
      if (result) results.push(result);
    }
    // file_delivery / summary 是 UI 专属分段，不进模型上下文
  }

  if (content.length === 0) return [];

  for (const r of results) r.timestamp = timestamp;
  const assistant: PiMessage = {
    role: 'assistant',
    content,
    api: '',
    provider: '',
    model: '',
    usage: { ...ZERO_USAGE },
    stopReason: hasToolCall ? 'toolUse' : 'stop',
    timestamp,
  };
  return [assistant, ...results as PiMessage[]];
}

/** 旧格式消息：无 parts，只有 content 文本与顶层 toolCalls 字段 */
function mapLegacyAssistant(msg: Message, modelInfo: ModelInfo | null): PiMessage[] {
  const content: Record<string, unknown>[] = [];
  const results: Record<string, unknown>[] = [];
  let hasToolCall = false;

  if (msg.content) content.push({ type: 'text', text: msg.content });
  for (const call of msg.toolCalls ?? []) {
    const { block, result } = toolCallBlocks(call);
    if (block) {
      content.push(block);
      hasToolCall = true;
    }
    if (result) results.push(result);
  }

  if (content.length === 0) return [];
  for (const r of results) r.timestamp = msg.timestamp;
  const assistant: PiMessage = {
    role: 'assistant',
    content,
    api: modelInfo?.api ?? '',
    provider: modelInfo?.provider ?? '',
    model: modelInfo?.id ?? '',
    usage: { ...ZERO_USAGE },
    stopReason: hasToolCall ? 'toolUse' : 'stop',
    timestamp: msg.timestamp,
  };
  return [assistant, ...results as PiMessage[]];
}

/**
 * 应用消息列表 → Pi 消息列表（顺序保持）。
 * system 消息与空内容消息跳过；被中断的 toolCall 只丢块不丢文本。
 */
export function toPiMessages(messages: Message[], modelInfo: ModelInfo | null): PiMessage[] {
  const out: PiMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      if (msg.content && msg.content.trim()) {
        out.push({ role: 'user', content: msg.content, timestamp: msg.timestamp });
      }
      continue;
    }
    if (msg.role !== 'assistant') continue; // system 是 UI 专属

    if (msg.parts && msg.parts.length > 0) {
      const mapped = mapAssistantParts(msg.parts, msg.timestamp);
      if (mapped.length > 0) {
        // 回填合成模型字段
        const assistant = mapped[0] as Record<string, unknown>;
        assistant.api = modelInfo?.api ?? '';
        assistant.provider = modelInfo?.provider ?? '';
        assistant.model = modelInfo?.id ?? '';
        out.push(...mapped);
      }
    } else {
      out.push(...mapLegacyAssistant(msg, modelInfo));
    }
  }
  return out;
}
