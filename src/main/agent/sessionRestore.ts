/**
 * 会话历史回放：把应用 SQLite 里的消息映射成 Pi SDK 的消息列表，
 * 在 switchSession 时经 sessionManager.appendMessage 重建模型上下文。
 *
 * 纯函数、无 Electron 依赖（覆盖于 scripts/test-session-restore.ts）。
 *
 * 注意：应用侧不持久化 assistant 的 api/provider/model，这里用当前激活模型合成
 * 占位值。usage 从 DB 还原（没有则全 0 占位）——SDK 的 getContextUsage 靠最后一条
 * assistant 的真实 usage 计算上下文用量，全 0 会被跳过并退回 chars/4 文本估算，
 * 中文场景误差极大，所以 usage 必须随消息持久化（见 scripts/test-session-restore.ts）。
 */
import type { Message, MessagePart, ToolCall, MessageUsage } from '../../shared/types';

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

const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };

// CJK 区段：汉字、假名、谚文（覆盖中日韩主要字符集）
const CJK_CHAR_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/;

/**
 * CJK 感知的文本 token 估算：中文字符按 ~1 token 计，其余按 chars/4。
 * SDK 自带的 estimateTokens 是纯 chars/4，对中文低估约 4 倍——只用于
 * 老会话（无持久化 usage）切换回放时的用量回填，结果仍是一次估算。
 */
export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK_CHAR_RE.test(ch)) cjk++;
    else other++;
  }
  return Math.ceil(cjk + other / 4);
}

/** 图片块的估算 token（与 SDK 的 ESTIMATED_IMAGE_CHARS 4800 / 4 对齐） */
const ESTIMATED_IMAGE_TOKENS = 1200;

/**
 * 估算一组 Pi 消息的总 token。镜像 SDK estimateTokens 的消息遍历方式，
 * 但文本计数走 estimateTextTokens（CJK 感知）。
 */
export function estimatePiMessagesTokens(messages: PiMessage[]): number {
  let total = 0;
  for (const message of messages) {
    const content = (message as { content?: unknown }).content;
    if (message.role === 'assistant') {
      for (const block of Array.isArray(content) ? content : []) {
        const b = block as Record<string, unknown>;
        if (b.type === 'text') total += estimateTextTokens(b.text as string);
        else if (b.type === 'thinking') total += estimateTextTokens(b.thinking as string);
        else if (b.type === 'toolCall') {
          total += estimateTextTokens(
            String(b.name ?? '') + JSON.stringify(b.arguments ?? {})
          );
        }
      }
      continue;
    }
    // user：string 或内容块数组；toolResult/custom：内容块数组
    if (typeof content === 'string') {
      total += estimateTextTokens(content);
    } else if (Array.isArray(content)) {
      for (const block of content) {
        const b = block as Record<string, unknown>;
        if (b.type === 'text') total += estimateTextTokens(b.text as string);
        else if (b.type === 'image') total += ESTIMATED_IMAGE_TOKENS;
      }
    }
  }
  return total;
}

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
        // 回填合成模型字段与真实 usage（无则保留全 0 占位）
        const assistant = mapped[0] as Record<string, unknown>;
        assistant.api = modelInfo?.api ?? '';
        assistant.provider = modelInfo?.provider ?? '';
        assistant.model = modelInfo?.id ?? '';
        assistant.usage = msg.usage ? { ...msg.usage } : { ...ZERO_USAGE };
        out.push(...mapped);
      }
    } else {
      const mapped = mapLegacyAssistant(msg, modelInfo);
      if (mapped.length > 0) {
        (mapped[0] as Record<string, unknown>).usage = msg.usage
          ? { ...msg.usage }
          : { ...ZERO_USAGE };
      }
      out.push(...mapped);
    }
  }
  return out;
}
