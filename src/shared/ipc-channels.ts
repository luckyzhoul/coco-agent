// Agent control channels (renderer -> main)
export const AGENT_SEND_MESSAGE = 'agent:sendMessage';
export const AGENT_ABORT = 'agent:abort';
export const AGENT_NEW_SESSION = 'agent:newSession';
export const AGENT_SWITCH_SESSION = 'agent:switchSession';
export const AGENT_DELETE_SESSION = 'agent:deleteSession';
export const AGENT_LIST_SESSIONS = 'agent:listSessions';
export const AGENT_GET_SESSION_MESSAGES = 'agent:getSessionMessages';
export const AGENT_GET_STATUS = 'agent:getStatus';

// Agent event channels (main -> renderer)
export const AGENT_EVENT_MESSAGE = 'agent:event:message';
export const AGENT_EVENT_TOOL_CALL = 'agent:event:toolCall';
export const AGENT_EVENT_TOOL_RESULT = 'agent:event:toolResult';
export const AGENT_EVENT_STATUS = 'agent:event:status';
export const AGENT_EVENT_ERROR = 'agent:event:error';

// Workspace channels
export const WORKSPACE_SELECT = 'workspace:select';
export const WORKSPACE_GET_CURRENT = 'workspace:getCurrent';
export const WORKSPACE_LIST_RECENT = 'workspace:listRecent';
