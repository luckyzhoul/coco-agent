import React from 'react';
import type { MessagePart } from '@shared/types';
import { TextPart } from './TextPart';
import { ThinkingPart } from './ThinkingPart';
import { ToolCallPart } from './ToolCallPart';
import { FileDeliveryPart } from './FileDeliveryPart';

interface PartRendererProps {
  part: MessagePart;
}

// Note: the 'summary' part type is still streamed/stored but no longer
// rendered — it was replaced by the per-message action bar in MessageBubble.
export function PartRenderer({ part }: PartRendererProps) {
  switch (part.type) {
    case 'text':
      return <TextPart part={part} />;
    case 'thinking':
      return <ThinkingPart part={part} />;
    case 'tool_call':
      return <ToolCallPart part={part} />;
    case 'file_delivery':
      return <FileDeliveryPart part={part} />;
    default:
      return null;
  }
}
