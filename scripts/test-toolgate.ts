// Unit tests for the central tool-call classifier (pure, no Electron required).
// Mirrors openhanako's classifySessionPermission: mode-level decisions for all
// assembled tools; file/shell tools are documented as writeGuard's domain.
import {
  classifyToolCall,
  INFORMATION_TOOLS,
  INTERNAL_SIDE_EFFECT_TOOLS,
  EXTERNAL_SIDE_EFFECT_TOOLS,
  FILE_SHELL_TOOLS
} from '../src/main/security/toolGate';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

// --- information tools pass in EVERY mode ---
for (const level of ['readonly', 'ask', 'auto', 'full'] as const) {
  for (const tool of INFORMATION_TOOLS) {
    assert(
      classifyToolCall(level, tool).action === 'allow',
      `${tool} allowed at ${level}`
    );
  }
}

// --- readonly denies every mutation with an unlock hint ---
for (const tool of [...INTERNAL_SIDE_EFFECT_TOOLS, ...EXTERNAL_SIDE_EFFECT_TOOLS]) {
  const d = classifyToolCall('readonly', tool);
  assert(d.action === 'deny' && d.reason && d.reason.includes('只读'), `${tool} denied at readonly with hint`);
}
const mcpEvil = classifyToolCall('readonly', 'mcp__srv1__delete_file');
assert(mcpEvil.action === 'deny', 'MCP write verb denied at readonly');

// --- ask prompts for every mutation ---
for (const tool of [...INTERNAL_SIDE_EFFECT_TOOLS, ...EXTERNAL_SIDE_EFFECT_TOOLS]) {
  assert(classifyToolCall('ask', tool).action === 'prompt', `${tool} prompts at ask`);
}
assert(classifyToolCall('ask', 'mcp__srv1__anything').action === 'prompt', 'MCP unknown prompts at ask');

// --- auto: internal side effects are regular work, external are held ---
assert(classifyToolCall('auto', 'memory_add').action === 'allow', 'memory_add allowed at auto');
assert(classifyToolCall('auto', 'memory_compile').action === 'allow', 'memory_compile allowed at auto');
assert(classifyToolCall('auto', 'browser_click').action === 'prompt', 'browser_click held at auto');
assert(classifyToolCall('auto', 'computer_type').action === 'prompt', 'computer_type held at auto');

// --- auto: MCP verbs split safe vs rest ---
assert(classifyToolCall('auto', 'mcp__srv1__list_files').action === 'allow', 'MCP safe verb allowed at auto');
assert(classifyToolCall('auto', 'mcp__srv1__search_docs').action === 'allow', 'MCP search verb allowed at auto');
assert(classifyToolCall('auto', 'mcp__srv1__send_message').action === 'prompt', 'MCP send verb held at auto');
assert(classifyToolCall('auto', 'mcp__srv1__obscure_thing').action === 'prompt', 'MCP unknown verb held at auto');

// --- auto: unknown tools prompt, never silently allowed ---
assert(classifyToolCall('auto', 'brand_new_tool').action === 'prompt', 'unknown tool held at auto');

// --- full allows everything ---
for (const tool of [...INFORMATION_TOOLS, ...INTERNAL_SIDE_EFFECT_TOOLS, ...EXTERNAL_SIDE_EFFECT_TOOLS, ...FILE_SHELL_TOOLS]) {
  assert(classifyToolCall('full', tool).action === 'allow', `${tool} allowed at full`);
}

// --- taxonomy hygiene: sets are disjoint ---
const all = [...INFORMATION_TOOLS, ...INTERNAL_SIDE_EFFECT_TOOLS, ...EXTERNAL_SIDE_EFFECT_TOOLS, ...FILE_SHELL_TOOLS];
assert(new Set(all).size === all.length, 'taxonomy sets are disjoint');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
