// Agent control channels (renderer -> main)
export const AGENT_SEND_MESSAGE = 'agent:sendMessage';
export const AGENT_ABORT = 'agent:abort';
export const AGENT_NEW_SESSION = 'agent:newSession';
export const AGENT_SWITCH_SESSION = 'agent:switchSession';
export const AGENT_DELETE_SESSION = 'agent:deleteSession';
export const AGENT_LIST_SESSIONS = 'agent:listSessions';
export const AGENT_GET_SESSION_MESSAGES = 'agent:getSessionMessages';
export const AGENT_GET_STATUS = 'agent:getStatus';
export const AGENT_SEARCH_SESSIONS = 'agent:searchSessions';
export const AGENT_PIN_SESSION = 'agent:pinSession';
export const AGENT_REBIND_WORKSPACE = 'agent:rebindWorkspace';

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
export const WORKSPACE_GET_DEFAULT = 'workspace:getDefault';
export const WORKSPACE_SET_DEFAULT = 'workspace:setDefault';
export const WORKSPACE_SET_CURRENT = 'workspace:setCurrent';

// Project space file browsing (scoped to the current space)
export const WORKSPACE_LIST_FILES = 'workspace:listFiles';
export const WORKSPACE_READ_FILE = 'workspace:readFile';
export const WORKSPACE_WRITE_FILE = 'workspace:writeFile';
export const WORKSPACE_OPEN_IN_OS = 'workspace:openInOS';

// Settings channels
export const SETTINGS_GET = 'settings:get';
export const SETTINGS_SET = 'settings:set';
export const SETTINGS_RESET = 'settings:reset';

// Model channels
export const MODELS_LIST = 'models:list';
export const MODELS_ADD = 'models:add';
export const MODELS_UPDATE = 'models:update';
export const MODELS_DELETE = 'models:delete';
export const MODELS_SET_ACTIVE = 'models:setActive';
export const MODELS_GET_ACTIVE = 'models:getActive';
export const MODELS_TEST = 'models:test';

// MCP channels
export const MCP_LIST = 'mcp:list';
export const MCP_ADD = 'mcp:add';
export const MCP_UPDATE = 'mcp:update';
export const MCP_DELETE = 'mcp:delete';
export const MCP_START = 'mcp:start';
export const MCP_STOP = 'mcp:stop';
export const MCP_RESTART = 'mcp:restart';
export const MCP_GET_STATUS = 'mcp:getStatus';
export const MCP_LIST_TOOLS = 'mcp:listTools';

// MCP event channels
export const MCP_EVENT_STATUS_CHANGED = 'mcp:event:statusChanged';

// Skills channels
export const SKILLS_LIST = 'skills:list';
export const SKILLS_GET_DETAIL = 'skills:getDetail';
export const SKILLS_RELOAD = 'skills:reload';
export const SKILLS_INSTALL = 'skills:install';
export const SKILLS_UNINSTALL = 'skills:uninstall';
export const SKILLS_GET_CONTENT = 'skills:getContent';
export const SKILLS_OPEN_DIR = 'skills:openDir';
export const SKILLS_INSTALL_FROM_SOURCE = 'skills:installFromSource';
export const SKILLS_FETCH_CATALOG = 'skills:fetchCatalog';
export const SKILLS_INSTALL_FROM_CATALOG = 'skills:installFromCatalog';

// Tool approval channels
export const TOOL_APPROVAL_REQUEST = 'tool:approvalRequest';
export const TOOL_APPROVAL_RESPONSE = 'tool:approvalResponse';
export const TOOL_APPROVAL_SET_AUTO = 'tool:approvalSetAuto';

// Browser (agent-controlled) channels
export const BROWSER_GET_STATUS = 'browser:getStatus';
export const BROWSER_SET_VISIBLE = 'browser:setVisible';
export const BROWSER_CLOSE = 'browser:close';

// Computer use channels
export const COMPUTER_GET_SCREEN_INFO = 'computer:getScreenInfo';

// App-level channels
export const APP_GET_PATHS = 'app:getPaths';
export const APP_OPEN_HOME = 'app:openHome';

// Security channels
export const SECURITY_GET = 'security:get';
export const SECURITY_SET_LEVEL = 'security:setLevel';
export const SECURITY_CHECK = 'security:check';

// Agent channels
export const AGENTS_LIST = 'agents:list';
export const AGENTS_CREATE = 'agents:create';
export const AGENTS_UPDATE = 'agents:update';
export const AGENTS_DELETE = 'agents:delete';
export const AGENTS_GET_ACTIVE = 'agents:getActive';
export const AGENTS_SET_ACTIVE = 'agents:setActive';
export const AGENTS_GET_PERSONA = 'agents:getPersona';
export const AGENTS_SET_PERSONA = 'agents:setPersona';

// Auto-update channels
export const UPDATE_GET_STATUS = 'update:getStatus';
export const UPDATE_CHECK = 'update:check';
export const UPDATE_DOWNLOAD = 'update:download';
export const UPDATE_QUIT_AND_INSTALL = 'update:quitAndInstall';
export const UPDATE_SET_FEED = 'update:setFeed';
export const UPDATE_EVENT = 'update:event';

// Window control channels
export const WINDOW_MINIMIZE = 'window:minimize';
export const WINDOW_TOGGLE_MAXIMIZE = 'window:toggleMaximize';
export const WINDOW_CLOSE = 'window:close';
export const WINDOW_IS_MAXIMIZED = 'window:isMaximized';
