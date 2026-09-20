import { create } from 'zustand';
import type { Message, AgentStatus, ToolCall } from '@shared/types';

interface ChatState {
  messages: Message[];
  status: AgentStatus;
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  setActiveSession: (sessionId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
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

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),

  updateToolCall: (messageId, toolCall) =>
    set((state) => {
      // Find the last assistant message and attach tool call
      const lastAssistantIdx = [...state.messages].reverse().findIndex(
        (m) => m.role === 'assistant'
      );

      if (lastAssistantIdx === -1) {
        // Create a placeholder assistant message
        const placeholder: Message = {
          id: `msg_${Date.now()}_a_placeholder`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolCalls: [toolCall]
        };
        return { messages: [...state.messages, placeholder] };
      }

      const realIdx = state.messages.length - 1 - lastAssistantIdx;
      const updated = [...state.messages];
      const target = { ...updated[realIdx] };
      target.toolCalls = [
        ...(target.toolCalls || []).filter((t) => t.id !== toolCall.id),
        toolCall
      ];
      updated[realIdx] = target;
      return { messages: updated };
    }),

  updateToolResult: (toolCallId, output, status) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (!msg.toolCalls) return msg;
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.id === toolCallId
              ? { ...tc, output, status: status as ToolCall['status'] }
              : tc
          )
        };
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
