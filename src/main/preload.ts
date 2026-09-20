import { contextBridge, ipcRenderer } from 'electron';
import type { Message, SessionInfo, AgentStatus, WorkspaceInfo } from '../shared/types';
import {
  AGENT_SEND_MESSAGE,
  AGENT_ABORT,
  AGENT_NEW_SESSION,
  AGENT_SWITCH_SESSION,
  AGENT_DELETE_SESSION,
  AGENT_LIST_SESSIONS,
  AGENT_GET_SESSION_MESSAGES,
  AGENT_GET_STATUS,
  AGENT_EVENT_MESSAGE,
  AGENT_EVENT_TOOL_CALL,
  AGENT_EVENT_TOOL_RESULT,
  AGENT_EVENT_STATUS,
  AGENT_EVENT_ERROR,
  WORKSPACE_SELECT,
  WORKSPACE_GET_CURRENT,
  WORKSPACE_LIST_RECENT
} from '../shared/ipc-channels';

const electronAPI = {
  agent: {
    sendMessage: (content: string) =>
      ipcRenderer.invoke(AGENT_SEND_MESSAGE, content),
    abort: () => ipcRenderer.invoke(AGENT_ABORT),
    newSession: (workspacePath: string) =>
      ipcRenderer.invoke(AGENT_NEW_SESSION, workspacePath),
    switchSession: (sessionId: string) =>
      ipcRenderer.invoke(AGENT_SWITCH_SESSION, sessionId),
    deleteSession: (sessionId: string) =>
      ipcRenderer.invoke(AGENT_DELETE_SESSION, sessionId),
    listSessions: () =>
      ipcRenderer.invoke(AGENT_LIST_SESSIONS) as Promise<SessionInfo[]>,
    getSessionMessages: (sessionId: string) =>
      ipcRenderer.invoke(AGENT_GET_SESSION_MESSAGES, sessionId) as Promise<Message[]>,
    getStatus: () =>
      ipcRenderer.invoke(AGENT_GET_STATUS) as Promise<AgentStatus>
  },
  workspace: {
    select: () =>
      ipcRenderer.invoke(WORKSPACE_SELECT) as Promise<WorkspaceInfo | null>,
    getCurrent: () =>
      ipcRenderer.invoke(WORKSPACE_GET_CURRENT) as Promise<WorkspaceInfo | null>,
    listRecent: () =>
      ipcRenderer.invoke(WORKSPACE_LIST_RECENT) as Promise<WorkspaceInfo[]>
  },
  on: {
    agentMessage: (callback: (msg: Message) => void) => {
      const listener = (_: unknown, msg: Message) => callback(msg);
      ipcRenderer.on(AGENT_EVENT_MESSAGE, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_MESSAGE, listener);
    },
    agentToolCall: (callback: (data: { toolCall: unknown; messageId: string }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { toolCall: unknown; messageId: string });
      ipcRenderer.on(AGENT_EVENT_TOOL_CALL, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_TOOL_CALL, listener);
    },
    agentToolResult: (callback: (data: { toolCallId: string; output: string; status: string }) => void) => {
      const listener = (_: unknown, data: unknown) =>
        callback(data as { toolCallId: string; output: string; status: string });
      ipcRenderer.on(AGENT_EVENT_TOOL_RESULT, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_TOOL_RESULT, listener);
    },
    agentStatus: (callback: (status: AgentStatus) => void) => {
      const listener = (_: unknown, status: AgentStatus) => callback(status);
      ipcRenderer.on(AGENT_EVENT_STATUS, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_STATUS, listener);
    },
    agentError: (callback: (error: string) => void) => {
      const listener = (_: unknown, error: string) => callback(error);
      ipcRenderer.on(AGENT_EVENT_ERROR, listener);
      return () => ipcRenderer.removeListener(AGENT_EVENT_ERROR, listener);
    }
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
