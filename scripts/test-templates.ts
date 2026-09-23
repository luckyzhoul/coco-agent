// Unit tests for the built-in agent role templates and icon key set.
// Run via jiti so the TypeScript source is imported directly (no build step).
import { AGENT_ICON_KEYS, builtinIconKey } from '../src/shared/agentIcons';
import {
  AGENT_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  TEMPLATE_NONE_ID,
  getAgentTemplate,
} from '../src/shared/agentTemplates';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

assert(AGENT_TEMPLATES.length === 3, 'exposes exactly three role templates');
assert(
  AGENT_TEMPLATES.map((t) => t.id).join(',') === 'balanced,rational,emotional',
  'template ids are balanced/rational/emotional in order',
);

const ids = new Set(AGENT_TEMPLATES.map((t) => t.id));
assert(ids.size === AGENT_TEMPLATES.length, 'template ids are unique');
assert(!ids.has(TEMPLATE_NONE_ID), 'the "none" id is not a real template');
assert(ids.has(DEFAULT_TEMPLATE_ID), 'the default template id exists');
assert(getAgentTemplate('balanced')?.id === 'balanced', 'getAgentTemplate finds a template');
assert(getAgentTemplate(TEMPLATE_NONE_ID) === undefined, 'getAgentTemplate rejects "none"');

for (const tpl of AGENT_TEMPLATES) {
  assert(tpl.name.length > 0, `${tpl.id}: has a card title`);
  assert(tpl.description.length > 0, `${tpl.id}: has a description`);
  assert(tpl.persona.length >= 100, `${tpl.id}: persona is substantive (>=100 chars)`);
  assert(tpl.persona.length <= 260, `${tpl.id}: persona stays short (<=260 chars)`);
  assert(
    builtinIconKey(tpl.icon) !== null,
    `${tpl.id}: icon references a built-in key`,
  );
}

assert(AGENT_ICON_KEYS.length === 8, 'eight built-in icons');
assert(new Set(AGENT_ICON_KEYS).size === AGENT_ICON_KEYS.length, 'icon keys are unique');

// Icon value parsing: only known 'builtin:<key>' values resolve.
assert(builtinIconKey('builtin:owl') === 'owl', 'parses a built-in icon value');
assert(builtinIconKey('builtin:nope') === null, 'rejects an unknown icon key');
assert(builtinIconKey('custom') === null, 'rejects the custom sentinel');
assert(builtinIconKey('') === null, 'rejects the empty value');
assert(builtinIconKey(undefined) === null, 'handles undefined');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
