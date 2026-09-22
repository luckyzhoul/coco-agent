import React from 'react';
import type { MessagePart } from '@shared/types';
import { TextPart } from './TextPart';
import { ThinkingPart } from './ThinkingPart';
import { ToolCallPart } from './ToolCallPart';
import { FileDeliveryPart } from './FileDeliveryPart';
import { SummaryPart } from './SummaryPart';

interface PartRendererProps {
  part: MessagePart;
}

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
    case 'summary':
      return <SummaryPart part={part} />;
    default:
      return null;
  }
}
