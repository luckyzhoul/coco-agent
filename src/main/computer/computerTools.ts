import { Type } from '@sinclair/typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { computerService } from './ComputerService';
import type { ToolGate } from '../security/toolGate';

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

export function buildComputerTools(gate?: ToolGate): ToolDefinition[] {
  return [
    defineTool({
      name: 'computer_screenshot',
      label: 'Computer: Screenshot',
      description:
        'Capture a screenshot of the entire desktop screen. Use this to see what is currently on screen before interacting with desktop applications.',
      parameters: Type.Object({}),
      async execute() {
        const blocked = await checkGate(gate, 'computer_screenshot', {}, 'Capture a desktop screenshot');
        if (blocked) return deniedResult(blocked);
        const info = computerService.getScreenInfo();
        const base64 = await computerService.screenshot();
        return {
          content: [
            {
              type: 'text',
              text: `Desktop screenshot captured (${info.width}x${info.height}, scale ${info.scaleFactor}).`
            },
            { type: 'image', data: base64, mimeType: 'image/png' }
          ],
          details: { ...info, bytes: base64.length }
        };
      }
    }),

    defineTool({
      name: 'computer_list_windows',
      label: 'Computer: List Windows',
      description: 'List currently open desktop windows with their titles.',
      parameters: Type.Object({}),
      async execute() {
        const blocked = await checkGate(gate, 'computer_list_windows', {}, 'List open desktop windows');
        if (blocked) return deniedResult(blocked);
        const windows = await computerService.listWindows();
        if (windows.length === 0) {
          return {
            content: [{ type: 'text', text: 'No windows found.' }],
            details: { count: 0 }
          };
        }
        const text = windows
          .map((w, i) => `[${i}] ${w.title}${w.app ? ` (${w.app})` : ''}`)
          .join('\n');
        return {
          content: [{ type: 'text', text: `${windows.length} windows:\n\n${text}` }],
          details: { count: windows.length }
        };
      }
    }),

    defineTool({
      name: 'computer_click',
      label: 'Computer: Click',
      description:
        'Move the mouse and click at absolute screen coordinates. Take a screenshot first to determine the correct coordinates.',
      parameters: Type.Object({
        x: Type.Number({ description: 'X coordinate in screen pixels' }),
        y: Type.Number({ description: 'Y coordinate in screen pixels' })
      }),
      async execute(_id, params) {
        const blocked = await checkGate(
          gate,
          'computer_click',
          { x: params.x, y: params.y },
          `Click the mouse at screen position (${params.x}, ${params.y})`
        );
        if (blocked) return deniedResult(blocked);
        await computerService.click(params.x, params.y);
        const details: Record<string, unknown> = { denied: false, x: params.x, y: params.y };
        return {
          content: [{ type: 'text', text: `Clicked at (${params.x}, ${params.y}).` }],
          details
        };
      }
    }),

    defineTool({
      name: 'computer_type',
      label: 'Computer: Type Text',
      description: 'Type text using the keyboard into the currently focused window.',
      parameters: Type.Object({
        text: Type.String({ description: 'The text to type' })
      }),
      async execute(_id, params) {
        const blocked = await checkGate(
          gate,
          'computer_type',
          { text: params.text },
          `Type "${params.text}" using the keyboard`
        );
        if (blocked) return deniedResult(blocked);
        await computerService.type(params.text);
        const details: Record<string, unknown> = { denied: false, length: params.text.length };
        return {
          content: [{ type: 'text', text: `Typed ${params.text.length} characters.` }],
          details
        };
      }
    }),

    defineTool({
      name: 'computer_key',
      label: 'Computer: Press Key',
      description:
        'Press a key or key combination, e.g. "Return", "ctrl+c", "alt+Tab", "super".',
      parameters: Type.Object({
        key: Type.String({ description: 'Key or key combination to press' })
      }),
      async execute(_id, params) {
        const blocked = await checkGate(
          gate,
          'computer_key',
          { key: params.key },
          `Press the key combination "${params.key}"`
        );
        if (blocked) return deniedResult(blocked);
        await computerService.key(params.key);
        const details: Record<string, unknown> = { denied: false, key: params.key };
        return {
          content: [{ type: 'text', text: `Pressed "${params.key}".` }],
          details
        };
      }
    })
  ] as unknown as ToolDefinition[];
}
