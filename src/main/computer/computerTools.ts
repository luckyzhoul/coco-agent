import { Type } from '@sinclair/typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { computerService } from './ComputerService';

interface ApprovalGate {
  requireApproval: (
    tool: string,
    input: Record<string, unknown>,
    desc: string
  ) => Promise<boolean>;
}

export function buildComputerTools(approvalManager?: ApprovalGate): ToolDefinition[] {
  const gate = async (
    tool: string,
    input: Record<string, unknown>,
    desc: string
  ): Promise<boolean> => {
    if (!approvalManager) return true;
    return approvalManager.requireApproval(tool, input, desc);
  };

  return [
    defineTool({
      name: 'computer_screenshot',
      label: 'Computer: Screenshot',
      description:
        'Capture a screenshot of the entire desktop screen. Use this to see what is currently on screen before interacting with desktop applications.',
      parameters: Type.Object({}),
      async execute() {
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
        const approved = await gate(
          'computer_click',
          { x: params.x, y: params.y },
          `Click the mouse at screen position (${params.x}, ${params.y})`
        );
        if (!approved) {
          return {
            content: [{ type: 'text', text: 'Click denied by user.' }],
            details: { denied: true } as Record<string, unknown>
          };
        }
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
        const approved = await gate(
          'computer_type',
          { text: params.text },
          `Type "${params.text}" using the keyboard`
        );
        if (!approved) {
          return {
            content: [{ type: 'text', text: 'Typing denied by user.' }],
            details: { denied: true } as Record<string, unknown>
          };
        }
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
        const approved = await gate(
          'computer_key',
          { key: params.key },
          `Press the key combination "${params.key}"`
        );
        if (!approved) {
          return {
            content: [{ type: 'text', text: 'Key press denied by user.' }],
            details: { denied: true } as Record<string, unknown>
          };
        }
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
