import { create } from 'zustand';
import type {
  Message,
  AgentStatus,
  ToolCall,
  MessagePart,
  TextPart,
  ThinkingPart,
  ToolCallPart,
  FileDeliveryPart,
  SummaryPart,
  TurnSummary
} from '@shared/types';

// ===== helpers =====

function mergeToolCalls(
  existing: ToolCall[] | undefined,
  incoming: ToolCall[] | undefined
): ToolCall[] | undefined {
  if (!incoming || incoming.length === 0) return existing;
  if (!existing || existing.length === 0) return incoming;
  const map = new Map<string, ToolCall>();
  for (const tc of existing) map.set(tc.id, tc);
  for (const tc of incoming) map.set(tc.id, tc);
  return Array.from(map.values());
}

/**
 * Merge two part arrays, deduping by part.index.
 * Incoming parts with the same index overwrite existing ones.
 * Parts are sorted by index after merging.
 */
function mergeParts(
  target: MessagePart[] | undefined,
  incoming: MessagePart[] | undefined
): MessagePart[] {
  if (!incoming || incoming.length === 0) return target || [];
  if (!target || target.length === 0) return [...incoming];

  const byIndex = new Map<number, MessagePart>();
  for (const p of target) byIndex.set(p.index, p);
  for (const p of incoming) byIndex.set(p.index, p);

  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

/**
 * Merge consecutive assistant messages from DB into one display message.
 * Used only by setMessages (history loading); realtime streaming uses deltas.
 */
function mergeConsecutiveAssistants(messages: Message[]): Message[] {
  const result: Message[] = [];
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      const last = result[result.length - 1];
      if (last && last.role === 'assistant') {
        const mergedParts = mergeParts(last.parts, msg.parts);
        const mergedTools = mergeToolCalls(last.toolCalls, msg.toolCalls);
        const mergedContent = [last.content, msg.content].filter(Boolean).join('\n\n');
        result[result.length - 1] = {
          ...last,
          content: mergedContent || msg.content || last.content || '',
          parts: mergedParts.length > 0 ? mergedParts : undefined,
          toolCalls: mergedTools,
          timestamp: msg.timestamp
        };
        continue;
      }
    }
    result.push(msg);
  }
  return result;
}

function findLastUserIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i;
  }
  return -1;
}

function findLastAssistantIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return i;
  }
  return -1;
}

function ensureLastAssistant(messages: Message[]): { msgs: Message[]; idx: number } {
  const idx = findLastAssistantIndex(messages);
  if (idx >= 0) return { msgs: messages, idx };
  const placeholder: Message = {
    id: `msg_${Date.now()}_a_placeholder`,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    parts: []
  };
  return { msgs: [...messages, placeholder], idx: messages.length };
}

// ===== store =====

interface ChatState {
  messages: Message[];
  status: AgentStatus;
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  setActiveSession: (sessionId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  finishMessage: (messageId: string) => void;
  appendTextDelta: (messageId: string, partIndex: number, delta: string) => void;
  startThinking: (messageId: string, partIndex: number) => void;
  appendThinkingDelta: (messageId: string, partIndex: number, delta: string, state?: 'generating' | 'done') => void;
  addToolCallPart: (messageId: string, partIndex: number, toolCall: ToolCall) => void;
  updateToolCallPart: (messageId: string, partIndex: number, updates: Partial<ToolCall>) => void;
  addFileDelivery: (messageId: string, partIndex: number, file: { filePath: string; fileName: string; action: 'create' | 'edit'; fileSize?: number }) => void;
  addSummaryPart: (messageId: string, partIndex: number, summary: TurnSummary) => void;
  removeTrailingAssistantMessages: () => void;
  updateToolCall: (messageId: string, toolCall: ToolCall) => void;
  updateToolResult: (toolCallId: string, output: string, status: string) => void;
  setStatus: (status: AgentStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  status: { sessionId: null, state: 'idle' },
  activeSessionId: null,
  isLoading: false,
  error: null,

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  setMessages: (messages) =>
    set({ messages: mergeConsecutiveAssistants(messages) }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  finishMessage: (messageId) =>
    set((state) => {
      const idx = findLastAssistantIndex(state.messages);
      if (idx < 0) return { messages: state.messages };
      const msg = state.messages[idx];
      const parts = msg.parts?.map((p) => {
        if (p.type === 'text') return { ...p, streaming: false };
        if (p.type === 'thinking') return { ...p, state: 'done' as const };
        return p;
      });
      const updated = [...state.messages];
      updated[idx] = { ...msg, parts };
      return { messages: updated };
    }),

  appendTextDelta: (messageId, partIndex, delta) =>
    set((state) => {
      const { msgs, idx } = ensureLastAssistant(state.messages);
      const msg = msgs[idx];
      const parts = [...(msg.parts || [])];

      let textPart = parts.find(
        (p): p is TextPart => p.type === 'text' && p.index === partIndex
      ) as TextPart | undefined;

      if (!textPart) {
        // Create the text part at the right position (or append)
        const newPart: TextPart = {
          id: `text_${Date.now()}_${partIndex}`,
          type: 'text',
          index: partIndex,
          content: delta,
          streaming: true
        };
        // Insert at correct position by index, or append
        const insertIdx = parts.findIndex((p) => p.index > partIndex);
        if (insertIdx >= 0) {
          parts.splice(insertIdx, 0, newPart);
        } else {
          parts.push(newPart);
        }
      } else {
        const partIdx = parts.findIndex((p) => p.index === partIndex);
        parts[partIdx] = {
          ...textPart,
          content: textPart.content + delta
        };
      }

      const updated = [...msgs];
      updated[idx] = { ...msg, parts, content: msg.content + delta };
      return { messages: updated };
    }),

  startThinking: (messageId, partIndex) =>
    set((state) => {
      const { msgs, idx } = ensureLastAssistant(state.messages);
      const msg = msgs[idx];
      const parts = [...(msg.parts || [])];

      const exists = parts.some(
        (p): p is ThinkingPart => p.type === 'thinking' && p.index === partIndex
      );
      if (exists) return { messages: msgs };

      const newPart: ThinkingPart = {
        id: `think_${Date.now()}_${partIndex}`,
        type: 'thinking',
        index: partIndex,
        content: '',
        state: 'generating'
      };
      const insertIdx = parts.findIndex((p) => p.index > partIndex);
      if (insertIdx >= 0) {
        parts.splice(insertIdx, 0, newPart);
      } else {
        parts.push(newPart);
      }

      const updated = [...msgs];
      updated[idx] = { ...msg, parts };
      return { messages: updated };
    }),

  appendThinkingDelta: (messageId, partIndex, delta, state) =>
    set((prev) => {
      const { msgs, idx } = ensureLastAssistant(prev.messages);
      const msg = msgs[idx];
      const parts = [...(msg.parts || [])];

      let thinkPart = parts.find(
        (p): p is ThinkingPart => p.type === 'thinking' && p.index === partIndex
      );

      if (!thinkPart) {
        const newPart: ThinkingPart = {
          id: `think_${Date.now()}_${partIndex}`,
          type: 'thinking',
          index: partIndex,
          content: delta,
          state: state || 'generating'
        };
        const insertIdx = parts.findIndex((p) => p.index > partIndex);
        if (insertIdx >= 0) {
          parts.splice(insertIdx, 0, newPart);
        } else {
          parts.push(newPart);
        }
      } else {
        const partIdx = parts.findIndex((p) => p.index === partIndex);
        parts[partIdx] = {
          ...thinkPart,
          content: thinkPart.content + delta,
          state: state || thinkPart.state
        };
      }

      const updated = [...msgs];
      updated[idx] = { ...msg, parts };
      return { messages: updated };
    }),

  addToolCallPart: (messageId, partIndex, toolCall) =>
    set((state) => {
      const { msgs, idx } = ensureLastAssistant(state.messages);
      const msg = msgs[idx];
      const parts = [...(msg.parts || [])];

      // Update existing or add new
      const existingIdx = parts.findIndex(
        (p): p is ToolCallPart =>
          p.type === 'tool_call' && p.toolCall.id === toolCall.id
      );

      if (existingIdx >= 0) {
        const existing = parts[existingIdx] as ToolCallPart;
        parts[existingIdx] = {
          ...existing,
          toolCall: { ...existing.toolCall, ...toolCall }
        };
      } else {
        const newPart: ToolCallPart = {
          id: `tool_${Date.now()}_${partIndex}`,
          type: 'tool_call',
          index: partIndex,
          toolCall
        };
        const insertIdx = parts.findIndex((p) => p.index > partIndex);
        if (insertIdx >= 0) {
          parts.splice(insertIdx, 0, newPart);
        } else {
          parts.push(newPart);
        }
      }

      const updated = [...msgs];
      updated[idx] = { ...msg, parts };
      return { messages: updated };
    }),

  updateToolCallPart: (messageId, partIndex, updates) =>
    set((state) => {
      const idx = findLastAssistantIndex(state.messages);
      if (idx < 0) return { messages: state.messages };

      const msg = state.messages[idx];
      const parts = [...(msg.parts || [])];
      const partIdx = parts.findIndex(
        (p): p is ToolCallPart =>
          p.type === 'tool_call' && p.index === partIndex
      );
      if (partIdx < 0) return { messages: state.messages };

      const existing = parts[partIdx] as ToolCallPart;
      parts[partIdx] = {
        ...existing,
        toolCall: { ...existing.toolCall, ...updates }
      };

      const updated = [...state.messages];
      updated[idx] = { ...msg, parts };
      return { messages: updated };
    }),

  addFileDelivery: (messageId, partIndex, file) =>
    set((state) => {
      const { msgs, idx } = ensureLastAssistant(state.messages);
      const msg = msgs[idx];
      const parts = [...(msg.parts || [])];

      const existingIdx = parts.findIndex(
        (p) => p.type === 'file_delivery' && (p as import('@shared/types').FileDeliveryPart).filePath === file.filePath
      );
      if (existingIdx >= 0) return { messages: msgs };

      const newPart: import('@shared/types').FileDeliveryPart = {
        id: `file_${Date.now()}_${partIndex}`,
        type: 'file_delivery',
        index: partIndex,
        filePath: file.filePath,
        fileName: file.fileName,
        action: file.action,
        fileSize: file.fileSize
      };
      const insertIdx = parts.findIndex((p) => p.index > partIndex);
      if (insertIdx >= 0) {
        parts.splice(insertIdx, 0, newPart);
      } else {
        parts.push(newPart);
      }

      const updated = [...msgs];
      updated[idx] = { ...msg, parts };
      return { messages: updated };
    }),

  addSummaryPart: (messageId, partIndex, summary) =>
    set((state) => {
      const { msgs, idx } = ensureLastAssistant(state.messages);
      const msg = msgs[idx];
      const parts = [...(msg.parts || [])];

      const existingIdx = parts.findIndex((p) => p.index === partIndex);
      if (existingIdx >= 0) return { messages: msgs };

      const newPart: SummaryPart = {
        id: `summary_${Date.now()}_${partIndex}`,
        type: 'summary',
        index: partIndex,
        summary
      };
      const insertIdx = parts.findIndex((p) => p.index > partIndex);
      if (insertIdx >= 0) {
        parts.splice(insertIdx, 0, newPart);
      } else {
        parts.push(newPart);
      }

      const updated = [...msgs];
      updated[idx] = { ...msg, parts };
      return { messages: updated };
    }),

  /** 重新生成前清掉最后一条用户消息之后的所有助手消息 */
  removeTrailingAssistantMessages: () =>
    set((state) => {
      const lastUserIdx = findLastUserIndex(state.messages);
      if (lastUserIdx < 0) return { messages: state.messages };
      return { messages: state.messages.slice(0, lastUserIdx + 1) };
    }),

  // Legacy: attach a tool call to the last assistant message
  updateToolCall: (messageId, toolCall) =>
    set((state) => {
      const lastIdx = findLastAssistantIndex(state.messages);

      if (lastIdx === -1) {
        const placeholder: Message = {
          id: `msg_${Date.now()}_a_placeholder`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          parts: [
            {
              id: `tool_${Date.now()}_0`,
              type: 'tool_call',
              index: 0,
              toolCall
            }
          ],
          toolCalls: [toolCall]
        };
        return { messages: [...state.messages, placeholder] };
      }

      const updated = [...state.messages];
      const target = { ...updated[lastIdx] };
      target.toolCalls = [
        ...(target.toolCalls || []).filter((t) => t.id !== toolCall.id),
        toolCall
      ];
      // Also update parts if they exist
      if (target.parts) {
        const parts = [...target.parts];
        const tpIdx = parts.findIndex(
          (p): p is ToolCallPart =>
            p.type === 'tool_call' && p.toolCall.id === toolCall.id
        );
        if (tpIdx >= 0) {
          const existing = parts[tpIdx] as ToolCallPart;
          parts[tpIdx] = { ...existing, toolCall };
        } else {
          parts.push({
            id: `tool_${Date.now()}_${parts.length}`,
            type: 'tool_call',
            index: parts.length,
            toolCall
          });
        }
        target.parts = parts;
      }
      updated[lastIdx] = target;
      return { messages: updated };
    }),

  updateToolResult: (toolCallId, output, status) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.role !== 'assistant') return msg;
        let changed = false;

        let toolCalls = msg.toolCalls;
        if (toolCalls) {
          toolCalls = toolCalls.map((tc) =>
            tc.id === toolCallId
              ? { ...tc, output, status: status as ToolCall['status'] }
              : tc
          );
          changed = true;
        }

        let parts = msg.parts;
        if (parts) {
          parts = parts.map((p) => {
            if (p.type === 'tool_call' && p.toolCall.id === toolCallId) {
              changed = true;
              return {
                ...p,
                toolCall: {
                  ...p.toolCall,
                  output,
                  status: status as ToolCall['status']
                }
              };
            }
            return p;
          });
        }

        if (!changed) return msg;
        return { ...msg, toolCalls, parts };
      })
    })),

  setStatus: (status) => set({ status }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      messages: [],
      activeSessionId: null,
      isLoading: false,
      error: null
    })
}));
