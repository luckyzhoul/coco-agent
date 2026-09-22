import React from 'react';
import type { TextPart as TextPartType } from '@shared/types';
import { MarkdownRenderer } from '../../common/MarkdownRenderer';

interface TextPartProps {
  part: TextPartType;
}

export function TextPart({ part }: TextPartProps) {
  if (!part.content && !part.streaming) return null;

  return (
    <MarkdownRenderer content={part.content} streaming={part.streaming} />
  );
}
