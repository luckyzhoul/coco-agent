import { toPiMessages, estimateTextTokens, estimatePiMessagesTokens } from '../src/main/agent/sessionRestore';
import { estimateTokens } from '@earendil-works/pi-coding-agent';
// estimateContextTokens 未从 SDK 主入口导出，直载 dist（estimateTokens 已含在主入口）
import { estimateContextTokens } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/compaction/compaction.js';
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

// --- usage 透传：切换会话后上下文用量估算依赖真实 usage（不能是全 0 占位） ---
const USAGE = { input: 39_000, output: 1_800, cacheRead: 1_200, cacheWrite: 0, totalTokens: 42_000 };
const [usageAssist] = toPiMessages(
  [{
    id: 'm11', role: 'assistant', timestamp: 12000,
    parts: [{ id: 'p1', index: 0, type: 'text', content: '回答', state: 'done' } as any],
    usage: USAGE
  }] as unknown as Message[],
  MODEL
);
assert(
  JSON.stringify((usageAssist as any).usage) === JSON.stringify(USAGE),
  'assistant usage round-trips into replayed message'
);

// 没带 usage 的旧消息仍用全 0 占位（向后兼容）
const [noUsageAssist] = toPiMessages(
  [{
    id: 'm12', role: 'assistant', timestamp: 13000,
    parts: [{ id: 'p1', index: 0, type: 'text', content: '回答', state: 'done' } as any]
  }] as Message[],
  MODEL
);
assert(
  (noUsageAssist as any).usage && (noUsageAssist as any).usage.totalTokens === 0,
  'missing usage falls back to zero placeholder'
);

// --- 端到端：回放后 SDK 的上下文估算应等于真实 usage（+ 尾部增量估算） ---
const replayedWithUsage = toPiMessages(
  [
    { id: 'm13', role: 'user', content: '第一轮提问', timestamp: 14000 },
    {
      id: 'm14', role: 'assistant', timestamp: 15000,
      parts: [{ id: 'p1', index: 0, type: 'text', content: '回答', state: 'done' } as any],
      usage: USAGE
    },
    { id: 'm15', role: 'user', content: '追问', timestamp: 16000 }
  ] as unknown as Message[],
  MODEL
);
const est = estimateContextTokens(replayedWithUsage as any[]);
const trailingUser = replayedWithUsage[replayedWithUsage.length - 1];
assert(
  est.tokens === USAGE.totalTokens + estimateTokens(trailingUser as any),
  `context estimate after replay equals real usage + trailing (got ${est.tokens})`
);

// --- CJK 感知估算：老会话（无持久化 usage）切换回放时的回填基础 ---
// SDK 的 estimateTokens 是 chars/4，中文被低估约 4 倍；估算器按 CJK 字符 ~1 token 计。
assert(estimateTextTokens('一二三四') === 4, 'CJK chars count ~1 token each (not chars/4)');
assert(estimateTextTokens('abcd') === 1, 'ASCII still ~4 chars per token');
assert(estimateTextTokens('你好世界 hello') === 4 + 2, 'mixed CJK + ASCII');
assert(estimateTextTokens('') === 0, 'empty text -> 0');

// 回放的 Pi 消息序列：user(string) + assistant(text/thinking/toolCall) + toolResult
const estMsgs = toPiMessages(
  [
    { id: 'm20', role: 'user', content: '分析这个项目', timestamp: 20000 },
    {
      id: 'm21', role: 'assistant', timestamp: 21000,
      parts: [
        { id: 'p1', index: 0, type: 'thinking', content: '思考内容四个字', state: 'done' } as any,
        { id: 'p2', index: 1, type: 'text', content: '结论三个字', state: 'done' } as any,
        {
          id: 'p3', index: 2, type: 'tool_call',
          toolCall: { id: 'tc9', name: 'read', input: { path: 'a' }, status: 'success', output: '结果' }
        } as any
      ]
    }
  ] as unknown as Message[],
  MODEL
);
const estTotal = estimatePiMessagesTokens(estMsgs as any[]);
// user 6 + thinking 7 + text 5 + toolCall(name+args JSON) 4 + toolResult 2
const toolCallEst = estimateTextTokens('read' + JSON.stringify({ path: 'a' }));
assert(estTotal === 6 + 7 + 5 + toolCallEst + 2,
  `per-message estimate sums user/thinking/text/toolCall/toolResult (got ${estTotal})`);

// 回填机制端到端：无 usage 的回放消息挂上估算 usage 后，SDK 估算应返回该值
const lastAssistant = [...estMsgs].reverse().find((m) => m.role === 'assistant') as any;
lastAssistant.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: estTotal + 500 };
const estAfterBackfill = estimateContextTokens(estMsgs as any[]);
// SDK 会在 usage 之后追加 trailing 消息（这里的 toolResult）的 chars/4 估算
const trailing = estimateTokens(estMsgs[estMsgs.length - 1] as any);
assert(estAfterBackfill.tokens === estTotal + 500 + trailing,
  `backfilled usage drives SDK context estimate (got ${estAfterBackfill.tokens})`);

console.log('\nsession restore tests done');
