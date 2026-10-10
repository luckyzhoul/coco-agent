import { toPiMessages } from '../src/main/agent/sessionRestore';
import type { Message } from '../src/shared/types';

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('ok  :', msg);
}

const MODEL = { api: 'openai-completions' as const, provider: 'test-provider', id: 'test-model' };

// --- user 消息 ---
const [user] = toPiMessages(
  [{ id: 'm1', role: 'user', content: '你好', timestamp: 1000 }] as Message[],
  MODEL
);
assert(user && user.role === 'user' && user.content === '你好', 'user message maps to UserMessage');
assert((user as any).timestamp === 1000, 'user message keeps timestamp');

// --- assistant 纯文本 ---
const [assist] = toPiMessages(
  [{
    id: 'm2', role: 'assistant', timestamp: 2000,
    parts: [{ id: 'p1', index: 0, type: 'text', content: '回答', state: 'done' } as any]
  }] as Message[],
  MODEL
);
assert(assist && assist.role === 'assistant', 'assistant maps to AssistantMessage');
assert(JSON.stringify((assist as any).content) === JSON.stringify([{ type: 'text', text: '回答' }]),
  'text part becomes text block');
assert((assist as any).stopReason === 'stop', 'no tool calls -> stopReason stop');
assert((assist as any).api === MODEL.api && (assist as any).provider === MODEL.provider && (assist as any).model === MODEL.id,
  'synthetic model fields filled');

// --- assistant thinking + text 顺序保持 ---
const [think] = toPiMessages(
  [{
    id: 'm3', role: 'assistant', timestamp: 3000,
    parts: [
      { id: 'p1', index: 0, type: 'thinking', content: '思考', state: 'done' } as any,
      { id: 'p2', index: 1, type: 'text', content: '结论', state: 'done' } as any
    ]
  }] as Message[],
  MODEL
);
assert(
  (think as any).content[0].type === 'thinking' && (think as any).content[0].thinking === '思考' &&
  (think as any).content[1].type === 'text' && (think as any).content[1].text === '结论',
  'thinking before text, order preserved'
);

// --- toolCall + output 配对成 toolResult ---
const toolMsgs = toPiMessages(
  [{
    id: 'm4', role: 'assistant', timestamp: 4000,
    parts: [
      { id: 'p1', index: 0, type: 'text', content: '读文件' } as any,
      {
        id: 'p2', index: 1, type: 'tool_call',
        toolCall: { id: 'tc1', name: 'read', input: { path: 'a.ts' }, status: 'success', output: '文件内容' }
      } as any
    ]
  }] as Message[],
  MODEL
);
assert(toolMsgs.length === 2, 'tool call produces assistant + toolResult');
const ta: any = toolMsgs[0];
const tr: any = toolMsgs[1];
assert(ta.stopReason === 'toolUse', 'tool calls -> stopReason toolUse');
assert(JSON.stringify(ta.content[1]) === JSON.stringify({ type: 'toolCall', id: 'tc1', name: 'read', arguments: { path: 'a.ts' } }),
  'toolCall block has id/name/arguments');
assert(tr.role === 'toolResult' && tr.toolCallId === 'tc1' && tr.toolName === 'read',
  'toolResult pairs with toolCallId/toolName');
assert(tr.content[0].text === '文件内容' && tr.isError === false, 'toolResult success content');

// --- 工具报错 -> isError true ---
const [errAssist, errResult] = toPiMessages(
  [{
    id: 'm5', role: 'assistant', timestamp: 5000,
    parts: [{
      id: 'p1', index: 0, type: 'tool_call',
      toolCall: { id: 'tc2', name: 'bash', input: { command: 'ls' }, status: 'error', error: 'boom' }
    } as any]
  }] as Message[],
  MODEL
);
assert((errResult as any).isError === true && (errResult as any).content[0].text === 'boom', 'tool error -> isError with error text');

// --- pending/running（被中断）的 toolCall 跳过 ---
const interrupted = toPiMessages(
  [{
    id: 'm6', role: 'assistant', timestamp: 6000,
    parts: [
      { id: 'p1', index: 0, type: 'text', content: '开始执行' } as any,
      {
        id: 'p2', index: 1, type: 'tool_call',
        toolCall: { id: 'tc3', name: 'bash', input: {}, status: 'running' }
      } as any
    ]
  }] as Message[],
  MODEL
);
assert(interrupted.length === 1, 'interrupted tool call: no toolResult appended');
assert(JSON.stringify((interrupted[0] as any).content) === JSON.stringify([{ type: 'text', text: '开始执行' }]),
  'interrupted tool call block dropped from content');
assert((interrupted[0] as any).stopReason === 'stop', 'no paired tool calls -> stopReason stop');

// --- system 消息与 UI 专属 parts 跳过 ---
const uiFiltered = toPiMessages(
  [
    { id: 'm7', role: 'system', content: '压缩提示', timestamp: 7000 },
    {
      id: 'm8', role: 'assistant', timestamp: 8000,
      parts: [
        { id: 'p1', index: 0, type: 'file_delivery', filePath: '/x', fileName: 'x', action: 'create' } as any,
        { id: 'p2', index: 1, type: 'text', content: '正文' } as any
      ]
    }
  ] as Message[],
  MODEL
);
assert(uiFiltered.length === 1, 'system messages skipped');
assert(JSON.stringify((uiFiltered[0] as any).content) === JSON.stringify([{ type: 'text', text: '正文' }]),
  'file_delivery parts skipped');

// --- legacy 消息（无 parts，只有 content/toolCalls 字段）---
const legacy = toPiMessages(
  [
    { id: 'm9', role: 'assistant', content: '旧格式', timestamp: 9000,
      toolCalls: [{ id: 'tc4', name: 'read', input: { path: 'b.ts' }, status: 'success', output: '旧结果' }] }
  ] as unknown as Message[],
  MODEL
);
assert(legacy.length === 2, 'legacy toolCalls field still pairs');
assert((legacy[0] as any).content[0].text === '旧格式' && (legacy[0] as any).stopReason === 'toolUse',
  'legacy text + toolUse');
assert((legacy[1] as any).role === 'toolResult' && (legacy[1] as any).content[0].text === '旧结果',
  'legacy toolResult content');

// --- 空输入 ---
assert(toPiMessages([], MODEL).length === 0, 'empty input -> empty output');

// --- 无模型信息也能回放（api/provider/model 留安全占位） ---
const [noModel] = toPiMessages(
  [{ id: 'm10', role: 'user', content: 'hi', timestamp: 11000 }] as Message[],
  null
);
assert(noModel && noModel.role === 'user', 'null model info still maps user messages');

console.log('\nsession restore tests done');
