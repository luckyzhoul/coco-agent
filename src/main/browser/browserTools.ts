import { Type } from '@sinclair/typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { browserService, type BrowserSnapshot } from './BrowserService';
import type { ToolGate } from '../security/toolGate';

function formatSnapshot(snap: BrowserSnapshot): string {
  const lines: string[] = [];
  lines.push(`URL: ${snap.url}`);
  lines.push(`Title: ${snap.title}`);
  lines.push('');
  lines.push('Interactive elements:');
  if (snap.elements.length === 0) {
    lines.push('  (none found)');
  } else {
    for (const el of snap.elements) {
      const parts = [`[${el.index}]`, el.tag];
      if (el.type) parts.push(`type=${el.type}`);
      if (el.text) parts.push(`"${el.text}"`);
      if (el.name) parts.push(`name="${el.name}"`);
      if (el.value) parts.push(`value="${el.value}"`);
      if (el.href) parts.push(`href=${el.href}`);
      lines.push('  ' + parts.join(' '));
    }
  }
  lines.push('');
  lines.push('Page text (truncated):');
  lines.push(snap.text.slice(0, 3000));
  return lines.join('\n');
}

/** Run the tool through the security gate; returns the block message or null. */
async function checkGate(
  gate: ToolGate | undefined,
  tool: string,
  input: Record<string, unknown>,
  desc: string
): Promise<string | null> {
  if (!gate) return null;
  const result = await gate.enforce(tool, input, desc);
  return result.blocked ? result.message || '操作被安全层拦截。' : null;
}

function deniedResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    details: { denied: true } as Record<string, unknown>
  };
}

export function buildBrowserTools(gate?: ToolGate): ToolDefinition[] {
  return [
    defineTool({
      name: 'browser_open',
      label: 'Browser: Open URL',
      description:
        'Open a URL in the agent-controlled browser and return the page structure (interactive elements with indexes, plus page text). Use the returned element indexes with browser_click and browser_fill.',
      parameters: Type.Object({
        url: Type.String({ description: 'The URL to navigate to (https:// is added if missing)' })
      }),
      async execute(_id, params) {
        const blocked = await checkGate(gate, 'browser_open', params, `Open ${params.url} in the agent browser`);
        if (blocked) return deniedResult(blocked);
        const snap = await browserService.open(params.url);
        return {
          content: [{ type: 'text', text: formatSnapshot(snap) }],
          details: { url: snap.url, elementCount: snap.elements.length }
        };
      }
    }),

    defineTool({
      name: 'browser_snapshot',
      label: 'Browser: Snapshot',
      description:
        'Re-read the current page structure and text. Use after a page changes dynamically.',
      parameters: Type.Object({}),
      async execute() {
        const blocked = await checkGate(gate, 'browser_snapshot', {}, 'Re-read the current page');
        if (blocked) return deniedResult(blocked);
        const snap = await browserService.snapshot();
        return {
          content: [{ type: 'text', text: formatSnapshot(snap) }],
          details: { url: snap.url, elementCount: snap.elements.length }
        };
      }
    }),

    defineTool({
      name: 'browser_click',
      label: 'Browser: Click',
      description:
        'Click an interactive element by its index from the latest snapshot. Returns the updated page structure.',
      parameters: Type.Object({
        index: Type.Number({ description: 'Element index from the latest snapshot' })
      }),
      async execute(_id, params) {
        const blocked = await checkGate(
          gate,
          'browser_click',
          { index: params.index },
          `Click element [${params.index}] on ${browserService.getUrl() || 'page'}`
        );
        if (blocked) return deniedResult(blocked);
        const snap = await browserService.click(params.index);
        const details: Record<string, unknown> = { denied: false, url: snap.url, elementCount: snap.elements.length };
        return {
          content: [{ type: 'text', text: `Clicked [${params.index}].\n\n${formatSnapshot(snap)}` }],
          details
        };
      }
    }),

    defineTool({
      name: 'browser_fill',
      label: 'Browser: Fill Input',
      description:
        'Fill a text input, textarea, or contenteditable element identified by its index from the latest snapshot.',
      parameters: Type.Object({
        index: Type.Number({ description: 'Element index from the latest snapshot' }),
        value: Type.String({ description: 'Text to enter' })
      }),
      async execute(_id, params) {
        const blocked = await checkGate(
          gate,
          'browser_fill',
          { index: params.index, value: params.value },
          `Type "${params.value}" into element [${params.index}]`
        );
        if (blocked) return deniedResult(blocked);
        const snap = await browserService.fill(params.index, params.value);
        const details: Record<string, unknown> = { denied: false, url: snap.url, elementCount: snap.elements.length };
        return {
          content: [
            { type: 'text', text: `Filled [${params.index}].\n\n${formatSnapshot(snap)}` }
          ],
          details
        };
      }
    }),

    defineTool({
      name: 'browser_get_text',
      label: 'Browser: Get Text',
      description: 'Get the full visible text of the current page (up to 6000 characters).',
      parameters: Type.Object({}),
      async execute() {
        const blocked = await checkGate(gate, 'browser_get_text', {}, 'Read the current page text');
        if (blocked) return deniedResult(blocked);
        const text = await browserService.getText();
        return {
          content: [{ type: 'text', text: text.slice(0, 6000) }],
          details: { length: text.length }
        };
      }
    }),

    defineTool({
      name: 'browser_screenshot',
      label: 'Browser: Screenshot',
      description: 'Capture a screenshot of the current page as a PNG image.',
      parameters: Type.Object({}),
      async execute() {
        const blocked = await checkGate(gate, 'browser_screenshot', {}, 'Capture a screenshot of the current page');
        if (blocked) return deniedResult(blocked);
        const base64 = await browserService.screenshot();
        return {
          content: [
            { type: 'text', text: 'Screenshot captured.' },
            { type: 'image', data: base64, mimeType: 'image/png' }
          ],
          details: { bytes: base64.length }
        };
      }
    }),

    defineTool({
      name: 'browser_close',
      label: 'Browser: Close',
      description: 'Close the agent-controlled browser window and free resources.',
      parameters: Type.Object({}),
      async execute() {
        const blocked = await checkGate(gate, 'browser_close', {}, 'Close the agent browser');
        if (blocked) return deniedResult(blocked);
        await browserService.close();
        return {
          content: [{ type: 'text', text: 'Browser closed.' }],
          details: {}
        };
      }
    })
  ] as unknown as ToolDefinition[];
}
